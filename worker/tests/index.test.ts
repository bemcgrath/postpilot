import { describe, it, expect, vi, beforeEach } from "vitest"
import { createFakeKv } from "./fakeKv"
import type { Env } from "../src/types"

vi.mock("../src/entitlement", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/entitlement")>()
  return { ...actual, resolveTier: vi.fn() }
})
vi.mock("../src/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/rateLimit")>()
  return { ...actual, checkAndIncrement: vi.fn(), decrement: vi.fn() }
})
vi.mock("../src/anthropic", () => ({
  callAnthropic: vi.fn(),
}))

import { resolveTier } from "../src/entitlement"
import { checkAndIncrement, decrement } from "../src/rateLimit"
import { callAnthropic } from "../src/anthropic"
import handler, { handleRewrite } from "../src/index"

function makeEnv(): Env {
  return {
    RATE_LIMIT_KV: createFakeKv(),
    ANTHROPIC_API_KEY: "test-key",
    MODEL_ID: "claude-sonnet-5",
    FREE_DAILY_CAP: "3",
    PRO_DAILY_CAP: "40",
    REWRITE_CLIENT_SECRET: "test-secret",
  }
}

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://api.postpilotforx.com/v1/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PostPilot-Key": "test-secret", ...headers },
    body: JSON.stringify(body),
  })
}

const validBody = {
  identity: { type: "device", deviceId: "dev-1" },
  originalText: "hello world",
  isReply: false,
  hookInfo: "No hook",
  governorLines: "",
  suggestionLines: "",
  count: 1,
}

describe("routing", () => {
  it("404s on unknown paths", async () => {
    const res = await handler.fetch(new Request("https://api.postpilotforx.com/nope"), makeEnv())
    expect(res.status).toBe(404)
  })

  it("404s on GET to the rewrite path", async () => {
    const res = await handler.fetch(new Request("https://api.postpilotforx.com/v1/rewrite"), makeEnv())
    expect(res.status).toBe(404)
  })
})

describe("handleRewrite validation", () => {
  it("401s when the client key is missing", async () => {
    const req = new Request("https://api.postpilotforx.com/v1/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    })
    const res = await handleRewrite(req, makeEnv())
    expect(res.status).toBe(401)
  })

  it("401s when the client key is wrong", async () => {
    const res = await handleRewrite(makeRequest(validBody, { "X-PostPilot-Key": "nope" }), makeEnv())
    expect(res.status).toBe(401)
  })

  it("allows requests when the worker secret is unset so a missing secret cannot take down rewrites", async () => {
    vi.mocked(resolveTier).mockResolvedValue("free")
    vi.mocked(checkAndIncrement).mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetsAt: "2026-01-01T00:00:00.000Z",
    })
    vi.mocked(callAnthropic).mockResolvedValue(
      JSON.stringify({ rewrites: [{ text: "rewritten", rationale: "better" }] })
    )
    const env = makeEnv()
    env.REWRITE_CLIENT_SECRET = ""
    const res = await handleRewrite(makeRequest(validBody), env)
    expect(res.status).toBe(200)
  })

  it("400s on invalid JSON", async () => {
    const req = new Request("https://api.postpilotforx.com/v1/rewrite", {
      method: "POST",
      headers: { "X-PostPilot-Key": "test-secret" },
      body: "{not json",
    })
    const res = await handleRewrite(req, makeEnv())
    expect(res.status).toBe(400)
  })

  it("400s when originalText is missing", async () => {
    const { originalText, ...rest } = validBody
    const res = await handleRewrite(makeRequest(rest), makeEnv())
    expect(res.status).toBe(400)
  })

  it("400s when identity is malformed", async () => {
    const res = await handleRewrite(makeRequest({ ...validBody, identity: { type: "device" } }), makeEnv())
    expect(res.status).toBe(400)
  })
})

