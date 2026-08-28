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
 *
 * Deliberately does NOT reference the global ambient `chrome` type from
 * `@types/chrome`. That type is only available in a checking context that
 * happens to have `@types/chrome` hoisted into its type search path (true
 * for apps/extension, and, by accident, for packages/core checked alone) --
 * it is NOT available when apps/mobile's stricter Expo-derived tsconfig
 * typechecks this same shared file. A package multiple platforms consume
 * can't depend on any one consumer's ambient types; every reference below
 * goes through `globalThis` with a small local structural type instead.
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

/** Minimal structural shape of chrome.storage.local -- only what this file calls. */
interface ChromeStorageAreaLike {
  get(keys: string | string[] | null, callback: (result: Record<string, unknown>) => void): void
  set(items: Record<string, unknown>, callback?: () => void): void
  remove(keys: string | string[], callback?: () => void): void
  clear(callback?: () => void): void
}

interface ChromeOnChangedLike {
  addListener(cb: (changes: Record<string, { newValue?: unknown }>) => void): void
  removeListener(cb: (changes: Record<string, { newValue?: unknown }>) => void): void
}

interface ChromeGlobalLike {
  runtime?: { id?: string }
  storage?: { local?: ChromeStorageAreaLike; onChanged?: ChromeOnChangedLike }
}

/** The chrome global, read structurally through globalThis -- never assumes @types/chrome is present. */
function getChromeGlobal(): ChromeGlobalLike | undefined {
  return (globalThis as { chrome?: ChromeGlobalLike }).chrome
}

/** Safely detect a live chrome.storage.local — mirrors the guard every getStorage() used to repeat. */
function detectChromeStorage(): ChromeStorageAreaLike | null {
  try {
    const chromeGlobal = getChromeGlobal()
    if (chromeGlobal?.runtime?.id && chromeGlobal.storage?.local) {
      return chromeGlobal.storage.local
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
  constructor(private readonly area: ChromeStorageAreaLike) {}

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
    const onChanged = getChromeGlobal()?.storage?.onChanged
    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      try {
        cb(changes)
      } catch {
        // Extension context invalidated
      }
    }
    onChanged?.addListener(listener)
    return () => {
      try {
        onChanged?.removeListener(listener)
      } catch {
        // Extension context invalidated
      }
    }
  }
}

let installedPlatform: Platform | null = null
let cachedArea: ChromeStorageAreaLike | null = null
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
