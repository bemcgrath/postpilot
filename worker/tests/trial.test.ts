import { describe, it, expect } from "vitest"
import { createFakeKv } from "./fakeKv"
import type { Env } from "../src/types"
import handler from "../src/index"
import { isOnTrial } from "../src/trial"

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

function trialReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://api.postpilotforx.com/v1/trial", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PostPilot-Key": "test-secret", ...headers },
    body: JSON.stringify(body),
  })
}

function trialStatusReq(deviceId: string, headers: Record<string, string> = {}): Request {
  return new Request(
    `https://api.postpilotforx.com/v1/trial?deviceId=${encodeURIComponent(deviceId)}`,
    { headers: { "X-PostPilot-Key": "test-secret", ...headers } }
  )
}

describe("POST /v1/trial", () => {
  it("401s when the client key is missing", async () => {
    const res = await handler.fetch(
      new Request("https://api.postpilotforx.com/v1/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: "dev-1" }),
      }),
      makeEnv()
    )
    expect(res.status).toBe(401)
  })

  it("starts a new trial and returns 7 days left", async () => {
    const env = makeEnv()
    const res = await handler.fetch(trialReq({ deviceId: "dev-1" }), env)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { active: boolean; daysLeft: number; expiresAt: string }
    expect(data.active).toBe(true)
    expect(data.daysLeft).toBe(7)
    expect(data.expiresAt).toBeTruthy()
  })

  it("is idempotent -- a second start does not push the expiry out", async () => {
    const env = makeEnv()
    const first = await handler.fetch(trialReq({ deviceId: "dev-1" }), env)
    const firstData = (await first.json()) as { started: number }

    const second = await handler.fetch(trialReq({ deviceId: "dev-1" }), env)
    const secondData = (await second.json()) as { started: number }

    expect(secondData.started).toBe(firstData.started)
  })

  it("does not let one device's trial affect another", async () => {
    const env = makeEnv()
    await handler.fetch(trialReq({ deviceId: "dev-1" }), env)
    const res = await handler.fetch(trialStatusReq("dev-2"), env)
    const data = (await res.json()) as { active: boolean }
    expect(data.active).toBe(false)
  })

  it("400s when deviceId is missing", async () => {
    const res = await handler.fetch(trialReq({}), makeEnv())
    expect(res.status).toBe(400)
  })

  it("400s when deviceId is not a string", async () => {
    const res = await handler.fetch(trialReq({ deviceId: 123 }), makeEnv())
    expect(res.status).toBe(400)
  })

  it("400s on invalid JSON", async () => {
    const res = await handler.fetch(
      new Request("https://api.postpilotforx.com/v1/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-PostPilot-Key": "test-secret" },
        body: "{not json",
      }),
      makeEnv()
    )
    expect(res.status).toBe(400)
  })

  it("405s on DELETE", async () => {
    const res = await handler.fetch(
      new Request("https://api.postpilotforx.com/v1/trial", {
        method: "DELETE",
        headers: { "X-PostPilot-Key": "test-secret" },
      }),
      makeEnv()
    )
    expect(res.status).toBe(405)
  })
})

describe("GET /v1/trial", () => {
  it("reports inactive for a device that never started a trial", async () => {
    const res = await handler.fetch(trialStatusReq("never-started"), makeEnv())
    expect(res.status).toBe(200)
    const data = (await res.json()) as { active: boolean }
    expect(data.active).toBe(false)
  })

  it("reports active with daysLeft after starting", async () => {
    const env = makeEnv()
    await handler.fetch(trialReq({ deviceId: "dev-1" }), env)
    const res = await handler.fetch(trialStatusReq("dev-1"), env)
    const data = (await res.json()) as { active: boolean; daysLeft: number }
    expect(data.active).toBe(true)
    expect(data.daysLeft).toBe(7)
  })

  it("400s when deviceId query param is missing", async () => {
    const res = await handler.fetch(
      new Request("https://api.postpilotforx.com/v1/trial", { headers: { "X-PostPilot-Key": "test-secret" } }),
      makeEnv()
    )
    expect(res.status).toBe(400)
  })
})

describe("isOnTrial", () => {
  it("is false for a device with no trial record", async () => {
    const env = makeEnv()
    expect(await isOnTrial(env, "dev-1")).toBe(false)
  })

  it("is true right after a trial starts", async () => {
    const env = makeEnv()
    await handler.fetch(trialReq({ deviceId: "dev-1" }), env)
    expect(await isOnTrial(env, "dev-1")).toBe(true)
  })

  it("is false once the TTL-backed record is gone (fakeKv has no TTL eviction, so simulate an expired started timestamp)", async () => {
    const env = makeEnv()
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    await env.RATE_LIMIT_KV.put("trial:dev-1", JSON.stringify({ started: eightDaysAgo }))
    expect(await isOnTrial(env, "dev-1")).toBe(false)
  })
})

describe("resolveTier for a trialing device", () => {
  it("grants trial tier once a device has started a trial", async () => {
    const env = makeEnv()
    await handler.fetch(trialReq({ deviceId: "trial-dev" }), env)

    const { resolveTier } = await import("../src/entitlement")
    const tier = await resolveTier(env, { type: "device", deviceId: "trial-dev" })
    expect(tier).toBe("trial")
  })

  it("dailyCapFor treats trial the same as pro", async () => {
    const { dailyCapFor } = await import("../src/entitlement")
    const env = makeEnv()
    expect(dailyCapFor(env, "trial")).toBe(dailyCapFor(env, "pro"))
  })
})
