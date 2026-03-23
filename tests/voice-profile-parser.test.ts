import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

import {
  fingerprintFromProfile,
  mergeProfileIntoFingerprint,
  parseVoiceProfile
} from "../src/scoring/voice-profile-parser"
import { extractFingerprint } from "../src/scoring/voice-fingerprint"

// Load real profile files for testing
const VOICE_PROFILE = readFileSync(
  join("C:", "Projects", "SocialMediaAssistant", "memory", "voice_profile.md"),
  "utf-8"
)
const NICHE_SPEC = readFileSync(
  join("C:", "Projects", "SocialMediaAssistant", "memory", "niche_spec.md"),
  "utf-8"
)

describe("parseVoiceProfile", () => {
  const profile = parseVoiceProfile(VOICE_PROFILE, NICHE_SPEC)

  it("extracts niche keywords", () => {
    expect(profile.nicheKeywords.length).toBeGreaterThan(5)
    const terms = profile.nicheKeywords.map((k) => k.term)
    expect(terms).toContain("agentic")
    expect(terms).toContain("longevity")
    expect(terms).toContain("healthspan")
  })

  it("extracts hook type rankings", () => {
    expect(profile.topHookTypes.length).toBeGreaterThan(0)
    expect(profile.topHookTypes.length).toBeLessThanOrEqual(5)
    // #1 in the profile is "Personal Transformation" → before_after
    expect(profile.topHookTypes[0]).toBe("before_after")
  })

  it("builds hook type distribution", () => {
    const entries = Object.entries(profile.hookTypeDistribution)
    expect(entries.length).toBeGreaterThan(0)
    // First entry should have highest weight
    const firstType = profile.topHookTypes[0]
    expect(profile.hookTypeDistribution[firstType]).toBeGreaterThan(0.2)
  })

  it("extracts preferred length (280-320)", () => {
    expect(profile.preferredLength).not.toBeNull()
    expect(profile.preferredLength!.mean).toBe(300)
    expect(profile.preferredLength!.min).toBe(280)
    expect(profile.preferredLength!.max).toBe(320)
  })

  it("detects first-person voice", () => {
    expect(profile.firstPersonRatio).not.toBeNull()
    expect(profile.firstPersonRatio!).toBeGreaterThanOrEqual(0.5)
  })

  it("detects reader-directed tone", () => {
    expect(profile.secondPersonRatio).not.toBeNull()
    expect(profile.secondPersonRatio!).toBeGreaterThanOrEqual(0.3)
  })

  it("detects colon usage preference", () => {
    expect(profile.usesColons).not.toBeNull()
    expect(profile.usesColons!).toBeGreaterThan(0.3)
  })

  it("detects fragment/short sentence preference", () => {
    expect(profile.fragmentRatio).not.toBeNull()
    expect(profile.fragmentRatio!).toBeGreaterThan(0)
  })

  it("detects conversational formality", () => {
    expect(profile.formalityScore).not.toBeNull()
    // Profile says "conversational tone" and "analytical"
    expect(profile.formalityScore!).toBeLessThanOrEqual(0.6)
  })

  it("extracts distinctive vocabulary terms", () => {
    expect(profile.distinctiveTerms.length).toBeGreaterThan(0)
    const terms = profile.distinctiveTerms.map((t) => t.term)
    expect(terms).toContain("bottleneck")
    expect(terms).toContain("compounding")
  })
})

describe("fingerprintFromProfile", () => {
  const profile = parseVoiceProfile(VOICE_PROFILE, NICHE_SPEC)
  const fp = fingerprintFromProfile(profile)

  it("creates valid fingerprint with sampleCount 0", () => {
    expect(fp.sampleCount).toBe(0)
    expect(fp.generatedAt).toBeGreaterThan(0)
  })

  it("has niche keywords from profile", () => {
    expect(fp.nicheKeywords.length).toBeGreaterThan(5)
  })

  it("has hook types from profile", () => {
    expect(fp.topHookTypes.length).toBeGreaterThan(0)
  })

  it("has preferred length", () => {
    expect(fp.postLength.mean).toBe(300)
  })

  it("has tone signals from profile", () => {
    expect(fp.firstPersonRatio).toBeGreaterThanOrEqual(0.5)
    expect(fp.secondPersonRatio).toBeGreaterThanOrEqual(0.3)
  })
})

describe("mergeProfileIntoFingerprint", () => {
  const posts = [
    "I tracked 50 AI agents for 90 days. Here's what the data showed:\n\nMost fail silently.",
    "87% of AI projects fail before reaching production.\n\nThe bottleneck isn't the model.",
    "You're prompting AI like it's Google.\n\nThat's why your outputs sound generic.",
    "I lost $50K testing autonomous agents in production.\n\nHere's what I learned.",
    "Nobody talks about the real cost of AI adoption:\n\nIt's not the API bill.",
    "The window for building AI agents is closing faster than most realize.",
    "Two types of companies right now:\n\nThose building AI into core ops.",
    "I've been building AI automation for the past year.\n\nThe biggest surprise?"
  ]

  const postFp = extractFingerprint(posts)
  const profile = parseVoiceProfile(VOICE_PROFILE, NICHE_SPEC)
  const merged = mergeProfileIntoFingerprint(postFp, profile)

  it("uses profile niche keywords over post-derived", () => {
    const terms = merged.nicheKeywords.map((k) => k.term)
    // Profile keywords should be first
    expect(terms).toContain("agentic")
    expect(terms).toContain("longevity")
  })

  it("uses profile hook rankings", () => {
    expect(merged.topHookTypes[0]).toBe("before_after")
  })

  it("uses profile preferred length", () => {
    expect(merged.postLength.mean).toBe(300)
  })

  it("uses profile tone signals", () => {
    expect(merged.firstPersonRatio).toBe(0.7)
  })

  it("preserves post-derived statistics where profile has no data", () => {
    // sentenceLength comes only from posts
    expect(merged.sentenceLength.mean).toBe(postFp.sentenceLength.mean)
  })
})
