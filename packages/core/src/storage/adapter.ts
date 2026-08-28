/**
 * Storage adapter -- the one seam that used to be nine near-identical
 * `getStorage()` helpers, each wrapping `chrome.storage.local` with a
 * `typeof chrome !== "undefined"` guard so the module degrades to "no
 * persistence" instead of throwing outside the extension (tests, the
 * standalone score-widget bundle, and eventually React Native, none of
 * which have a `chrome` global).
 *
 * `getStore()` auto-detects: if a platform was explicitly installed via
 * `installPlatform()`, use it; otherwise, lazily construct and cache a
 * `ChromeStorageAdapter` the first time `chrome` is actually present, or
 * return `null` if it never is. This preserves every existing call site's
 * `if (!storage) return <default>` behavior exactly, with zero required
 * changes at the extension's entry points -- `installPlatform()` exists so
 * a future mobile build can swap in an MMKV-backed store instead.
 */

export interface KeyValueStore {
  get(keys: string | string[]): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string | string[]): Promise<void>
  /** The full contents of the store -- backs "export all data" and future sync. */
  getAll(): Promise<Record<string, unknown>>
  clear(): Promise<void>
  /** Subscribe to changes from other contexts (other tabs, background worker). Returns an unsubscribe function. */
  onChanged(cb: (changes: Record<string, { newValue?: unknown }>) => void): () => void
}

export interface Platform {
  storage: KeyValueStore
  /** Hermes has no crypto.randomUUID -- platforms provide their own. */
  randomUUID(): string
}

/** Safely detect a live chrome.storage.local — mirrors the guard every getStorage() used to repeat. */
function detectChromeStorage(): typeof chrome.storage.local | null {
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime?.id &&
      typeof chrome.storage !== "undefined" &&
      typeof chrome.storage.local !== "undefined"
    ) {
      return chrome.storage.local
    }
  } catch {
    // Extension context invalidated or not available
  }
  return null
}

/** Fallback id generator, Hermes-safe by construction -- the shape hook-storage.ts already used. */
function fallbackUuid(): string {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

class ChromeStorageAdapter implements KeyValueStore {
  constructor(private readonly area: typeof chrome.storage.local) {}

  get(keys: string | string[]): Promise<Record<string, unknown>> {
    return new Promise((resolve) => this.area.get(keys, resolve))
  }

  set(items: Record<string, unknown>): Promise<void> {
    return new Promise((resolve) => this.area.set(items, resolve))
  }

  remove(keys: string | string[]): Promise<void> {
    return new Promise((resolve) => this.area.remove(keys, resolve))
  }

  getAll(): Promise<Record<string, unknown>> {
    return new Promise((resolve) => this.area.get(null, resolve))
  }

  clear(): Promise<void> {
    return new Promise((resolve) => this.area.clear(resolve))
  }

  onChanged(cb: (changes: Record<string, { newValue?: unknown }>) => void): () => void {
    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        cb(changes)
      } catch {
        // Extension context invalidated
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => {
      try {
        chrome.storage.onChanged.removeListener(listener)
      } catch {
        // Extension context invalidated
      }
    }
  }
}

let installedPlatform: Platform | null = null
let cachedArea: typeof chrome.storage.local | null = null
let cachedChromePlatform: Platform | null = null

/** Explicitly install a platform (e.g. an MMKV-backed one on mobile, or a MemoryStore in tests). Overrides auto-detection. */
export function installPlatform(platform: Platform): void {
  installedPlatform = platform
}

/** Clear an explicitly installed platform, reverting to chrome auto-detection. For test teardown. */
export function resetPlatform(): void {
  installedPlatform = null
}

/** Returns the active KeyValueStore, or null if none is available in this context. */
export function getStore(): KeyValueStore | null {
  if (installedPlatform) return installedPlatform.storage

  const area = detectChromeStorage()
  if (!area) return null

  if (!cachedChromePlatform || cachedArea !== area) {
    cachedArea = area
    cachedChromePlatform = {
      storage: new ChromeStorageAdapter(area),
      randomUUID: () =>
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : fallbackUuid()
    }
  }
  return cachedChromePlatform.storage
}

/** A UUID from the active platform, or a Hermes-safe fallback if none is installed/detected. */
export function uuid(): string {
  if (installedPlatform) return installedPlatform.randomUUID()
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return fallbackUuid()
}
