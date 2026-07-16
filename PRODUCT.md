# PostPilot for X — Product Documentation

## What It Is

PostPilot is a Chrome extension that scores X/Twitter posts in real time as you type. It overlays a score panel on the X compose box, giving instant feedback on hook strength, specificity, governor violations, and more — before you hit send.

**Tagline:** Score every X post as you type. Pro learns your voice and your audience — AI rewrites, thread scoring, and a self-building hook library. $5/mo.

**Version:** 0.6.1  
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

### Pro Tier ($5/mo)
| Feature | Description |
|--------|-------------|
| Voice fingerprinting | Learns writing style across 13 dimensions, personalizes scoring |
| Learning engine | Analyzes past performance, identifies what works for your audience |
| 3 AI rewrite variants | Each targets a different hook type |
| Thread scorer | Scores each tweet in a thread individually, flags weakest link |
| Viral Post Analyzer | Scores any post on X feed — every viral post becomes a lesson |
| Hook Library | Save best-performing openers, remix when stuck |
| Auto-save hooks | High-scoring posts (70+) auto-saved to hook library on publish |

---

## Technical Architecture

```
Chrome Extension (MV3)
├── Content Script (CSUI)     — PostPilot panel injected into X compose box
│   ├── PostPilotPanel.tsx     — Main panel: scoring, drafts, hooks, rewrites
│   ├── ThreadSummaryPanel.tsx — Thread scorer (separate CSUI)
│   └── viral-analyzer.ts     — Scores feed posts (Pro only)
├── Options Page (options.tsx) — Settings: license, API key, voice, AI rewrites
├── Background Service Worker  — License validation
└── Scoring Engine
    ├── scoring-pipeline.ts    — scorePost() pure function
    ├── hook-types.ts          — 20 hook type patterns
    ├── governor/              — 79 suppression patterns
    ├── voice-storage.ts       — Fingerprint + overrides persistence
    └── learning/              — Insight engine (hook boosts, time performance)
```

**Storage:** All data local via `chrome.storage.local` — no PostPilot servers  
**Payments:** LemonSqueezy (license key validation only)  
**AI:** Claude API — user provides own key, called from content script  

---

## Store Listing

**CWS short description (128 chars — manifest limit is 132):**  
Score every X post as you type — AI rewrites, thread scoring, voice coaching, and a hook library that learns what works for you.

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
| Chrome Web Store | v0.6.1 submitted 2026-07-16 — in review |
| LemonSqueezy | Live — store activated, product published 2026-07-16 ($5/mo, license keys on, activation limit 5) |

---

## Comparable Tools

| Tool | Price | Gap vs PostPilot |
|------|-------|-----------------|
| Typefully | $12.50–100/mo | Thread management, no scoring |
| Taplio | $49/mo | Analytics + scheduling, no inline scoring |
| Tweet Hunter | $49/mo | Inspiration + scheduling, no scoring |
| Buffer/Hootsuite | $15–100/mo | Scheduling focused, no quality layer |

**PostPilot's moat:** Real-time quality scoring inside the compose box. No other tool does this.
