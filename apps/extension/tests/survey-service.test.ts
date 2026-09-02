import { describe, it, expect, beforeEach, vi } from "vitest"

// Minimal chrome.storage.local stub backed by a plain object.
const store: Record<string, unknown> = {}
const storageMock = {
  get: async (keys: string | string[] | null) => {
    const out: Record<string, unknown> = {}
    const wanted = keys == null ? Object.keys(store) : Array.isArray(keys) ? keys : [keys]
    for (const k of wanted) if (k in store) out[k] = store[k]
    return out
  },
  set: async (obj: Record<string, unknown>) => {
    Object.assign(store, obj)
  },
  remove: async (keys: string | string[]) => {
    for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k]
  },
}

vi.stubGlobal("chrome", { storage: { local: storageMock } })

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

import { shouldShowSurvey, markSurveyShown, submitSurveyResponse } from "../src/rewrite/survey-service"

const LAST_SHOWN_KEY = "pp_survey_last_shown_v1"
const ANSWERED_KEY = "pp_survey_answered_v1"
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true })
  vi.stubGlobal("chrome", { storage: { local: storageMock } })
})

describe("survey gating", () => {
  it("shows on first run (no last-shown, not answered)", async () => {
    expect(await shouldShowSurvey()).toBe(true)
  })

  it("does not re-show within the 30-day cooldown", async () => {
    await markSurveyShown()
    expect(await shouldShowSurvey()).toBe(false)
  })

  it("shows again once the 30-day cooldown has elapsed", async () => {
    store[LAST_SHOWN_KEY] = Date.now() - 31 * DAY
    expect(await shouldShowSurvey()).toBe(true)
  })

  it("never shows after the survey has been answered", async () => {
    store[LAST_SHOWN_KEY] = Date.now() - 90 * DAY
    await submitSurveyResponse("too_expensive")
    expect(await shouldShowSurvey()).toBe(false)
  })

  it("returns false (safe default) when chrome.storage throws", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: () => Promise.reject(new Error("context invalidated")),
          set: () => Promise.reject(new Error("context invalidated")),
        },
      },
    })
    expect(await shouldShowSurvey()).toBe(false)
    expect(await markSurveyShown()).toBeUndefined()
    // Restore the shared mock so later tests keep working storage.
    vi.stubGlobal("chrome", { storage: { local: storageMock } })
  })
})

const flushAsync = () => new Promise((r) => setTimeout(r, 20))

describe("submitSurveyResponse", () => {
  it("persists the answer locally and sends the anonymous signal", async () => {
    await submitSurveyResponse("too_expensive", "  10 bucks is a lot  ")
    await flushAsync()
    const answered = store[ANSWERED_KEY] as { reason: string; text: string; at: string }
    expect(answered.reason).toBe("too_expensive")
    expect(answered.text).toBe("10 bucks is a lot")
    expect(typeof answered.at).toBe("string")
    expect(fetchMock).toHaveBeenCalled()
    // The earlier gating tests may have fired their own signals; find ours.
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string))
    expect(bodies).toContainEqual({ reason: "too_expensive", freetext: "10 bucks is a lot" })
  })

  it("omits freetext when blank and caps length at 500", async () => {
    await submitSurveyResponse("other", "   ")
    await flushAsync()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ reason: "other" })

    await submitSurveyResponse("other", "x".repeat(600))
    await flushAsync()
    const body = JSON.parse(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1].body as string)
    expect(body.freetext).toHaveLength(500)
  })

  it("still answers locally when the network call fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"))
    await submitSurveyResponse("just_browsing")
    await flushAsync()
    expect((store[ANSWERED_KEY] as { reason: string }).reason).toBe("just_browsing")
  })

  it("carries no user identifier in the payload", async () => {
    await submitSurveyResponse("not_used_enough")
    await flushAsync()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(Object.keys(body)).toEqual(["reason"])
  })
})
