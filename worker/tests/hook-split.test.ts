import { describe, expect, it } from "vitest"
import { firstLineOf, splitHookBody, stitchHook } from "../src/hook-split"

describe("splitHookBody", () => {
  it("treats the first line as the hook when there is a newline", () => {
    expect(splitHookBody("The bottleneck is labels.\n\nNot compute.")).toEqual({
      hook: "The bottleneck is labels.",
      rest: "\n\nNot compute.",
    })
  })

  it("keeps a short single-block post as the hook", () => {
    expect(splitHookBody("The bottleneck is labeled recordings.")).toEqual({
      hook: "The bottleneck is labeled recordings.",
      rest: "",
    })
  })

  it("splits a long single-block post on the first sentence", () => {
    const rest =
      " The rest of this paragraph keeps going with more detail about the same claim and why it matters in practice."
    const hook = "Labeled recordings are the bottleneck, not compute."
    expect(splitHookBody(hook + rest)).toEqual({ hook, rest })
  })
})

describe("stitchHook", () => {
  it("prefixes the frozen remainder, including leading newlines", () => {
    expect(stitchHook("A sharper claim.", "\n\nNot compute.")).toBe(
      "A sharper claim.\n\nNot compute."
    )
  })

  it("drops extra lines the model stuffed into text", () => {
    expect(stitchHook("A sharper claim.\n\nI also rewrote the body.", "\n\nNot compute.")).toBe(
      "A sharper claim.\n\nNot compute."
    )
  })

  it("returns only the new hook when there is no frozen body", () => {
    expect(stitchHook("A sharper claim.", "")).toBe("A sharper claim.")
  })
})

describe("firstLineOf", () => {
  it("flattens internal whitespace on the first line", () => {
    expect(firstLineOf("  A   sharper\tclaim.  \nbody")).toBe("A sharper claim.")
  })
})
