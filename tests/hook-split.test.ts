import { describe, expect, it } from "vitest"
import { splitHookBody } from "../src/rewrite/hook-split"

describe("splitHookBody", () => {
  it("treats the first line as the hook when there is a newline", () => {
    expect(splitHookBody("The bottleneck is labels.\n\nNot compute.")).toEqual({
      hook: "The bottleneck is labels.",
      rest: "\n\nNot compute.",
    })
  })
})
