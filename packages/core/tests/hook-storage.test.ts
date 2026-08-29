import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { installPlatform, resetPlatform } from "../src/storage/adapter"
import { createMemoryPlatform } from "../src/storage/memory-store"
import { deleteHook, loadHooks, saveHook } from "../src/hooks/hook-storage"

// First real coverage for this module -- see draft-storage.test.ts for why.

beforeEach(() => {
  installPlatform(createMemoryPlatform())
})

afterEach(() => {
  resetPlatform()
})

describe("hook-storage", () => {
  it("starts empty", async () => {
    expect(await loadHooks()).toEqual([])
  })

  it("saves a hook, deriving the hook line from the first line of text", async () => {
    const entry = await saveHook("Most founders think growth is about volume.\nIt isn't.", "contrarian", 78, "manual")
    expect(entry.hook).toBe("Most founders think growth is about volume.")
    expect(entry.fullText).toContain("It isn't.")
    expect(entry.source).toBe("manual")
    const loaded = await loadHooks()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe(entry.id)
  })

  it("re-saving the same text refreshes the existing entry instead of duplicating it", async () => {
    const first = await saveHook("Same text here", "data_reveal", 60, "manual")
    const second = await saveHook("Same text here", "data_reveal", 85, "auto")
    expect(second.id).toBe(first.id)
    expect(second.score).toBe(85)
    expect(second.source).toBe("auto")
    const loaded = await loadHooks()
    expect(loaded).toHaveLength(1)
  })

  it("caps at 50 hooks, evicting the oldest", async () => {
    for (let i = 0; i < 55; i++) {
      await saveHook(`hook text ${i}`, null, 50, "manual")
    }
    const loaded = await loadHooks()
    expect(loaded).toHaveLength(50)
    expect(loaded[0].fullText).toBe("hook text 54")
  })

  it("deleteHook removes only the matching entry", async () => {
    await saveHook("keep me", null, 50, "manual")
    const toDelete = await saveHook("delete me", null, 50, "manual")
    await deleteHook(toDelete.id)
    const loaded = await loadHooks()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].fullText).toBe("keep me")
  })
})
