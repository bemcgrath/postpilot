import type { CollectedPost } from "./types"

export type PostSegment = "original" | "reply" | "unknown"

/**
 * Mirrors the isReply === false convention from best-posts.ts: posts collected
 * before reply detection existed have no isReply field, and !undefined is true,
 * so "unknown" must be its own bucket rather than folded into originals.
 * A leading @handle is treated as a reply signal even when isReply is missing --
 * Atlas's is_reply_row fallback -- which recovers some "unknown" posts for free.
 */
export function segmentOf(post: CollectedPost): PostSegment {
  if (post.isReply === true) return "reply"
  if (post.isReply === false) return "original"
  if (/^@\w+/.test(post.text.trimStart())) return "reply"
  return "unknown"
}

export function partitionPosts(posts: CollectedPost[]): {
  originals: CollectedPost[]
  replies: CollectedPost[]
  unknown: CollectedPost[]
} {
  const originals: CollectedPost[] = []
  const replies: CollectedPost[] = []
  const unknown: CollectedPost[] = []

  for (const post of posts) {
    const segment = segmentOf(post)
    if (segment === "original") originals.push(post)
    else if (segment === "reply") replies.push(post)
    else unknown.push(post)
  }

  return { originals, replies, unknown }
}
