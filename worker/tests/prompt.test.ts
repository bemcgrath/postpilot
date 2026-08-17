import { describe, expect, it } from "vitest"
import { buildSystemPrompt, buildUserContent, parseRewrites } from "../src/prompt"
import type { RewriteRequestBody } from "../src/types"

const baseBody: RewriteRequestBody = {
  identity: { type: "device", deviceId: "dev-1" },
  originalText: "The bottleneck is labeled recordings, not compute.",
  isReply: false,
  hookInfo: "Declarative claim hook — score 62/100",
  governorLines: "",
  suggestionLines: "- Add specific numbers for credibility",
  count: 1
}

describe("buildSystemPrompt", () => {
  it("optimizes for engagement, not the badge", () => {
    const prompt = buildSystemPrompt(1)
    expect(prompt).toMatch(/more engaging/)
    expect(prompt).toMatch(/stops scrolling/)
    expect(prompt).not.toMatch(/HOW THE BADGE SCORES/)
  })

  it("treats invented studies as a bad engagement pattern", () => {
    const prompt = buildSystemPrompt(1)
    expect(prompt).toMatch(/I tracked/)
    expect(prompt).toMatch(/here's what I found/)
    expect(prompt).toMatch(/Fake specificity is bait/)
  })

  it("requires a complete first-line hook on original posts, not replies", () => {
    const prompt = buildSystemPrompt(1)
    expect(prompt).toMatch(/For original posts \(not replies\): line 1 is a complete hook/)
    expect(prompt).toMatch(/Do not open with a fragment/)
    expect(prompt).toMatch(/For replies: do not impose post stanza layout/)
  })
})

describe("buildUserContent", () => {
  it("asks for a more engaging original, not a fabricated study", () => {
    const text = buildUserContent(baseBody)
    expect(text).toMatch(/GOAL: a more engaging version/)
    expect(text).toMatch(/Don't invent a tracking study/)
    expect(text).not.toMatch(/builder proof second/)
  })

  it("includes learned engagement lines when present", () => {
    const text = buildUserContent({
      ...baseBody,
      engagementLines: "Lean in: Contrarian (1.40x)\nAvoid: Question (0.70x)"
    })
    expect(text).toMatch(/WHAT EARNS ENGAGEMENT FOR THIS WRITER/)
    expect(text).toMatch(/Lean in: Contrarian/)
    expect(text).toMatch(/Avoid: Question/)
  })

  it("passes the originals length band when present", () => {
    const text = buildUserContent({ ...baseBody, band: { min: 280, max: 320 } })
    expect(text).toMatch(/280-320/)
  })

  it("keeps reply craft guidance", () => {
    const text = buildUserContent({
      ...baseBody,
      isReply: true,
      band: { min: 60, max: 160 }
    })
    expect(text).toMatch(/This is a reply/)
    expect(text).toMatch(/60-160/)
  })

  it("asks for a complete first-line hook on originals", () => {
    const text = buildUserContent(baseBody)
    expect(text).toMatch(/Line 1 is the hook: a complete claim/)
  })

  it("asks to keep stanza layout when an original has line breaks", () => {
    const text = buildUserContent({
      ...baseBody,
      originalText: "Line one.\n\nLine two.\nLine three."
    })
    expect(text).toMatch(/this draft uses 3 line breaks/)
    expect(text).toMatch(/After a complete hook on line 1/)
  })

  it("does not impose stanza format on replies", () => {
    const text = buildUserContent({
      ...baseBody,
      isReply: true,
      originalText: "Line one.\n\nLine two.\nLine three.",
      voiceDigest: {
        distinctiveTerms: ["bottleneck"],
        sentenceLengthTarget: 11,
        firstPersonRatio: 0.4,
        secondPersonRatio: 0.1,
        topHookTypes: ["declarative_claim"],
        fragmentRatio: 0.42,
        lineBreaksPerPost: 4.2,
        usesColons: 0.5,
        usesLists: 0.1
      }
    })
    expect(text).toMatch(/Do not rewrite it as a stanza original/)
    expect(text).not.toMatch(/this draft uses 3 line breaks/)
    expect(text).not.toMatch(/Typical line breaks per post/)
    expect(text).not.toMatch(/Short fragments/)
  })

  it("includes Voice Match layout stats when present", () => {
    const text = buildUserContent({
      ...baseBody,
      voiceDigest: {
        distinctiveTerms: ["bottleneck"],
        sentenceLengthTarget: 11,
        firstPersonRatio: 0.4,
        secondPersonRatio: 0.1,
        topHookTypes: ["declarative_claim"],
        fragmentRatio: 0.42,
        lineBreaksPerPost: 4.2,
        usesColons: 0.5,
        usesLists: 0.1
      }
    })
    expect(text).toMatch(/Short fragments/)
    expect(text).toMatch(/42%/)
    expect(text).toMatch(/Typical line breaks per post: ~4/)
    expect(text).toMatch(/Colons: often/)
    expect(text).toMatch(/Lists: rarely/)
  })
})

describe("parseRewrites", () => {
  it("extracts rewrites from a JSON object", () => {
    const out = parseRewrites('{"rewrites":[{"text":"hi","rationale":"x"}]}')
    expect(out).toEqual([{ text: "hi", rationale: "x" }])
  })

  it("throws PARSE_ERROR on truncated JSON", () => {
    expect(() => parseRewrites('{"rewrites":[{"text":"hi"')).toThrow("PARSE_ERROR")
  })
})
