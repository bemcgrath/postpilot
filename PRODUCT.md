# PostPilot for X — Product Documentation

## What It Is

PostPilot is a Chrome extension that scores X/Twitter posts in real time as you type. It overlays a score panel on the X compose box, giving instant feedback on hook strength, specificity, governor violations, and more — before you hit send.

**Tagline:** Score every X post as you type. Pro learns your voice and your audience — AI rewrites, thread scoring, and a self-building hook library. $5/mo.

**Version:** 0.6.17  
**Framework:** Plasmo (React/TypeScript, Chrome MV3)  
**Pricing:** Free tier + Pro at $5/mo via LemonSqueezy

---

## Feature Set

### Free Tier
| Feature | Description |
|--------|-------------|
| Real-time scoring | 0–100 score updated as you type |
| Hook analysis | Detects hook type (curiosity gap, data reveal, contrarian, etc.) and scores strength |
| Specificity scoring | Flags vague language, rewards numbers and concrete claims |
| Length optimization | Guides toward character ranges that perform best |
| Curiosity gap detection | Flags whether the post earns the click |
| Governor warnings | 79 patterns that suppress engagement — flagged with severity |
| 1 AI rewrite suggestion | One-click improved version using Claude API (user provides key) |
| Score history | Tracks scores of published posts, shows 7-day rolling average |
| Draft queue | Save posts with scores, restore to compose box |
| Score Trends (Settings → Analytics) | This week's average score, post count, trend vs. last week — a local, passive view of the score history above; teaser for the Pro breakdown below |

### Pro Tier ($5/mo)
| Feature | Description |
|--------|-------------|
| Voice Match | Learns writing style across 13 dimensions (voice fingerprinting under the hood), personalizes scoring and AI rewrites to sound like you |
| Learning engine | Analyzes your own past-post performance (collected passively from the X DOM as you browse, never via API) to identify what works for your audience |
| Full Analytics Breakdown (Settings → Analytics) | Hook type performance, length sweet spot, topic performance, best posting times (weekday/weekend/combined), media impact (images/links), reply craft, and prioritized recommendations — all derived locally from your own collected posts |
| Reply Craft scoring | Grades replies on their own rubric (mechanism/constraint vocabulary, learned length band), separate from original-post scoring |
| 3 AI rewrite variants | Each targets a different hook type |
| Thread scorer | Scores each tweet in a thread individually, flags weakest link |
| Viral Post Analyzer | Scores any post on X feed — every viral post becomes a lesson |
| Hook Library | Save best-performing openers, remix when stuck |
| Auto-save hooks | High-scoring posts (70+) auto-saved to hook library on publish |

**Naming note:** externally, lead with **"Voice Match"** as the headline and keep "voice fingerprinting" as the substantiating technical detail underneath — chosen specifically so the messaging doesn't echo competitor CapGo AI's "Vibe Check" (see Comparable Tools below). Similarly, avoid the bare word **"analytics"** in marketing copy for the Settings → Analytics feature; frame it as **"Score Trends"** (free) and the **Full Breakdown** (Pro), selling the "insights that don't require handing over your account" wedge rather than competing on dashboard completeness. See Post-launch todo for the landing-page pass still pending on this.

---

## Technical Architecture

```
Chrome Extension (MV3)
├── Content Scripts (CSUI)
│   ├── PostPilotPanel.tsx      — Main panel: scoring, drafts, hooks, rewrites
│   ├── ThreadSummaryPanel.tsx  — Thread scorer (Pro; dev-Pro toggle honored)
│   ├── viral-analyzer.ts       — Scores feed posts (Pro; dev-Pro toggle honored)
│   └── analytics-collector.ts  — Passively reads your own tweets' engagement
│                                  stats off the X DOM as you browse; feeds
│                                  the learning engine. No API, no server.
├── Options Page (options.tsx)  — Settings: license, API key, voice, AI
│                                  rewrites, Analytics (Score Trends free /
│                                  Full Breakdown Pro), dev-only export/import
│                                  backup + dev-Pro toggle
├── Background Service Worker   — License validation
└── Scoring Engine
    ├── scoring-pipeline.ts     — scorePost() pure function
    ├── hook-types.ts           — 20 hook type patterns
    ├── governor/               — 79 suppression patterns
    ├── reply-craft.ts          — Reply-specific scoring rubric (Pro)
    ├── voice-storage.ts        — Fingerprint + overrides persistence
    └── learning/               — Insight engine (hook boosts, time/media/
                                   topic performance, reply-craft learner)
```

**Pro-gating discipline (as of 0.6.17):** every read of the local dev-Pro
storage flag (`postpilot_dev_pro`) is guarded by `isDevBuild()`
(`!("update_url" in chrome.runtime.getManifest())`) so it can only ever
unlock Pro features on an unpacked/dev-loaded build, never on the real Web
Store install — that guard was missing in several places before 0.6.17 and
was a real, live monetization bypass (any user could unlock Pro via
devtools). See git history on `master` around commit `e5e49c2` for the fix.

**Storage:** All data local via `chrome.storage.local` — no PostPilot servers  
**Payments:** LemonSqueezy (license key validation only)  
**AI:** Claude API — user provides own key, called from content script  

---

## Store Listing

**CWS title (from manifest name, v0.6.13):**  
PostPilot for X — Twitter Post Score & Hook Checker