describe("handleRewrite orchestration", () => {
  beforeEach(() => {
    // mock.calls accumulates across tests otherwise -- each test below reads
    // callAnthropic's most recent call, so history from a prior test would
    // silently make calls[0] stale.
    vi.clearAllMocks()
    vi.mocked(callAnthropic).mockResolvedValue(JSON.stringify({ rewrites: [{ text: "rewritten", rationale: "better" }] }))
  })

  it("blocks with 429 and resetsAt when over the rate limit", async () => {
    vi.mocked(resolveTier).mockResolvedValue("free")
    vi.mocked(checkAndIncrement).mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetsAt: "2026-01-01T00:00:00.000Z",
    })

    const res = await handleRewrite(makeRequest(validBody), makeEnv())
    expect(res.status).toBe(429)
    const data = (await res.json()) as { error: string; resetsAt: string }
    expect(data.error).toBe("QUOTA_EXCEEDED")
    expect(data.resetsAt).toBe("2026-01-01T00:00:00.000Z")
    expect(callAnthropic).not.toHaveBeenCalled()
  })

  it("clamps a free identity's count to 1 and drops voiceDigest even if the client sent them", async () => {
    vi.mocked(resolveTier).mockResolvedValue("free")
    vi.mocked(checkAndIncrement).mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetsAt: "2026-01-01T00:00:00.000Z",
    })

    const freeSneakingPro = {
      ...validBody,
      count: 3,
      voiceDigest: {
        distinctiveTerms: ["shouldn't", "appear"],
        sentenceLengthTarget: 12,
        firstPersonRatio: 0.5,
        secondPersonRatio: 0.1,
        topHookTypes: ["question"],
      },
    }

    await handleRewrite(makeRequest(freeSneakingPro), makeEnv())

    const [, , userContent] = vi.mocked(callAnthropic).mock.calls[0]
    expect(userContent).not.toContain("VOICE PROFILE")
    expect(userContent).not.toContain("shouldn't")
  })

  it("passes a pro identity's voiceDigest through", async () => {
    vi.mocked(resolveTier).mockResolvedValue("pro")
    vi.mocked(checkAndIncrement).mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetsAt: "2026-01-01T00:00:00.000Z",
    })

    const proBody = {
      ...validBody,
      count: 3,
      voiceDigest: {
        distinctiveTerms: ["shipping", "iterate"],
        sentenceLengthTarget: 14,
        firstPersonRatio: 0.4,
        secondPersonRatio: 0.2,
        topHookTypes: ["contrarian"],
      },
    }

    const res = await handleRewrite(makeRequest(proBody), makeEnv())
    expect(res.status).toBe(200)

    const [, , userContent] = vi.mocked(callAnthropic).mock.calls[0]
    expect(userContent).toContain("VOICE PROFILE")
    expect(userContent).toContain("shipping")
  })

  it("returns 502 when generation fails", async () => {
    vi.mocked(resolveTier).mockResolvedValue("free")
    vi.mocked(checkAndIncrement).mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetsAt: "2026-01-01T00:00:00.000Z",
    })
    vi.mocked(callAnthropic).mockRejectedValue(new Error("boom"))

    const res = await handleRewrite(makeRequest(validBody), makeEnv())
    expect(res.status).toBe(502)
    expect(decrement).toHaveBeenCalledTimes(1)
  })

  it("returns the parsed rewrites on success", async () => {
    vi.mocked(resolveTier).mockResolvedValue("free")
    vi.mocked(checkAndIncrement).mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetsAt: "2026-01-01T00:00:00.000Z",
    })

    const res = await handleRewrite(makeRequest(validBody), makeEnv())
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      rewrites: Array<{ text: string }>
      remaining: number
      tier: string
      resetsAt: string
    }
    expect(data.rewrites[0].text).toBe("rewritten")
    expect(data.remaining).toBe(2)
    expect(data.tier).toBe("free")
    expect(data.resetsAt).toBe("2026-01-01T00:00:00.000Z")
    expect(decrement).not.toHaveBeenCalled()
  })

  it("truncates to the requested count when the model over-generates", async () => {
    vi.mocked(resolveTier).mockResolvedValue("pro")
    vi.mocked(checkAndIncrement).mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetsAt: "2026-01-01T00:00:00.000Z",
    })
    vi.mocked(callAnthropic).mockResolvedValue(
      JSON.stringify({
        rewrites: [
          { text: "one", rationale: "a" },
          { text: "two", rationale: "b" },
          { text: "three", rationale: "c" },
          { text: "four", rationale: "d" },
        ],
      })
    )

    const res = await handleRewrite(makeRequest({ ...validBody, count: 3 }), makeEnv())
    expect(res.status).toBe(200)
    const data = (await res.json()) as { rewrites: Array<{ text: string }> }
    expect(data.rewrites).toHaveLength(3)
    expect(data.rewrites.map((r) => r.text)).toEqual(["one", "two", "three"])
  })

  it("passes through fewer rewrites than requested without padding", async () => {
    vi.mocked(resolveTier).mockResolvedValue("pro")
    vi.mocked(checkAndIncrement).mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetsAt: "2026-01-01T00:00:00.000Z",
    })
    vi.mocked(callAnthropic).mockResolvedValue(
      JSON.stringify({ rewrites: [{ text: "only-one", rationale: "a" }] })
    )

    const res = await handleRewrite(makeRequest({ ...validBody, count: 3 }), makeEnv())
    const data = (await res.json()) as { rewrites: Array<{ text: string }> }
    expect(data.rewrites).toHaveLength(1)
  })

  it("forces 3 variants for Pro even when the client asked for 1", async () => {
    vi.mocked(resolveTier).mockResolvedValue("pro")
    vi.mocked(checkAndIncrement).mockResolvedValue({
      allowed: true,
      remaining: 39,
      resetsAt: "2026-01-01T00:00:00.000Z",
    })
    vi.mocked(callAnthropic).mockResolvedValue(
      JSON.stringify({
        rewrites: [
          { text: "one", rationale: "a" },
          { text: "two", rationale: "b" },
          { text: "three", rationale: "c" },
        ],
      })
    )

    const res = await handleRewrite(makeRequest({ ...validBody, count: 1 }), makeEnv())
    expect(res.status).toBe(200)
    const [, system] = vi.mocked(callAnthropic).mock.calls[0]
    expect(system).toContain("3 more engaging versions")
    const data = (await res.json()) as { rewrites: Array<{ text: string }> }
    expect(data.rewrites).toHaveLength(3)
  })

  it("refunds quota when the model returns no parseable rewrites", async () => {
    vi.mocked(resolveTier).mockResolvedValue("free")
    vi.mocked(checkAndIncrement).mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetsAt: "2026-01-01T00:00:00.000Z",
    })
    vi.mocked(callAnthropic).mockResolvedValue("not json at all")

    const res = await handleRewrite(makeRequest(validBody), makeEnv())
    expect(res.status).toBe(502)
    expect(decrement).toHaveBeenCalledTimes(1)
  })

  it("stitches a hook-only result onto the frozen body", async () => {
    vi.mocked(resolveTier).mockResolvedValue("free")
    vi.mocked(checkAndIncrement).mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetsAt: "2026-01-01T00:00:00.000Z",
    })
    vi.mocked(callAnthropic).mockResolvedValue(
      JSON.stringify({ rewrites: [{ text: "Labels, not compute, are the bottleneck.", rationale: "sharper" }] })
    )

    const res = await handleRewrite(
      makeRequest({
        ...validBody,
        mode: "hook",
        originalText: "The bottleneck is labels.\n\nNot compute.",
      }),
      makeEnv()
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as { rewrites: Array<{ text: string }> }
    expect(data.rewrites[0].text).toBe("Labels, not compute, are the bottleneck.\n\nNot compute.")
    const [, , userContent] = vi.mocked(callAnthropic).mock.calls[0]
    expect(userContent).toContain("MODE: HOOK ONLY")
  })

  it("discards a body the model rewrote in hook mode", async () => {
    vi.mocked(resolveTier).mockResolvedValue("free")
    vi.mocked(checkAndIncrement).mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetsAt: "2026-01-01T00:00:00.000Z",
    })
    vi.mocked(callAnthropic).mockResolvedValue(
      JSON.stringify({
        rewrites: [{ text: "New hook.\n\nI also rewrote the body.", rationale: "x" }],
      })
    )

    const res = await handleRewrite(
      makeRequest({
        ...validBody,
        mode: "hook",
        originalText: "Old hook.\n\nKeep me.",
      }),
      makeEnv()
    )
    const data = (await res.json()) as { rewrites: Array<{ text: string }> }
    expect(data.rewrites[0].text).toBe("New hook.\n\nKeep me.")
  })

  it("does not stitch when hook mode is sent on a reply", async () => {
    vi.mocked(resolveTier).mockResolvedValue("free")
    vi.mocked(checkAndIncrement).mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetsAt: "2026-01-01T00:00:00.000Z",
    })
    vi.mocked(callAnthropic).mockResolvedValue(
      JSON.stringify({ rewrites: [{ text: "full reply rewrite", rationale: "x" }] })
    )

    const res = await handleRewrite(
      makeRequest({
        ...validBody,
        isReply: true,
        mode: "hook",
        originalText: "Agree.\n\nThe constraint is latency.",
      }),
      makeEnv()
    )
    const data = (await res.json()) as { rewrites: Array<{ text: string }> }
    expect(data.rewrites[0].text).toBe("full reply rewrite")
  })

  it("400s on an unknown mode", async () => {
    const res = await handleRewrite(makeRequest({ ...validBody, mode: "thread" }), makeEnv())
    expect(res.status).toBe(400)
  })
})
