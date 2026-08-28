import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { installPlatform, resetPlatform } from "../src/storage/adapter"
import { createMemoryPlatform } from "../src/storage/memory-store"
import { deleteDraft, loadDrafts, saveDraft } from "../src/drafts/draft-storage"

// First real coverage for this module -- previously untestable, since
// getStorage() had nothing to inject and always fell through to the
// null-storage default in the test/node environment.

beforeEach(() => {
  installPlatform(createMemoryPlatform())
})

afterEach(() => {
  resetPlatform()
})

describe("draft-storage", () => {
  it("starts empty", async () => {
    expect(await loadDrafts()).toEqual([])
  })

  it("saves a draft and prepends it on load", async () => {
    await saveDraft("first draft", 72, "data_reveal")
    const drafts = await loadDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({ text: "first draft", score: 72, hookType: "data_reveal" })
    expect(typeof drafts[0].id).toBe("string")
    expect(drafts[0].id.length).toBeGreaterThan(0)
  })

  it("prepends newest first", async () => {
    await saveDraft("older", 50, null)
    await saveDraft("newer", 60, null)
    const drafts = await loadDrafts()
    expect(drafts.map((d) => d.text)).toEqual(["newer", "older"])
  })

  it("caps at 20 drafts, evicting the oldest", async () => {
    for (let i = 0; i < 25; i++) {
      await saveDraft(`draft ${i}`, 50, null)
    }
    const drafts = await loadDrafts()
    expect(drafts).toHaveLength(20)
    // Most recent (draft 24) first; oldest five (0-4) evicted.
    expect(drafts[0].text).toBe("draft 24")
    expect(drafts.map((d) => d.text)).not.toContain("draft 0")
    expect(drafts.map((d) => d.text)).not.toContain("draft 4")
  })

  it("deleteDraft removes only the matching entry", async () => {
    const a = await saveDraft("a", 50, null)
    await saveDraft("b", 50, null)
    await deleteDraft(a.id)
    const drafts = await loadDrafts()
    expect(drafts.map((d) => d.text)).toEqual(["b"])
  })
})