**CWS short description (130 chars — manifest limit is 132):**  
Score every Twitter/X post as you type — AI rewrites, thread scoring, voice coaching, and a hook library that learns what works.

**CWS category:** Lifestyle > Social Networking (changed from Productivity > Tools, 2026-07-26 — better matches the actual competitive set: Typefully/Tweet Hunter/Buffer)

**LemonSqueezy listing (name 50–60 chars, description 120–160 chars):**  
Name (54 chars): PostPilot Pro — AI Post Scoring & Voice Coaching for X  
Description (143 chars): Score every X post as you type. Pro learns your voice and your audience — AI rewrites, thread scoring, and a self-building hook library. $5/mo.  
Checkout: https://postpilotpro.lemonsqueezy.com/checkout/buy/40669ef5-0219-4b06-ac42-0d9cbdf7885f

**Permissions:**
- `storage` — saves scores, drafts, hooks, fingerprint, settings

**Host permissions:** x.com, twitter.com, api.lemonsqueezy.com, api.anthropic.com

---

## Submission Status

| Store | Status |
|-------|--------|
| Chrome Web Store | v0.6.17 approved and live (2026-08-03) — closes a real Pro-unlock bypass (see Pro-gating discipline note above) plus the Analytics tab gating split |
| LemonSqueezy | Live — store activated, product published 2026-07-16 ($5/mo, license keys on, activation limit 5) |

---

## Comparable Tools

Real competitive set, per market research 2026-08-02 (`RESEARCH/POSTPILOT_MARKET_SCAN.md` in the Buzz workspace) — Taplio and Supergrow were previously listed here but are LinkedIn-only and don't actually compete with PostPilot on X.

| Tool | Price | Gap vs PostPilot |
|------|-------|-----------------|
| Typefully | Free–$39/mo (+Team/Enterprise) | Distraction-free writing + scheduling + built-in analytics across X/LinkedIn/Threads/Bluesky/Mastodon. No inline quality scoring. |
| Tweet Hunter | $49–99/mo | Viral-tweet library, AI writing, scheduling, auto-DM/CRM at top tier. No scoring. |
| Hypefury | $29–199/mo | Scheduling, engagement automation, auto-plugs/recycling. No free tier, no scoring. |
| Publer | Free–$8/mo (+Enterprise) | General multi-platform scheduler; Business tier adds analytics, best-time-to-post, hashtags. No scoring. |
| FeedHive | $19–299/mo | Scheduler + AI content gen, hashtags, analytics, social inbox. No scoring. |
| SocialBee | $29–449/mo | Scheduler with AI Copilot, unified inbox, content recycling. No scoring. |
| ClimbX | $29–39/mo | Growth automation: finds viral posts, auto-drafts/schedules replies and posts (10/day). Proactive content generation, not review. Cloud SaaS, connects your X account. |
| CapGo AI (new, 2026) | — | "Vibe Check" — single-flag voice-consistency check against your historical voice; hit #1 Product of the Day. Closest thing to a scoring/voice-check competitor. PostPilot's Voice Match (13-dimension fingerprinting) is more sophisticated but was, until this positioning pass, buried as an internal Pro sub-feature rather than a headline capability — see naming note above. |
| Manipulator (Chrome ext.) | — | Scores *others'* tweets 0–10 for clickbait, on-device/local, no server. Different job (reader-side judgment) but validates real demand for local-only scoring tools — directly supports PostPilot's "never touches your account" positioning as a trust point, not just an implementation detail. |

**PostPilot's moat:** Real-time quality scoring inside the compose box, entirely local — no PostPilot servers, no account access. No other tool in this set does this. ClimbX in particular writes and schedules content for you (engagement-farming mechanics); PostPilot never touches your account or writes for you, it only scores what you already wrote, locally, before you send. Scheduling is the single highest-demand feature this category has that PostPilot doesn't — and building it would collapse this exact moat, so it's deliberately off-thesis, not a roadmap gap.

---

## Post-launch todo (landing page / positioning)

- [x] Add FAQ near pricing: "what happens if X changes its DOM," "can I cancel anytime"
- [x] Reorder landing page so Pro features are visible before/alongside the install CTA, not buried mid-page
- [x] Annual pricing tier — $50/yr (2 months free) added as a second LemonSqueezy variant on the existing PostPilot Pro product, toggle at checkout, defaults to Monthly. Landing page updated (Pro kicker, comparison table, JSON-LD offers).
- [x] Ship the Analytics free/Pro gating split (0.6.17) — prerequisite for the landing-page copy below, since advertising Pro-only analytics while the build leaked it free would've been a credibility problem.
- [ ] **Landing page copy pass (next up):** rewrite `index.html`'s analytics framing around the local/privacy wedge instead of competing on dashboard completeness (currently the page pitches PostPilot as explicitly *not* doing analytics — l.300 area — which is now stale); rename the Voice Fingerprinting section headline to **Voice Match**. See the naming note in Feature Set above for exact positioning. Owner: April (positioning), implementation once Brian approves copy.
- [ ] Real social proof once numbers justify it (actual CWS install count or real tester quotes) — never a fabricated counter
- [ ] Ongoing: DOM fragility is a standing risk, not a one-time fix. X's composer DOM has broken scoring twice already this launch week (mention-truncation, viral-analyzer personalization). Keep test coverage up rather than treating as solved.
