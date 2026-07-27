import { describe, expect, it } from "vitest"

import { classifyComposerSignals } from "../src/scoring/reply-context"
import type { ComposerSignals } from "../src/scoring/reply-context"

function makeSignals(overrides: Partial<ComposerSignals> = {}): ComposerSignals {
  return {
    hasReplyingToText: false,
    precededByTweetArticle: false,
    inDialog: false,
    pathname: "/home",
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
})
