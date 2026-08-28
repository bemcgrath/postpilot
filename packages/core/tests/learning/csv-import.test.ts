import { describe, expect, it } from "vitest"
import { parseAnalyticsCsv, parseAnalyticsTime, parseCsv } from "~learning/csv-import"

const CLASSIC_HEADER =
  "Tweet id,Tweet permalink,Tweet text,time,impressions,engagements,engagement rate,retweets,replies,likes,user profile clicks,url clicks,hashtag clicks,detail expands,permalink clicks,app opens,app installs,follows,email tweet,dial phone,media views,media engagements"

describe("parseCsv", () => {
  it("splits quoted commas and escaped quotes", () => {
    const rows = parseCsv('a,b\n"hello, world","she said ""hi"""\n')
    expect(rows[1]).toEqual(["hello, world", 'she said "hi"'])
  })

  it("keeps newlines inside quotes", () => {
    const rows = parseCsv('col\n"line1\nline2"\n')
    expect(rows[1][0]).toBe("line1\nline2")
  })
})

describe("parseAnalyticsTime", () => {
  it("parses classic X Analytics timestamps", () => {
    expect(parseAnalyticsTime("2024-03-15 18:42 +0000")).toBe(
      Date.parse("2024-03-15T18:42:00+00:00")
    )
  })

  it("parses ISO-8601", () => {
    expect(parseAnalyticsTime("2024-03-15T18:42:00.000Z")).toBe(
      Date.parse("2024-03-15T18:42:00.000Z")
    )
  })

  it("returns null for empty", () => {
    expect(parseAnalyticsTime("")).toBeNull()
    expect(parseAnalyticsTime("not a date")).toBeNull()
  })
})

describe("parseAnalyticsCsv", () => {
  it("imports a classic tweet-level Analytics export", () => {
    const csv = [
      CLASSIC_HEADER,
      [
        "1234567890123456789",
        "https://twitter.com/me/status/1234567890123456789",
        '"Hello, world https://example.com"',
        "2024-03-15 18:42 +0000",
        "1500",
        "50",
        "0.033",
        "10",
        "5",
        "30",
        "2",
        "4",
        "0",
        "8",
        "1",
        "0",
        "0",
        "0",
        "0",
        "0",
        "200",
        "12"
      ].join(",")
    ].join("\n")

    const result = parseAnalyticsCsv(csv, 1_700_000_000_000)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.posts).toHaveLength(1)
    expect(result.skipped).toBe(0)
    const post = result.posts[0]
    expect(post.tweetId).toBe("1234567890123456789")
    expect(post.text).toBe("Hello, world https://example.com")
    expect(post.impressions).toBe(1500)
    expect(post.likes).toBe(30)
    expect(post.retweets).toBe(10)
    expect(post.replies).toBe(5)
    expect(post.engagementRate).toBeCloseTo(45 / 1500)
    expect(post.postedAt).toBe(Date.parse("2024-03-15T18:42:00+00:00"))
    expect(post.collectedAt).toBe(1_700_000_000_000)
    expect(post.hasImage).toBe(true)
    expect(post.hasLink).toBe(true)
    expect(post.isReply).toBe(false)
    expect(post.charCount).toBe(post.text.length)
  })

  it("recovers tweet id from permalink when Excel destroyed the id", () => {
    const csv = [
      "Tweet id,Tweet permalink,Tweet text,time,impressions,likes",
      "1.23457E+18,https://x.com/me/status/1234567890123456789,Hello,2024-03-15 18:42 +0000,100,2"
    ].join("\n")
    const result = parseAnalyticsCsv(csv)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.posts[0].tweetId).toBe("1234567890123456789")
  })

  it("skips zero-impression rows and does not apply a 24h age gate", () => {
    const csv = [
      "Tweet id,Tweet text,time,impressions,likes",
      "1,Fresh post,2099-01-01 00:00 +0000,80,1",
      "2,No views,2020-01-01 00:00 +0000,0,0"
    ].join("\n")
    const result = parseAnalyticsCsv(csv)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0].tweetId).toBe("1")
    expect(result.skipped).toBe(1)
  })

  it("treats a leading @handle as a reply", () => {
    const csv = [
      "Tweet id,Tweet text,time,impressions,likes",
      "1,@alice nice take,2024-03-15 18:42 +0000,40,2"
    ].join("\n")
    const result = parseAnalyticsCsv(csv)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.posts[0].isReply).toBe(true)
  })

  it("rejects a by-day summary", () => {
    const csv = [
      "Date,Tweets published,impressions,engagements",
      "2024-03-15,3,12000,400"
    ].join("\n")
    const result = parseAnalyticsCsv(csv)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/tweet-level/i)
  })

  it("maps reposts and quote-tweet columns", () => {
    const csv = [
      "Tweet id,Tweet text,time,impressions,reposts,quote tweets,replies,likes",
      "9,A claim,2024-03-15 18:42 +0000,200,4,1,2,10"
    ].join("\n")
    const result = parseAnalyticsCsv(csv)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.posts[0].retweets).toBe(4)
    expect(result.posts[0].quotes).toBe(1)
    expect(result.posts[0].engagementRate).toBeCloseTo(17 / 200)
  })
})
