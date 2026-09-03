/**
 * A worked example for the Voice Profile markdown box (Settings -> Voice on
 * the extension). Every line here is chosen to exercise a real signal
 * parseVoiceProfile() (./voice-profile-parser) reads -- niche keywords, a
 * ranked hook-type table, a length range, and the specific plain-language
 * tone phrases it looks for (first/second person, colon framing, short
 * paragraphs, conversational tone) -- so loading this unedited and running
 * it through the parser produces a real, populated fingerprint, not a
 * placeholder. See voice-profile-example.test.ts for the assertion that
 * backs that claim.
 *
 * It's an indie-software-founder voice on purpose: generic enough for
 * anyone to adapt, concrete enough to show what "filled in" looks like.
 * Lives in packages/core (not the extension) so it stays a single source
 * of truth, testable directly against the parser it documents, and
 * reusable by any future consumer (e.g. a mobile Voice Profile screen).
 */
export const EXAMPLE_VOICE_PROFILE = `# Voice Profile

## Niche
Trending keywords: indie SaaS, solo founder, bootstrapping, cold start problem, pricing page, churn

## Hook Preferences
Ranked by performance:

| Rank | Hook Type | Why it works for me |
|------|-----------|----------------------|
| 1 | **Data Reveal** | I always have a number or metric worth leading with |
| 2 | **Personal Failure** | My best posts are honest about what didn't work |
| 3 | **Contrarian** | I push back on common advice in my niche |

## Length
Typical post length: 220-320 chars

## Tone
- Conversational tone -- like talking to one reader, not a boardroom.
- Mostly first person, often narrating a personal experiment or what I tried.
- Occasionally reader-directed -- a callout like "if you're building solo, this matters."
- Short paragraphs, often one-line punches for emphasis.
- Uses colon framing ("here's what I found") to set up the payoff line.
`
