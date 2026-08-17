/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "fs"
import path from "path"
import { describe, expect, it } from "vitest"
import { COMPOSE_SELECTORS, TWEET_SELECTORS, detectComposeMedia } from "~scoring/compose-media"
import { inspectOwnArticle } from "~learning/collector"

function loadFixture(name: string): string {
  return readFileSync(path.resolve(__dirname, "fixtures", name), "utf8")
}

describe("compose DOM fixture", () => {
  it("finds toolBar, tweetTextarea_0, and attachments", () => {
    document.documentElement.innerHTML = loadFixture("compose.html")
    expect(document.querySelector(COMPOSE_SELECTORS.toolbar)).not.toBeNull()
    expect(document.querySelector(COMPOSE_SELECTORS.textarea)).not.toBeNull()
    expect(document.querySelector(COMPOSE_SELECTORS.contentEditable)?.textContent).toBe(
      "Draft text here"
    )
    expect(document.querySelector(COMPOSE_SELECTORS.tweetButton)).not.toBeNull()

    const compose = document.querySelector(".compose")
    const media = detectComposeMedia(compose, "Draft text here https://example.com")
    expect(media.hasImage).toBe(true)
    expect(media.hasLink).toBe(true)
  })

  it("does not treat parent photos, avatars, or in-text emoji imgs as attachments", () => {
    document.documentElement.innerHTML = loadFixture("reply-compose.html")
    const dialog = document.querySelector(".reply-dialog")
    const media = detectComposeMedia(dialog, "A text-only reply")
    expect(media.hasImage).toBe(false)
    expect(media.hasVideo).toBe(false)
    expect(media.hasLink).toBe(false)
  })
})

describe("own-tweet analytics fixture", () => {
  it("collects an aged own post with impressions", () => {
    document.documentElement.innerHTML = loadFixture("own-tweet.html")
    const article = document.querySelector(TWEET_SELECTORS.article)
    expect(article).not.toBeNull()
    expect(article!.querySelector(TWEET_SELECTORS.analytics)).not.toBeNull()
    expect(article!.querySelector(TWEET_SELECTORS.tweetText)?.textContent).toMatch(
      /bottleneck/
    )

    const result = inspectOwnArticle(
      article!,
      "alice",
      Date.parse("2024-03-16T18:42:00.000Z")
    )
    expect(result.kind).toBe("collect")
    if (result.kind !== "collect") return
    expect(result.post.tweetId).toBe("1234567890123456789")
    expect(result.post.impressions).toBe(1200)
    expect(result.post.hasImage).toBe(true)
  })
})
