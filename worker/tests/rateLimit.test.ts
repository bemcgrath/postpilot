import { describe, it, expect } from "vitest"
import { checkAndIncrement } from "../src/rateLimit"
import { createFakeKv } from "./fakeKv"
import type { Env } from "../src/types"

function makeEnv(): Env {
  return {
    RATE_LIMIT_KV: createFakeKv(),
    ANTHROPIC_API_KEY: "test-key",
    MODEL_ID: "claude-sonnet-5",
    FREE_DAILY_CAP: "3",
    PRO_DAILY_CAP: "40",
  }
}

describe("checkAndIncrement", () => {
  it("allows requests under the cap", async () => {
    const env = makeEnv()
    const result = await checkAndIncrement(env, "device:abc", 3)
    expect(result.allowed).toBe(true)
  })

  it("allows exactly up to the cap, then blocks the next request", async () => {
    const env = makeEnv()
    const id = "device:cap-test"
    const r1 = await checkAndIncrement(env, id, 2)
    const r2 = await checkAndIncrement(env, id, 2)
    const r3 = await checkAndIncrement(env, id, 2)
    expect(r1.allowed).toBe(true)
    expect(r2.allowed).toBe(true)
    expect(r3.allowed).toBe(false)
  })

  it("returns a resetsAt timestamp at the next UTC midnight when blocked", async () => {
    const env = makeEnv()
    const id = "device:reset-test"
    await checkAndIncrement(env, id, 1)
    const blocked = await checkAndIncrement(env, id, 1)
    expect(blocked.allowed).toBe(false)
    const resetsAt = new Date(blocked.resetsAt)
    expect(resetsAt.getUTCHours()).toBe(0)
    expect(resetsAt.getUTCMinutes()).toBe(0)
    expect(resetsAt.getUTCSeconds()).toBe(0)
    expect(resetsAt.getTime()).toBeGreaterThan(Date.now())
  })

  it("tracks separate identities independently", async () => {
    const env = makeEnv()
    await checkAndIncrement(env, "device:a", 1)
    const bResult = await checkAndIncrement(env, "device:b", 1)
    expect(bResult.allowed).toBe(true)
  })

  it("a license identity and a device identity with the same raw value don't collide", async () => {
    const env = makeEnv()
    await checkAndIncrement(env, "license:shared-value", 1)
    const deviceResult = await checkAndIncrement(env, "device:shared-value", 1)
    expect(deviceResult.allowed).toBe(true)
  })
})
