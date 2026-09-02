import { describe, it, expect, vi, beforeEach } from "vitest"

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

import { sendSurveySignal } from "../src/rewrite/survey-endpoint"
import { SURVEY_ENDPOINT } from "../src/rewrite/survey-service"

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true })
})

/**
 * survey-service.test.ts asserts payload shape through a mocked fetch, but
 * nothing asserted the request actually targets SURVEY_ENDPOINT. If that
 * constant is repointed (as it was on 2026-09-02, from the not-yet-live
 * api.postpilotforx.com to the workers.dev URL), these catch a drift between
 * the constant and what gets sent.
 */
describe("sendSurveySignal", () => {
  it("POSTs to SURVEY_ENDPOINT exactly, with JSON content type", () => {
    sendSurveySignal("too_expensive")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(SURVEY_ENDPOINT)
    expect(init.method).toBe("POST")
    expect(init.headers).toEqual({ "Content-Type": "application/json" })
  })

  it("targets the deployed worker host over https (not the unconfigured custom domain)", () => {
    const parsed = new URL(SURVEY_ENDPOINT)
    expect(parsed.protocol).toBe("https:")
    expect(parsed.pathname).toBe("/v1/survey")
    // api.postpilotforx.com has no DNS record yet; sending there is a silent no-op.
    expect(parsed.hostname).not.toBe("api.postpilotforx.com")
  })

  it("sends the host declared in the extension manifest's host_permissions", async () => {
    // A fetch to a host missing from host_permissions is blocked at runtime,
    // which would make the survey silently never report.
    const pkg = await import("../package.json")
    const hosts: string[] = (pkg as any).default?.manifest?.host_permissions ?? []
    const origin = new URL(SURVEY_ENDPOINT).origin
    expect(hosts.some((h) => h.startsWith(origin))).toBe(true)
  })

  it("includes freetext only when provided", () => {
    sendSurveySignal("other", "too pricey for me")
    let body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({ reason: "other", freetext: "too pricey for me" })

    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true })
    sendSurveySignal("just_browsing")
    body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({ reason: "just_browsing" })
  })

  it("swallows a rejected fetch so telemetry never breaks the survey UX", () => {
    fetchMock.mockRejectedValue(new Error("offline"))
    expect(() => sendSurveySignal("not_used_enough")).not.toThrow()
  })

  it("swallows a synchronous fetch throw too", () => {
    fetchMock.mockImplementation(() => {
      throw new Error("blocked by extension CSP")
    })
    expect(() => sendSurveySignal("not_sure_what_id_get")).not.toThrow()
  })
})
