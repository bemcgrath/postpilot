import { describe, expect, it } from "vitest"

import { classifyComposerSignals } from "../src/scoring/reply-context"
import type { ComposerSignals } from "../src/scoring/reply-context"

function makeSignals(overrides: Partial<ComposerSignals> = {}): ComposerSignals {
  return {
    hasReplyingToText: false,
    precededByTweetArticle: false,
    inDialog: false,
    pathname: "/home",
    hasReplyToParam: false,
    ...overrides
  }
}

describe("classifyComposerSignals", () => {
  it("hasReplyingToText beats a home pathname", () => {
    expect(
      classifyComposerSignals(
        makeSignals({ hasReplyingToText: true, pathname: "/home" })
      )
    ).toBe("reply")
  })

  it("the compose/post pathname is original with no other signal", () => {
    expect(
      classifyComposerSignals(makeSignals({ pathname: "/compose/post" }))
    ).toBe("original")
  })

  it("a status-page pathname is a reply", () => {
    expect(
      classifyComposerSignals(makeSignals({ pathname: "/brian/status/123" }))
    ).toBe("reply")
  })

  it("the home pathname alone is original", () => {
    expect(classifyComposerSignals(makeSignals({ pathname: "/home" }))).toBe(
      "original"
    )
  })

  it("no signals and an unrecognized pathname is unknown", () => {
    expect(
      classifyComposerSignals(makeSignals({ pathname: "/some/other/page" }))
    ).toBe("unknown")
  })

  it("regression: an /intent/post?in_reply_to=... reply is a reply even with no DOM signals", () => {
    // Real bug: this pathname matches neither the compose/post nor the
    // status-page pattern, so without hasReplyToParam it fell through to
    // "unknown" -- and from there scored as an original, applying the
    // questionNoNumbers penalty to a genuine reply.
    expect(
      classifyComposerSignals(
        makeSignals({ pathname: "/intent/post", hasReplyToParam: true })
      )
    ).toBe("reply")
  })
})
