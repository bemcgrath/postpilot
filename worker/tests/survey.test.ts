import { describe, it, expect } from "vitest"
import { createFakeKv } from "./fakeKv"
import type { Env } from "../src/types"
import handler from "../src/index"

const ORIGIN = "https://postpilotforx.com"

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

function surveyReq(body: unknown, extra: RequestInit = {}): Request {
  return new Request("https://api.postpilotforx.com/v1/survey", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify(body),
    ...extra,
  })
}

describe("survey", () => {
  it("returns zero counts and empty freetext on GET", async () => {
    const res = await handler.fetch(
      new Request("https://api.postpilotforx.com/v1/survey", { headers: { Origin: ORIGIN } }),
      makeEnv()
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as { counts: Record<string, number>; freetext: unknown[] }
    expect(data.counts.too_expensive).toBe(0)
    expect(data.counts.other).toBe(0)
    expect(data.freetext).toEqual([])
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN)
  })

  it("answers OPTIONS for CORS preflight", async () => {
    const res = await handler.fetch(
      new Request("https://api.postpilotforx.com/v1/survey", { method: "OPTIONS", headers: { Origin: ORIGIN } }),
      makeEnv()
    )
    expect(res.status).toBe(204)
  })

  it("increments the count for a valid reason", async () => {
    const env = makeEnv()
    const res = await handler.fetch(surveyReq({ reason: "too_expensive" }), env)
    expect(res.status).toBe(200)
    const getRes = await handler.fetch(
      new Request("https://api.postpilotforx.com/v1/survey", { headers: { Origin: ORIGIN } }),
      env
    )
    const data = (await getRes.json()) as { counts: Record<string, number> }
    expect(data.counts.too_expensive).toBe(1)
  })

  it("stores trimmed freetext alongside the reason", async () => {
    const env = makeEnv()
    await handler.fetch(surveyReq({ reason: "other", freetext: "  needs team seats  " }), env)
    const getRes = await handler.fetch(
      new Request("https://api.postpilotforx.com/v1/survey", { headers: { Origin: ORIGIN } }),
      env
    )
    const data = (await getRes.json()) as { freetext: Array<{ reason: string; text: string }> }
    expect(data.freetext).toHaveLength(1)
    expect(data.freetext[0].reason).toBe("other")
    expect(data.freetext[0].text).toBe("needs team seats")
  })

  it("does not store an entry when freetext is empty", async () => {
    const env = makeEnv()
    await handler.fetch(surveyReq({ reason: "just_browsing", freetext: "   " }), env)
    const getRes = await handler.fetch(
      new Request("https://api.postpilotforx.com/v1/survey", { headers: { Origin: ORIGIN } }),
      env
    )
    const data = (await getRes.json()) as { freetext: unknown[] }
    expect(data.freetext).toEqual([])
  })

  it("rejects an unknown reason", async () => {
    const res = await handler.fetch(surveyReq({ reason: "made_up" }), makeEnv())
    expect(res.status).toBe(400)
  })

  it("rejects a non-string freetext", async () => {
    const res = await handler.fetch(surveyReq({ reason: "other", freetext: 5 }), makeEnv())
    expect(res.status).toBe(400)
  })

  it("rejects a foreign origin on POST", async () => {
    const res = await handler.fetch(
      surveyReq({ reason: "too_expensive" }, { headers: { "Content-Type": "application/json", Origin: "https://evil.example" } }),
      makeEnv()
    )
    expect(res.status).toBe(403)
  })

  it("carries no identifier -- request body has no user/device field accepted", async () => {
    const env = makeEnv()
    const res = await handler.fetch(
      surveyReq({ reason: "not_used_enough", freetext: "still learning it", userId: "should-be-ignored" }),
      env
    )
    expect(res.status).toBe(200)
    const getRes = await handler.fetch(
      new Request("https://api.postpilotforx.com/v1/survey", { headers: { Origin: ORIGIN } }),
      env
    )
    const data = (await getRes.json()) as { freetext: Array<Record<string, unknown>> }
    expect(Object.keys(data.freetext[0]).sort()).toEqual(["at", "reason", "text"])
  })
})
