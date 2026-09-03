import { describe, expect, it } from "vitest"
import { EXAMPLE_VOICE_PROFILE } from "../src/scoring/voice-profile-example"
import { fingerprintFromProfile, parseVoiceProfile } from "../src/scoring/voice-profile-parser"

// Proves the example shown in the extension's "Load Example" button
// actually exercises every signal parseVoiceProfile() reads, not just that
// it looks plausible to a human. If a future change to the parser's
// recognized phrases/table shapes silently stops matching this example,
// this test catches it before a real user does.
describe("EXAMPLE_VOICE_PROFILE", () => {
  const profile = parseVoiceProfile(EXAMPLE_VOICE_PROFILE)

  it("extracts niche keywords from the Trending keywords line", () => {
    const terms = profile.nicheKeywords.map((k) => k.term)
    expect(terms).toEqual(
      expect.arrayContaining(["indie saas", "solo founder", "bootstrapping", "cold start problem"])
    )
  })

  it("extracts the ranked hook table in order", () => {
    expect(profile.topHookTypes).toEqual(["data_reveal", "personal_failure", "contrarian"])
  })

  it("extracts the preferred length range", () => {
    expect(profile.preferredLength).toEqual({ mean: 270, stdDev: 25, min: 220, max: 320 })
  })

  it("extracts every tone signal (first/second person, colons, fragments, formality)", () => {
    expect(profile.firstPersonRatio).not.toBeNull()
    expect(profile.secondPersonRatio).not.toBeNull()
    expect(profile.usesColons).not.toBeNull()
    expect(profile.fragmentRatio).not.toBeNull()
    expect(profile.formalityScore).not.toBeNull()
  })

  it("produces a fully populated fingerprint when built from the profile alone", () => {
    const fp = fingerprintFromProfile(profile)
    expect(fp.topHookTypes.length).toBeGreaterThan(0)
    expect(fp.nicheKeywords.length).toBeGreaterThan(0)
    expect(fp.postLength).toEqual({ mean: 270, stdDev: 25, min: 220, max: 320 })
  })
})
