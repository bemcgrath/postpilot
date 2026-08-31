import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { resolveTier, dailyCapFor, identityKey } from "../src/entitlement"
import { createFakeKv } from "./fakeKv"
import type { Env } from "../src/types"

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

describe("resolveTier", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("returns free for a device identity without calling LemonSqueezy", async () => {
    const env = makeEnv()
    const tier = await resolveTier(env, { type: "device", deviceId: "dev-1" })
    expect(tier).toBe("free")
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("returns trial for a device identity with an active trial record", async () => {
    const env = makeEnv()
    await env.RATE_LIMIT_KV.put("trial:dev-2", JSON.stringify({ started: Date.now() }))
    const tier = await resolveTier(env, { type: "device", deviceId: "dev-2" })
    expect(tier).toBe("trial")
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("returns free for a device identity whose trial record has expired", async () => {
    const env = makeEnv()
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    await env.RATE_LIMIT_KV.put("trial:dev-3", JSON.stringify({ started: eightDaysAgo }))
    const tier = await resolveTier(env, { type: "device", deviceId: "dev-3" })
    expect(tier).toBe("free")
  })

  it("returns pro when LemonSqueezy confirms the license is valid", async () => {
    const env = makeEnv()
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ valid: true }),
    })
    const tier = await resolveTier(env, { type: "license", licenseKey: "key-1", instanceId: "inst-1" })
    expect(tier).toBe("pro")
  })

  it("returns free when LemonSqueezy says the license is invalid -- never trusts the client", async () => {
    const env = makeEnv()
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ valid: false }),
    })
    const tier = await resolveTier(env, { type: "license", licenseKey: "revoked", instanceId: "inst-1" })
    expect(tier).toBe("free")
  })

  it("fails closed to free when LemonSqueezy is unreachable", async () => {
    const env = makeEnv()
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network down"))
    const tier = await resolveTier(env, { type: "license", licenseKey: "key-1", instanceId: "inst-1" })
    expect(tier).toBe("free")
  })

  it("caches a validated result so a second call doesn't hit LemonSqueezy again", async () => {
    const env = makeEnv()
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ valid: true }),
    })
    const identity = { type: "license" as const, licenseKey: "key-1", instanceId: "inst-1" }
    await resolveTier(env, identity)
    await resolveTier(env, identity)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it("does not cache across different license/instance pairs", async () => {
    const env = makeEnv()
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ valid: true }),
    })
    await resolveTier(env, { type: "license", licenseKey: "key-1", instanceId: "inst-1" })
    await resolveTier(env, { type: "license", licenseKey: "key-2", instanceId: "inst-2" })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })
})

describe("dailyCapFor", () => {
  it("reads caps from env vars", () => {
    const env = makeEnv()
    expect(dailyCapFor(env, "free")).toBe(3)
    expect(dailyCapFor(env, "pro")).toBe(40)
    expect(dailyCapFor(env, "trial")).toBe(40)
  })

  it("falls back to safe defaults on malformed env vars", () => {
    const env = { ...makeEnv(), FREE_DAILY_CAP: "not-a-number", PRO_DAILY_CAP: "0" }
    expect(dailyCapFor(env, "free")).toBe(3)
    expect(dailyCapFor(env, "pro")).toBe(40)
  })
})

describe("identityKey", () => {
  it("distinguishes license and device identities of the same string", () => {
    const licenseKey = identityKey({ type: "license", licenseKey: "abc", instanceId: "x" })
    const deviceKey = identityKey({ type: "device", deviceId: "abc" })
    expect(licenseKey).not.toBe(deviceKey)
  })
})
