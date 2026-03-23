import { describe, expect, it } from "vitest"
import { extractTopics } from "~learning/topic-extractor"

describe("extractTopics", () => {
  it("extracts meaningful keywords from post text", () => {
    const topics = extractTopics(
      "Building AI agents with Claude for automated content generation"
    )
    expect(topics).toContain("building")
    expect(topics).toContain("agents")
    expect(topics).toContain("claude")
    expect(topics).toContain("automated")
  })

  it("filters out stop words", () => {
    const topics = extractTopics("This is a test of the extraction system")
    expect(topics).not.toContain("this")
    expect(topics).not.toContain("the")
    expect(topics).toContain("test")
    expect(topics).toContain("extraction")
    expect(topics).toContain("system")
  })

  it("filters out social media noise words", () => {
    const topics = extractTopics(
      "RT this tweet for more followers and engagement on twitter"
    )
    expect(topics).not.toContain("tweet")
    expect(topics).not.toContain("followers")
    expect(topics).not.toContain("engagement")
    expect(topics).not.toContain("twitter")
  })

  it("removes URLs before extraction", () => {
    const topics = extractTopics(
      "Check out this AI tool https://example.com/some-path for automation"
    )
    expect(topics).not.toContain("https")
    expect(topics).not.toContain("example")
    expect(topics).toContain("tool")
    expect(topics).toContain("automation")
  })

  it("returns empty array for short text", () => {
    expect(extractTopics("hi")).toEqual([])
    expect(extractTopics("")).toEqual([])
  })

  it("excludes pure numbers", () => {
    const topics = extractTopics("Testing 123 production systems 456")
    expect(topics).not.toContain("123")
    expect(topics).not.toContain("456")
    expect(topics).toContain("testing")
    expect(topics).toContain("production")
  })

  it("limits to 10 keywords", () => {
    const longText =
      "artificial intelligence machine learning neural networks deep learning transformers attention mechanisms embedding vectors tokenization preprocessing normalization optimization convergence"
    const topics = extractTopics(longText)
    expect(topics.length).toBeLessThanOrEqual(10)
  })

  it("deduplicates keywords", () => {
    const topics = extractTopics("AI agents building AI agents for AI")
    const unique = new Set(topics)
    expect(topics.length).toBe(unique.size)
  })
})
