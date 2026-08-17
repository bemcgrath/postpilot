import { describe, it, expect } from "vitest"
import { createFakeKv } from "./fakeKv"
import type { Env } from "../src/types"
import handler from "../src/index"

const VOTER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
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

function voteReq(body: unknown, extra: RequestInit = {}): Request {
  return new Request("https://api.postpilotforx.com/v1/votes", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify(body),
    ...extra,
  })
}

describe("votes", () => {
  it("returns zero counts on GET", async () => {
    const res = await handler.fetch(new Request("https://api.postpilotforx.com/v1/votes", {
      headers: { Origin: ORIGIN },
    }), makeEnv())
    expect(res.status).toBe(200)
    const data = await res.json() as { counts: Record<string, number> }
    expect(data.counts["1"]).toBe(0)
    expect(data.counts["12"]).toBe(0)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN)
  })

  it("answers OPTIONS for CORS preflight", async () => {
    const res = await handler.fetch(new Request("https://api.postpilotforx.com/v1/votes", {
      method: "OPTIONS",
      headers: { Origin: ORIGIN },
    }), makeEnv())
    expect(res.status).toBe(204)
  })

  it("increments once per voter per idea", async () => {
    const env = makeEnv()
    const first = await handler.fetch(voteReq({ id: "6", voter: VOTER, action: "add" }), env)
    expect(first.status).toBe(200)
    const once = await first.json() as { counts: Record<string, number>; voted: boolean }
    expect(once.counts["6"]).toBe(1)
    expect(once.voted).toBe(true)

    const second = await handler.fetch(voteReq({ id: "6", voter: VOTER, action: "add" }), env)
    const twice = await second.json() as { counts: Record<string, number> }
    expect(twice.counts["6"]).toBe(1)
  })

  it("removes a vote", async () => {
    const env = makeEnv()
    await handler.fetch(voteReq({ id: "1", voter: VOTER, action: "add" }), env)
    const res = await handler.fetch(voteReq({ id: "1", voter: VOTER, action: "remove" }), env)
    const data = await res.json() as { counts: Record<string, number>; voted: boolean }
    expect(data.counts["1"]).toBe(0)
    expect(data.voted).toBe(false)
  })

  it("rejects a bad idea id", async () => {
    const res = await handler.fetch(voteReq({ id: "99", voter: VOTER }), makeEnv())
    expect(res.status).toBe(400)
  })

  it("rejects a foreign origin on POST", async () => {
    const res = await handler.fetch(voteReq({ id: "1", voter: VOTER }, {
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    }), makeEnv())
    expect(res.status).toBe(403)
  })
})
