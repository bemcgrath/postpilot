import type { CollectedPost } from "./types"
import { classifyCollectedText } from "./collector"

export type CsvImportResult =
  | { ok: true; posts: CollectedPost[]; skipped: number }
  | { ok: false; error: string }

const TEXT_ALIASES = ["tweet text", "tweet_text", "text", "post text", "post"]
const ID_ALIASES = ["tweet id", "tweet_id", "tweetid", "id"]
const PERMALINK_ALIASES = [
  "tweet permalink",
  "permalink",
  "tweet url",
  "url",
  "link",
  "tweet link"
]
const TIME_ALIASES = [
  "time",
  "date",
  "datetime",
  "created at",
  "time posted",
  "posted at",
  "timestamp"
]
const IMPRESSIONS_ALIASES = ["impressions", "views", "impression"]
const LIKES_ALIASES = ["likes", "like", "favorites", "favourites"]
const RETWEETS_ALIASES = ["retweets", "retweet", "reposts", "repost"]
const REPLIES_ALIASES = ["replies", "reply"]
const QUOTES_ALIASES = ["quotes", "quote tweets", "quote tweet", "quoted tweets", "quote"]
const MEDIA_VIEWS_ALIASES = ["media views", "media view"]
const VIDEO_VIEWS_ALIASES = ["video views", "video view"]
const URL_CLICKS_ALIASES = ["url clicks", "link clicks", "url click", "link click"]
const REPLY_TO_ALIASES = [
  "in reply to",
  "in-reply-to status id",
  "in reply to status id",
  "reply to",
  "tweet type",
  "type"
]

function normHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
}

/** RFC4180-ish CSV split. Handles quoted commas, escaped quotes, and CRLF. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else if (c !== "\r") {
      field += c
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""))
}

function findColumn(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normHeader)
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias)
    if (idx >= 0) return idx
  }
  return -1
}

function parseNumber(raw: string): number {
  const cleaned = raw.replace(/[%$\s]/g, "").replace(/,/g, "")
  if (!cleaned) return 0
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

/**
 * X Analytics times look like `2024-03-15 18:42 +0000`.
 * Also accepts ISO-8601.
 */
export function parseAnalyticsTime(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const classic = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(?:\s*([+-]\d{4}|Z))?/
  )
  if (classic) {
    const time = classic[2].length === 5 ? `${classic[2]}:00` : classic[2]
    const tzRaw = classic[3] ?? "Z"
    const tz =
      tzRaw === "Z" ? "Z" : tzRaw.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
    const ts = Date.parse(`${classic[1]}T${time}${tz}`)
    return Number.isNaN(ts) ? null : ts
  }

  const iso = Date.parse(trimmed)
  return Number.isNaN(iso) ? null : iso
}

function resolveTweetId(idRaw: string, permalink: string): string | null {
  const fromLink = permalink.match(/\/status\/(\d+)/)
  if (fromLink) return fromLink[1]
  const trimmed = idRaw.trim()
  if (/^\d+$/.test(trimmed)) return trimmed
  return null
}

function cell(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? "") : ""
}

function isReplyRow(text: string, replyToRaw: string): boolean {
  const marker = replyToRaw.trim().toLowerCase()
  if (marker === "reply" || marker === "replies") return true
  if (/^\d+$/.test(marker)) return true
  if (marker && marker !== "tweet" && marker !== "original" && marker !== "0") {
    // Non-empty in-reply-to handle or status id
    if (marker !== "null" && marker !== "n/a" && marker !== "false") return true
  }
  return /^@\w+/.test(text.trimStart())
}

/**
 * Parse a tweet-level X Analytics CSV into CollectedPost records.
 * Rejects by-day summaries. Does not apply the 24h DOM age gate.
 */
export function parseAnalyticsCsv(csvText: string, now = Date.now()): CsvImportResult {
  const rows = parseCsv(csvText)
  if (rows.length < 2) {
    return {
      ok: false,
      error: "This file is empty or has no data rows."
    }
  }

  const headers = rows[0]
  const textIdx = findColumn(headers, TEXT_ALIASES)
  const idIdx = findColumn(headers, ID_ALIASES)
  const permalinkIdx = findColumn(headers, PERMALINK_ALIASES)
  const timeIdx = findColumn(headers, TIME_ALIASES)
  const impressionsIdx = findColumn(headers, IMPRESSIONS_ALIASES)

  if (textIdx < 0 || impressionsIdx < 0 || (idIdx < 0 && permalinkIdx < 0)) {
    return {
      ok: false,
      error:
        "Need a tweet-level Analytics export with Tweet id (or permalink), Tweet text, and impressions — not the by-day summary."
    }
  }

  if (timeIdx < 0) {
    return {
      ok: false,
      error: "This CSV is missing a time/date column."
    }
  }

  const likesIdx = findColumn(headers, LIKES_ALIASES)
  const retweetsIdx = findColumn(headers, RETWEETS_ALIASES)
  const repliesIdx = findColumn(headers, REPLIES_ALIASES)
  const quotesIdx = findColumn(headers, QUOTES_ALIASES)
  const mediaViewsIdx = findColumn(headers, MEDIA_VIEWS_ALIASES)
  const videoViewsIdx = findColumn(headers, VIDEO_VIEWS_ALIASES)
  const urlClicksIdx = findColumn(headers, URL_CLICKS_ALIASES)
  const replyToIdx = findColumn(headers, REPLY_TO_ALIASES)

  const posts: CollectedPost[] = []
  const seen = new Set<string>()
  let skipped = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const text = cell(row, textIdx).trim()
    const tweetId = resolveTweetId(cell(row, idIdx), cell(row, permalinkIdx))
    const postedAt = parseAnalyticsTime(cell(row, timeIdx))
    const impressions = Math.round(parseNumber(cell(row, impressionsIdx)))

    if (!text || !tweetId || postedAt == null || impressions <= 0) {
      skipped++
      continue
    }
    if (seen.has(tweetId)) {
      skipped++
      continue
    }
    seen.add(tweetId)

    const likes = Math.round(parseNumber(cell(row, likesIdx)))
    const retweets = Math.round(parseNumber(cell(row, retweetsIdx)))
    const replies = Math.round(parseNumber(cell(row, repliesIdx)))
    const quotes = Math.round(parseNumber(cell(row, quotesIdx)))
    const mediaViews = parseNumber(cell(row, mediaViewsIdx))
    const videoViews = parseNumber(cell(row, videoViewsIdx))
    const urlClicks = parseNumber(cell(row, urlClicksIdx))
    const { hookType, hookScore, topics } = classifyCollectedText(text)

    posts.push({
      tweetId,
      text,
      impressions,
      likes,
      retweets,
      replies,
      quotes,
      engagementRate: (likes + retweets + replies + quotes) / impressions,
      postedAt,
      collectedAt: now,
      charCount: text.length,
      hasImage: mediaViews > 0,
      hasVideo: videoViews > 0,
      hasLink: urlClicks > 0 || /https?:\/\//i.test(text),
      isReply: isReplyRow(text, cell(row, replyToIdx)),
      hookType,
      hookScore,
      topics
    })
  }

  if (posts.length === 0) {
    return {
      ok: false,
      error:
        skipped > 0
          ? "No usable rows — need tweet text, an id/permalink, a timestamp, and impressions above 0."
          : "No tweet rows found in this file."
    }
  }

  return { ok: true, posts, skipped }
}
