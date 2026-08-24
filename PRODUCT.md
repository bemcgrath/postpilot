# PostPilot for X — Product Documentation

## What It Is

PostPilot is a Chrome extension that scores X/Twitter posts in real time as you type. It overlays a score panel on the X compose box, giving instant feedback on hook strength, specificity, governor violations, and more — before you hit send.

**Tagline:** Score every X post as you type. Pro learns your voice and your audience — AI rewrites, thread scoring, and a self-building hook library. $24/mo.

**Version:** 0.7.1  
**Framework:** Plasmo (React/TypeScript, Chrome MV3)  
**Pricing:** Free tier + Pro at $24/mo via LemonSqueezy

---

## Feature Set

### Free Tier
| Feature | Description |
|--------|-------------|
| Real-time scoring | 0–100 score updated as you type. Attached images and links move the score. Fabrication claims don’t get a data-reveal bonus. |
| Hook analysis | Detects hook type (curiosity gap, data reveal, contrarian, etc.) and scores strength |
| Specificity scoring | Flags vague language, rewards numbers and concrete claims |
| Length optimization | Guides toward character ranges that perform best |
| Curiosity gap detection | Flags whether the post earns the click |
| Governor warnings | 79+ patterns that suppress engagement — flagged with severity. Named **AI slop** lane for ChatGPT tells. |
| 1 AI rewrite suggestion | One-click improved version using Claude — included, no API key needed. 3/day, resets midnight UTC. |
| Score history | Tracks scores of published posts, shows 7-day rolling average |
| Draft queue | Save posts with scores, restore to compose box. Compare two drafts side by side. |
| Pre-publish checklist | Hook, blocking phrases, length, media — warns, never blocks |
| Reply-invite signal | Broadcast vs a real question. Does not reward “thoughts?” bait. |
| Score Trends (Settings → Analytics) | This week's average score, post count, trend vs. last week — a local, passive view of the score history above; teaser for the Pro breakdown below |

### Pro Tier ($24/mo)
| Feature | Description |
|--------|-------------|
| Voice Match | Learns writing style across 13 dimensions (voice fingerprinting under the hood), personalizes scoring and AI rewrites to sound like you |
| Learning engine | Analyzes your own past-post performance (collected passively from the X DOM as you browse, or via Analytics CSV import) to identify what works for your audience. Collection funnel shows why insights are empty. |
| Full Analytics Breakdown (Settings → Analytics) | Hook type performance, length sweet spot, topic performance, best posting times (weekday/weekend/combined), media impact (images/links), reply craft, and prioritized recommendations — all derived locally from your own collected posts |
| Reach range | Range + sample size from similar posts of yours. Hidden until n is honest. Never a single invented impression count. |
| Now’s a good time | Compose chip from learned weekday/weekend hours |
| Full Analytics Breakdown (Settings → Analytics) | Hook type performance, length sweet spot, topic performance, best posting times (weekday/weekend/combined), media impact (images/links), reply craft, and prioritized recommendations — all derived locally from your own collected posts |
| Reply Craft scoring | Grades replies on their own rubric (mechanism/constraint vocabulary, learned length band), separate from original-post scoring |
| 3 AI rewrite variants | Each targets a different hook type; calibrated to your Voice Match profile when one exists. 40/day, resets midnight UTC. |
| Thread scorer | Scores each tweet in a thread individually, flags weakest link |
| Viral Post Analyzer | Scores any post on X feed — every viral post becomes a lesson |
| Hook Library | Save best-performing openers, remix when stuck |
| Auto-save hooks | High-scoring posts (70+) auto-saved to hook library on publish |
| Self-reply prompt | After publish, one follow-up you can insert. You still send it. |

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
├── Options Page (options.tsx)  — Settings: license, voice, AI rewrites
│                                  (quota info, no API key), Analytics (Score
│                                  Trends free / Full Breakdown Pro), dev-only
│                                  export/import backup + dev-Pro toggle
├── Background Service Worker   — License validation, proxies AI rewrite
│                                  requests to the Cloudflare Worker below
└── Scoring Engine
    ├── scoring-pipeline.ts     — scorePost() pure function
    ├── hook-types.ts           — 20 hook type patterns
    ├── governor/               — 79 suppression patterns
    ├── reply-craft.ts          — Reply-specific scoring rubric (Pro)
    ├── voice-storage.ts        — Fingerprint + overrides persistence
    └── learning/               — Insight engine (hook boosts, time/media/
                                   topic performance, reply-craft learner)

worker/ (postpilot-rewrite-worker, Cloudflare Worker — separate deploy)
├── src/entitlement.ts   — Re-validates license against LemonSqueezy
│                          server-side; never trusts a client-claimed tier
│                          (the same bug class as the 0.6.17 bypass below)
├── src/rateLimit.ts     — KV daily-cap counters, keyed by license or
│                          anonymous device id, reset at UTC midnight
├── src/prompt.ts        — Builds the Anthropic request (cacheable system
│                          block + per-post user content, optional voice
│                          digest for Pro)
├── src/anthropic.ts     — Calls Anthropic with PostPilot's own key
└── wrangler.toml        — MODEL_ID, FREE_DAILY_CAP, PRO_DAILY_CAP — change
                            and redeploy, no extension update needed
