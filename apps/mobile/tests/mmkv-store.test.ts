import { describe, expect, it } from "vitest"
import { MmkvStore, type MmkvLike } from "../src/platform/mmkv-store"

/**
 * First real coverage for the mobile storage adapter -- see
 * packages/core/tests/storage-adapter.test.ts's MemoryStore contract block
 * for the equivalent extension-side suite. This fake never touches the real
 * native MMKV binding (see mmkv-store.ts's own comment for why that
 * matters), so it runs under plain Vitest/Node -- it proves MmkvStore's own
 * adapter logic (JSON coding, corrupt-value handling, onChanged wiring) is
 * correct. It does not prove react-native-mmkv itself persists to disk on a
 * real device -- that's the on-device verification the M3 pass already did
 * (a saved draft surviving `adb shell am force-stop` + cold relaunch).
 */
function createFakeMmkv(): MmkvLike {
  const data = new Map<string, string>()
  const listeners = new Set<(changedKey: string) => void>()

  return {
    getString: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value)
      listeners.forEach((cb) => cb(key))
    },
    remove: (key) => {
      data.delete(key)
      listeners.forEach((cb) => cb(key))
    },
    getAllKeys: () => Array.from(data.keys()),
    clearAll: () => data.clear(),
    addOnValueChangedListener: (cb) => {
      listeners.add(cb)
      return { remove: () => listeners.delete(cb) }
    }
  }
}

describe("MmkvStore contract", () => {
  it("round-trips get/set for a single key and for an array of keys", async () => {
    const store = new MmkvStore(createFakeMmkv())
    await store.set({ a: 1, b: "two" })
    expect(await store.get("a")).toEqual({ a: 1 })
    expect(await store.get(["a", "b", "missing"])).toEqual({ a: 1, b: "two" })
  })

  it("remove deletes single and multiple keys", async () => {
    const store = new MmkvStore(createFakeMmkv())
    await store.set({ a: 1, b: 2, c: 3 })
    await store.remove(["a", "c"])
    expect(await store.getAll()).toEqual({ b: 2 })
  })

  it("getAll returns everything, clear empties it", async () => {
    const store = new MmkvStore(createFakeMmkv())
    await store.set({ a: 1, b: 2 })
    expect(await store.getAll()).toEqual({ a: 1, b: 2 })
    await store.clear()
    expect(await store.getAll()).toEqual({})
  })

  it("onChanged fires with newValue on set, and undefined on remove; unsubscribe stops delivery", async () => {
    const store = new MmkvStore(createFakeMmkv())
    const seen: Array<Record<string, { newValue?: unknown }>> = []
    const unsubscribe = store.onChanged((changes) => seen.push(changes))

    await store.set({ k: "v1" })
    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual({ k: { newValue: "v1" } })

    await store.remove("k")
    expect(seen).toHaveLength(2)
    expect(seen[1]).toEqual({ k: { newValue: undefined } })

    unsubscribe()
    await store.set({ k: "v2" })
    expect(seen).toHaveLength(2) // no new event after unsubscribe
  })

  it("round-trips values MMKV can't store natively (objects, arrays, booleans)", async () => {
    const store = new MmkvStore(createFakeMmkv())
    const value = { nested: [1, 2, 3], ok: true, label: null }
    await store.set({ k: value })
    expect(await store.get("k")).toEqual({ k: value })
  })

  it("skips a corrupt/non-JSON stored value instead of throwing", async () => {
    const fake = createFakeMmkv()
    fake.set("bad", "{not valid json")
    const store = new MmkvStore(fake)
    expect(await store.get("bad")).toEqual({})
    expect(await store.getAll()).toEqual({})
  })
})
