import { describe, it, expect, vi, beforeEach } from "vitest"
import { createFakeKv } from "./fakeKv"
import type { Env } from "../src/types"

vi.mock("../src/entitlement", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/entitlement")>()
  return { ...actual, resolveTier: vi.fn() }
})
vi.mock("../src/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/rateLimit")>()
  return { ...actual, checkAndIncrement: vi.fn() }
})
vi.mock("../src/anthropic", () => ({
  callAnthropic: vi.fn(),
}))

import { resolveTier } from "../src/entitlement"
import { checkAndIncrement } from "../src/rateLimit"
import { callAnthropic } from "../src/anthropic"
import handler, { handleRewrite } from "../src/index"

function makeEnv(): Env {
  return {
    RATE_LIMIT_KV: createFakeKv(),
    ANTHROPIC_API_KEY: "test-key",
    MODEL_ID: "claude-sonnet-5",
    FREE_DAILY_CAP: "3",
    PRO_DAILY_CAP: "40",
  }
}

function makeRequest(body: unknown): Request {
  return new Request("https://api.postpilotforx.com/v1/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  it("400s on invalid JSON", async () => {
    const req = new Request("https://api.postpilotforx.com/v1/rewrite", { method: "POST", body: "{not json" })
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
    vi.mocked(checkAndIncrement).mockResolvedValue({ allowed: false, resetsAt: "2026-01-01T00:00:00.000Z" })

    const res = await handleRewrite(makeRequest(validBody), makeEnv())
    expect(res.status).toBe(429)
    const data = (await res.json()) as { error: string; resetsAt: string }
    expect(data.error).toBe("QUOTA_EXCEEDED")
    expect(data.resetsAt).toBe("2026-01-01T00:00:00.000Z")
    expect(callAnthropic).not.toHaveBeenCalled()
  })

  it("clamps a free identity's count to 1 and drops voiceDigest even if the client sent them", async () => {
    vi.mocked(resolveTier).mockResolvedValue("free")
    vi.mocked(checkAndIncrement).mockResolvedValue({ allowed: true, resetsAt: "2026-01-01T00:00:00.000Z" })

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
    vi.mocked(checkAndIncrement).mockResolvedValue({ allowed: true, resetsAt: "2026-01-01T00:00:00.000Z" })

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
    vi.mocked(checkAndIncrement).mockResolvedValue({ allowed: true, resetsAt: "2026-01-01T00:00:00.000Z" })
    vi.mocked(callAnthropic).mockRejectedValue(new Error("boom"))

    const res = await handleRewrite(makeRequest(validBody), makeEnv())
    expect(res.status).toBe(502)
  })

  it("returns the parsed rewrites on success", async () => {
    vi.mocked(resolveTier).mockResolvedValue("free")
    vi.mocked(checkAndIncrement).mockResolvedValue({ allowed: true, resetsAt: "2026-01-01T00:00:00.000Z" })

    const res = await handleRewrite(makeRequest(validBody), makeEnv())
    expect(res.status).toBe(200)
    const data = (await res.json()) as { rewrites: Array<{ text: string }> }
    expect(data.rewrites[0].text).toBe("rewritten")
  })

  it("truncates to the requested count when the model over-generates", async () => {
    vi.mocked(resolveTier).mockResolvedValue("pro")
    vi.mocked(checkAndIncrement).mockResolvedValue({ allowed: true, resetsAt: "2026-01-01T00:00:00.000Z" })
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
    vi.mocked(checkAndIncrement).mockResolvedValue({ allowed: true, resetsAt: "2026-01-01T00:00:00.000Z" })
    vi.mocked(callAnthropic).mockResolvedValue(
      JSON.stringify({ rewrites: [{ text: "only-one", rationale: "a" }] })
    )

    const res = await handleRewrite(makeRequest({ ...validBody, count: 3 }), makeEnv())
    const data = (await res.json()) as { rewrites: Array<{ text: string }> }
    expect(data.rewrites).toHaveLength(1)
  })
})
