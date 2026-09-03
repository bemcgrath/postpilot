import type { KeyValueStore } from "@postpilot/core/storage/adapter"

/**
 * Structural shape of the subset of react-native-mmkv's `MMKV` instance this
 * adapter actually calls. Deliberately not `import type { MMKV } from
 * "react-native-mmkv"` -- that package's JS entry touches its native Nitro
 * binding on import (not just on call), which doesn't exist outside a real
 * RN runtime, so importing it here would make this file (and the wrapper
 * logic below) untestable under plain Vitest/Node. Same discipline
 * `packages/core/src/storage/adapter.ts` already uses for `chrome`: read a
 * platform's SDK structurally, never depend on its ambient/native types.
 */
export interface MmkvLike {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  remove(key: string): void
  getAllKeys(): string[]
  clearAll(): void
  addOnValueChangedListener(cb: (changedKey: string) => void): { remove(): void }
}

/**
 * MMKV-backed KeyValueStore -- the mobile counterpart to the extension's
 * ChromeStorageAdapter, installed at app startup via installPlatform()
 * (the mechanism the storage adapter was built for in M1, first used here).
 *
 * MMKV only stores primitives (string/number/boolean/ArrayBuffer) natively,
 * so every value is JSON-encoded on the way in and decoded on the way out --
 * the same shape chrome.storage.local's values already have (arbitrary
 * JSON-serializable objects), just persisted differently under the hood.
 *
 * Takes its MMKV instance by constructor injection rather than constructing
 * one itself -- that's what lets this class's actual logic (JSON coding,
 * corrupt-value handling, onChanged wiring) run under a plain Vitest fake in
 * mmkv-store.test.ts, with the real native binding wired up in exactly one
 * place: createMobilePlatform() in mmkv-platform.ts.
 */
export class MmkvStore implements KeyValueStore {
  constructor(private readonly mmkv: MmkvLike) {}

  async get(keys: string | string[]): Promise<Record<string, unknown>> {
    const list = Array.isArray(keys) ? keys : [keys]
    const result: Record<string, unknown> = {}
    for (const key of list) {
      const raw = this.mmkv.getString(key)
      if (raw !== undefined) {
        try {
          result[key] = JSON.parse(raw)
        } catch {
          // Corrupt/non-JSON value -- skip rather than throw, matching
          // chrome.storage's "missing key" behavior for callers.
        }
      }
    }
    return result
  }

  async set(items: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      this.mmkv.set(key, JSON.stringify(value))
    }
  }

  async remove(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys]
    for (const key of list) {
      this.mmkv.remove(key)
    }
  }

  async getAll(): Promise<Record<string, unknown>> {
    return this.get(this.mmkv.getAllKeys())
  }

  async clear(): Promise<void> {
    this.mmkv.clearAll()
  }

  onChanged(cb: (changes: Record<string, { newValue?: unknown }>) => void): () => void {
    const listener = this.mmkv.addOnValueChangedListener((changedKey: string) => {
      const raw = this.mmkv.getString(changedKey)
      let newValue: unknown
      if (raw !== undefined) {
        try {
          newValue = JSON.parse(raw)
        } catch {
          newValue = undefined
        }
      }
      cb({ [changedKey]: { newValue } })
    })
    return () => listener.remove()
  }
}