```

**Pro-gating discipline (as of 0.6.17):** every read of the local dev-Pro
storage flag (`postpilot_dev_pro`) is guarded by `isDevBuild()`
(`!("update_url" in chrome.runtime.getManifest())`) so it can only ever
unlock Pro features on an unpacked/dev-loaded build, never on the real Web
Store install — that guard was missing in several places before 0.6.17 and
was a real, live monetization bypass (any user could unlock Pro via
devtools). See git history on `master` around commit `e5e49c2` for the fix.

**Storage:** Scoring, drafts, voice profile, and analytics all local via `chrome.storage.local` — never transmitted  
**Payments:** LemonSqueezy (license key validation only)  
**AI:** Claude API, called from PostPilot's own Cloudflare Worker (`worker/`) — PostPilot pays, not the user; no API key to manage. Post text, an identity (device id or license key), and — for Pro with a voice profile — a compact style digest are sent to that Worker to generate rewrites. See `privacy-policy.html` for the exact data-handling language.  

---

## Store Listing

**CWS title (from manifest name, v0.6.13):**  
PostPilot for X — Twitter Post Score & Hook Checker

**CWS short description (130 chars — manifest limit is 132):**  
Score every Twitter/X post as you type — AI rewrites, thread scoring, voice coaching, and a hook library that learns what works.

**CWS category:** Lifestyle > Social Networking (changed from Productivity > Tools, 2026-07-26 — better matches the actual competitive set: Typefully/Tweet Hunter/Buffer)

**LemonSqueezy listing (name 50–60 chars, description 120–160 chars):**  
Name (54 chars): PostPilot Pro — AI Post Scoring & Voice Coaching for X  
Description (144 chars): Score every X post as you type. Pro learns your voice and your audience — AI rewrites, thread scoring, and a self-building hook library. $24/mo.  
Checkout: https://postpilotpro.lemonsqueezy.com/checkout/buy/40669ef5-0219-4b06-ac42-0d9cbdf7885f

**Permissions:**
- `storage` — saves scores, drafts, hooks, fingerprint, settings

**Host permissions:** x.com, twitter.com, api.lemonsqueezy.com, postpilot-rewrite-worker.brianemcgrath.workers.dev (interim -- moves to a postpilotforx.com subdomain once that domain's DNS is on Cloudflare)

---

## Submission Status

| Store | Status |
|-------|--------|
| Chrome Web Store | **v0.7.2 submitted for review** (2026-08-24) — weekly score trend chart in Settings → Analytics. v0.7.0 is the prior live build (published 2026-08-17) — media/link scoring, pre-publish checklist, AI-slop lane, CSV import, reach range, draft compare, reply-invite, self-reply prompt. |
| LemonSqueezy | Live — store activated, product published 2026-07-16. Price updated 2026-08-13 to $24/mo / $240/yr (from $5/mo / $50/yr); license keys on, activation limit 5 |

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

**PostPilot's moat:** Real-time quality scoring inside the compose box, entirely local and with no account access — scoring, drafts, and your voice profile never leave the device (the only exceptions are license validation and, when you ask for one, an AI rewrite request). No other tool in this set does this. ClimbX in particular writes and schedules content for you (engagement-farming mechanics); PostPilot never touches your account or writes for you, it only scores what you already wrote, locally, before you send. Scheduling is the single highest-demand feature this category has that PostPilot doesn't — and building it would collapse this exact moat, so it's deliberately off-thesis, not a roadmap gap.

---

## Post-launch todo (landing page / positioning)

- [x] Add FAQ near pricing: "what happens if X changes its DOM," "can I cancel anytime"
- [x] Reorder landing page so Pro features are visible before/alongside the install CTA, not buried mid-page
- [x] Annual pricing tier — $50/yr (2 months free) added as a second LemonSqueezy variant on the existing PostPilot Pro product, toggle at checkout, defaults to Monthly. Landing page updated (Pro kicker, comparison table, JSON-LD offers).
- [x] Ship the Analytics free/Pro gating split (0.6.17) — prerequisite for the landing-page copy below, since advertising Pro-only analytics while the build leaked it free would've been a credibility problem.
- [x] Landing page copy pass — `index.html` analytics framing reworked around the local/privacy wedge (Score Trends / Full Breakdown language) and Voice Fingerprinting section renamed to **Voice Match** (commit `4b67246`).
- [x] AI Rewrites moved off BYOK onto a PostPilot-run backend (`worker/`, Cloudflare Worker) — no more "paste your Claude API key," rewrites are now included and capped per day (Free 3/day, Pro 40/day). Voice Match now actually informs rewrites, which it didn't before. Landing page, privacy policy, and this doc's "no servers" language updated to match — see `privacy-policy.html`'s "What data PostPilot transmits" section for the exact claim.
- [x] Worker deployed (2026-08-12) — live at `postpilot-rewrite-worker.brianemcgrath.workers.dev`, KV namespaces created, `ANTHROPIC_API_KEY` set as a secret, end-to-end smoke test confirmed a real rewrite comes back through the full chain (device quota → Anthropic → JSON parse).
- [ ] **Custom domain still pending.** Running on the free workers.dev subdomain because postpilotforx.com's DNS isn't on Cloudflare yet. Once it is: add an `api.postpilotforx.com` route/custom domain in the Cloudflare dashboard, then update the endpoint in `src/background.ts`, `host_permissions` in `package.json`, and the permission bullet in `privacy-policy.html` together (all three currently point at the workers.dev URL).
- [ ] Re-derive the Free/Pro daily caps (currently 3 / 40) from real `count_tokens` numbers against `claude-sonnet-5` before raising them — the current values are back-of-envelope, see plan history.
- [x] Pro price increase to $24/mo (from $5/mo), $240/yr (from $50/yr) — funds the included AI rewrites now that BYOK is gone; picked from the $24–39 range based on real worst-case cost math (40/day cap × Sonnet 5 pricing ≈ $10–15/mo per maxed-out Pro user at intro vs. standard API pricing). `index.html` (JSON-LD offers, hero CTA, pricing kicker, comparison table headline/row), `src/options.tsx` ("Get PostPilot Pro" link), and this doc's tagline/pricing lines all updated.
- [x] LemonSqueezy checkout variants updated to $24/mo / $240/yr (confirmed 2026-08-13). Site, options CTA, and checkout now match.
- [ ] Real social proof once numbers justify it (actual CWS install count or real tester quotes) — never a fabricated counter
- [ ] Ongoing: DOM fragility is a standing risk, not a one-time fix. X's composer DOM has broken scoring twice already this launch week (mention-truncation, viral-analyzer personalization). Keep test coverage up rather than treating as solved.

---

## Roadmap (internal + Chrome Store gaps)

Merged 2026-08-13. Store clones in the same job (X Post Analyzer, ReachOS, ContentForge) have ~62 users combined; steal their advertised compose features without scheduling, X OAuth, or writing the post for the user. Off-thesis: schedulers, auto-reply queues, BYOK as the Pro upsell, 12-platform scoring, uncalibrated "14,200 impressions" forecasts.

### Wave 0 — money and cost (before more store traffic)
- [x] LemonSqueezy checkout → $24 / $240 (confirmed 2026-08-13)
- [x] Authenticate rewrite worker (`X-PostPilot-Key` / `REWRITE_CLIENT_SECRET`). Fail closed if unset. **Deploy order:** ship the extension that sends the header first (old worker ignores it), then `wrangler secret put REWRITE_CLIENT_SECRET` and deploy the worker. Copy `.env.example` → `.env` with the same value as `PLASMO_PUBLIC_REWRITE_KEY` before `plasmo package`.
- [x] Refund quota on failed/empty generation; return `{ tier, remaining, resetsAt }` on success. Server forces Pro count to 3. KV burst still possible — Durable Objects later if gamed.

User-facing list for Waves 1–4 (share with the user base): [releases.html](./releases.html) → https://postpilotforx.com/releases.html. Update that page when a listed item ships.

### Wave 1 — time-to-insight (beats X Post Analyzer's $1.49 CSV Pro)
- [x] Collection funnel in Analytics + compose (handle / 24h / impressions / 20-post bar)
- [x] **X Analytics CSV import** — local parse of the official export into `CollectedPost`; DOM collection stays the ongoing feed. No X API. Settings → Analytics (Pro).

### Wave 2 — compose badge rivals can screenshot
- [x] **Live media / link delta** — score attached image and external links in compose (use learned `imageBoost`/`linkBoost` when ready, else algorithm priors). ReachOS's whole demo.
- [x] Wire learned length + hook-type boosts into original-post scoring and the thread scorer
- [x] **Now-a-good-time chip + pre-publish checklist** (hook, governor errors, sweet spot, media/link)
- [x] **Named AI-slop lane** in the governor + resolve hook-type vs fabrication contradictions so the headline number means one thing

### Wave 3 — unique vs generic forecasts
- [x] **Reach range from the user's own collected impressions** (range + sample size; hide until n is honest). Never a single invented impression count.
- [x] HTML fixtures for `toolBar`, `tweetTextarea_*`, own-tweet analytics (DOM already broke twice)

### Wave 4 — polish
- [x] A/B two of the user's drafts (ContentForge Compare)
- [x] Reply-invite signal on originals (conversation vs broadcast — not "thoughts?" bait)
- [x] Surface reply-craft in the breakdown instead of silently shifting the score
- [x] Optional: suggest a self-reply after publish (user sends; never auto-post)
- [ ] Custom domain `api.postpilotforx.com` — DNS still pending (ops). Popup version + Voice Match copy and client-side `voiceDigest` strip for Free are done.
