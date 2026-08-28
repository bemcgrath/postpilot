/** Common stop words to exclude from topic extraction. */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "can", "shall", "must", "need",
  "that", "this", "these", "those", "it", "its", "he", "she", "they",
  "we", "you", "i", "me", "my", "your", "his", "her", "our", "their",
  "them", "us", "what", "which", "who", "whom", "how", "when", "where",
  "why", "if", "then", "than", "so", "no", "not", "only", "just", "also",
  "more", "most", "very", "too", "really", "about", "into", "over",
  "after", "before", "between", "through", "during", "up", "down", "out",
  "off", "all", "each", "every", "both", "few", "many", "much", "some",
  "any", "other", "new", "old", "first", "last", "long", "great", "little",
  "own", "same", "big", "even", "still", "back", "here", "there", "now",
  "get", "got", "make", "made", "go", "going", "gone", "come", "take",
  "see", "know", "think", "want", "like", "look", "use", "find", "give",
  "tell", "say", "said", "way", "thing", "things", "one", "two", "don",
  "doesn", "didn", "won", "isn", "aren", "wasn", "weren", "hasn", "haven",
  "re", "ve", "ll", "let", "put", "keep", "try", "start", "s", "t", "m",
  "d", "people", "time", "year", "years", "day", "days", "week", "weeks",
  "month", "months", "today", "yesterday", "tomorrow", "already", "never",
  "always", "ever", "yet", "ago", "since"
])

/** Social media noise words to filter out. */
const SOCIAL_NOISE = new Set([
  "rt", "dm", "thread", "tweet", "post", "retweet", "follow", "followers",
  "following", "trending", "viral", "engagement", "impressions", "likes",
  "share", "comment", "subscribe", "content", "audience", "platform",
  "twitter", "x", "https", "http", "www", "com", "co"
])

/**
 * Extract topic keywords from post text.
 * Returns lowercase keywords sorted by likely relevance.
 */
export function extractTopics(text: string): string[] {
  if (!text || text.length < 10) return []

  // Remove URLs
  const cleaned = text.replace(/https?:\/\/\S+/gi, "")

  // Tokenize: split on non-alphanumeric, keep words 3+ chars
  const words = cleaned
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length >= 3)
    .filter((w) => !STOP_WORDS.has(w))
    .filter((w) => !SOCIAL_NOISE.has(w))
    .filter((w) => !/^\d+$/.test(w)) // exclude pure numbers

  // Deduplicate and return
  return [...new Set(words)].slice(0, 10)
}
