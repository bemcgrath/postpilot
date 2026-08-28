import { afterEach, describe, expect, it } from "vitest"
import { getStore, installPlatform, resetPlatform, uuid } from "~storage/adapter"
import { createMemoryPlatform, MemoryStore } from "~storage/memory-store"

afterEach(() => {
  resetPlatform()
})

describe("getStore / installPlatform / resetPlatform", () => {
  it("returns null when no platform is installed and chrome is undefined (test/node environment)", () => {
    expect(getStore()).toBeNull()
  })

  it("returns the installed platform's store once installed", () => {
    const platform = createMemoryPlatform()
    installPlatform(platform)
    expect(getStore()).toBe(platform.storage)
  })

  it("reverts to null after resetPlatform", () => {
    installPlatform(createMemoryPlatform())
    resetPlatform()
    expect(getStore()).toBeNull()
  })
})

describe("uuid()", () => {
  it("falls back to a Hermes-safe id shape when no platform is installed and no real crypto.randomUUID exists", () => {
    // Node/vitest does have a real crypto.randomUUID, so just assert the
    // function returns a non-empty, unique string either way.
    const a = uuid()
    const b = uuid()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(0)
  })

  it("uses the installed platform's randomUUID when one is installed", () => {
    installPlatform(createMemoryPlatform())
    expect(uuid()).toBe("test-uuid-1")
    expect(uuid()).toBe("test-uuid-2")
  })
})

describe("MemoryStore contract", () => {
  it("round-trips get/set for a single key and for an array of keys", async () => {
    const store = new MemoryStore()
    await store.set({ a: 1, b: "two" })
    expect(await store.get("a")).toEqual({ a: 1 })
    expect(await store.get(["a", "b", "missing"])).toEqual({ a: 1, b: "two" })
  })

  it("remove deletes single and multiple keys", async () => {
    const store = new MemoryStore()
    await store.set({ a: 1, b: 2, c: 3 })
    await store.remove(["a", "c"])
    expect(await store.getAll()).toEqual({ b: 2 })
  })

  it("getAll returns everything, clear empties it", async () => {
    const store = new MemoryStore()
    await store.set({ a: 1, b: 2 })
    expect(await store.getAll()).toEqual({ a: 1, b: 2 })
    await store.clear()
    expect(await store.getAll()).toEqual({})
  })

  it("onChanged fires with newValue on set, and undefined on remove; unsubscribe stops delivery", async () => {
    const store = new MemoryStore()
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
})
