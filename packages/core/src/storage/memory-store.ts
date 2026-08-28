import type { KeyValueStore, Platform } from "./adapter"

/**
 * In-memory KeyValueStore -- lets tests exercise the real get/set/remove/
 * onChanged/getAll contract without a live chrome.storage.local. Also the
 * shape a future test-only mobile build would use before wiring up MMKV.
 */
export class MemoryStore implements KeyValueStore {
  private data = new Map<string, unknown>()
  private listeners = new Set<(changes: Record<string, { newValue?: unknown }>) => void>()

  async get(keys: string | string[]): Promise<Record<string, unknown>> {
    const list = Array.isArray(keys) ? keys : [keys]
    const result: Record<string, unknown> = {}
    for (const key of list) {
      if (this.data.has(key)) result[key] = this.data.get(key)
    }
    return result
  }

  async set(items: Record<string, unknown>): Promise<void> {
    const changes: Record<string, { newValue?: unknown }> = {}
    for (const [key, value] of Object.entries(items)) {
      this.data.set(key, value)
      changes[key] = { newValue: value }
    }
    this.notify(changes)
  }

  async remove(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys]
    const changes: Record<string, { newValue?: unknown }> = {}
    for (const key of list) {
      this.data.delete(key)
      changes[key] = { newValue: undefined }
    }
    this.notify(changes)
  }

  async getAll(): Promise<Record<string, unknown>> {
    return Object.fromEntries(this.data.entries())
  }

  async clear(): Promise<void> {
    this.data.clear()
  }

  onChanged(cb: (changes: Record<string, { newValue?: unknown }>) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private notify(changes: Record<string, { newValue?: unknown }>): void {
    for (const listener of this.listeners) listener(changes)
  }
}

let uuidCounter = 0

/** A Platform backed by MemoryStore, with deterministic (non-random) ids -- useful for snapshot-style test assertions. */
export function createMemoryPlatform(): Platform {
  return {
    storage: new MemoryStore(),
    randomUUID: () => `test-uuid-${++uuidCounter}`
  }
}
