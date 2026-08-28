import { describe, expect, it } from "vitest"

import { resolveUserHandle } from "../src/learning/user-detector"

describe("resolveUserHandle", () => {
  it("prefers a fresh detection over the cache", () => {
    const result = resolveUserHandle("brianmcgrath", "BrianEMcGrath")
    expect(result.handle).toBe("brianmcgrath")
  })

  it("flags the cache for update when detection disagrees with it", () => {
    // Regression: this is the exact real-world case that froze post
    // collection for months with zero visible errors -- a renamed X
    // handle silently invalidated every isOwnPost() check.
    const result = resolveUserHandle("brianmcgrath", "BrianEMcGrath")
    expect(result.shouldUpdateCache).toBe(true)
  })

  it("does not flag an update when detection matches the cache", () => {
    const result = resolveUserHandle("brianmcgrath", "brianmcgrath")
    expect(result.shouldUpdateCache).toBe(false)
  })

  it("falls back to the cache when detection fails, and does not flag an update", () => {
    const result = resolveUserHandle(null, "brianmcgrath")
    expect(result.handle).toBe("brianmcgrath")
    expect(result.shouldUpdateCache).toBe(false)
  })

  it("returns null with no cache and no detection", () => {
    const result = resolveUserHandle(null, null)
    expect(result.handle).toBeNull()
    expect(result.shouldUpdateCache).toBe(false)
  })
})
