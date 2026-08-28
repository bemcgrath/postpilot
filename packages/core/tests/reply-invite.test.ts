import { describe, expect, it } from "vitest"
import { scoreReplyInvite } from "~scoring/reply-invite"

describe("scoreReplyInvite", () => {
  it("flags thoughts? as bait, not an invite", () => {
    expect(scoreReplyInvite("Shipping the agent today. thoughts?")).toEqual({
      kind: "bait",
      label: "Reply bait"
    })
  })

  it("treats a specific question as an invite", () => {
    const result = scoreReplyInvite(
      "We tried 3 RAG setups on the same 200-doc corpus. Which retrieval actually held up for you?"
    )
    expect(result.kind).toBe("invite")
  })

  it("treats a claim with no question as a broadcast", () => {
    expect(scoreReplyInvite("The bottleneck is labeled neural recordings, not compute.")).toEqual({
      kind: "broadcast",
      label: "Broadcast"
    })
  })
})
