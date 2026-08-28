import { createMMKV, type MMKV } from "react-native-mmkv"
import * as Crypto from "expo-crypto"
import type { KeyValueStore, Platform } from "@postpilot/core/storage/adapter"

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
 * react-native-mmkv v4 uses Nitro Modules: instances come from createMMKV(),
 * not `new MMKV()` -- `MMKV` is a type-only export.
 */
export class MmkvStore implements KeyValueStore {
  private mmkv: MMKV = createMMKV({ id: "postpilot" })

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

export function createMobilePlatform(): Platform {
  return {
    storage: new MmkvStore(),
    randomUUID: () => Crypto.randomUUID()
  }
}
