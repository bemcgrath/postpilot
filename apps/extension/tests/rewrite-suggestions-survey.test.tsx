/**
 * @vitest-environment happy-dom
 */
import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
const act = React.act

const generateRewrites = vi.fn()
const shouldShowSurvey = vi.fn()
const scorePost = vi.fn()

vi.mock("~rewrite/rewrite-service", () => ({
  generateRewrites: (...a: unknown[]) => generateRewrites(...(a as [])),
}))

vi.mock("~rewrite/survey-service", () => ({
  shouldShowSurvey: (...a: unknown[]) => shouldShowSurvey(...(a as [])),
}))

// The survey prompt itself is covered by survey-prompt.test.tsx; stub it here
// so these tests assert only the wiring (was it rendered at all?).
vi.mock("../src/components/SurveyPrompt", () => ({
  SurveyPrompt: () => React.createElement("div", { "data-testid": "survey" }, "survey"),
}))

vi.mock("@postpilot/core/scoring/scoring-pipeline", () => ({
  scorePost: (...a: unknown[]) => scorePost(...(a as [])),
}))

import { RewriteSuggestions } from "../src/components/RewriteSuggestions"

const baseScore = {
  hookScore: { totalScore: 50, hookType: null, suggestions: [] },
  governor: { issues: [] },
} as any

let container: HTMLDivElement
let root: Root

function quotaError() {
  const e = new Error("QUOTA_EXCEEDED") as Error & { resetsAt?: string }
  e.resetsAt = "2026-09-03T00:00:00.000Z"
  return e
}

async function renderWith(props: Partial<Record<string, unknown>> = {}) {
  await act(async () => {
    root.render(
      React.createElement(RewriteSuggestions, {
        originalText: "some draft text",
        score: baseScore,
        isPro: false,
        fingerprint: null,
        overrides: null,
        hookTypeBoosts: undefined,
        onReplace: () => {},
        ...props,
      } as any)
    )
  })
}

/** Click "Improve this post" / "Generate 3 rewrites" (the full-mode button). */
async function clickGenerate() {
  const btn = container.querySelector(".postpilot-rewrites__btn") as HTMLButtonElement
  await act(async () => {
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
  // let the rejected promise + any chained .then(setShowSurvey) settle
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

beforeEach(() => {
  generateRewrites.mockReset()
  shouldShowSurvey.mockReset()
  scorePost.mockReset()
  scorePost.mockReturnValue(baseScore)
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe("RewriteSuggestions — survey wiring on quota exhaustion", () => {
  it("checks gating and shows the survey for a free user hitting QUOTA_EXCEEDED", async () => {
    generateRewrites.mockRejectedValue(quotaError())
    shouldShowSurvey.mockResolvedValue(true)

    await renderWith({ isPro: false })
    await clickGenerate()

    expect(shouldShowSurvey).toHaveBeenCalledTimes(1)
    expect(container.querySelector("[data-testid='survey']")).not.toBeNull()
    // upsell copy still renders alongside it — the survey must not replace it
    expect(container.querySelector(".postpilot-rewrites__pro-link")).not.toBeNull()
  })

  it("does not render the survey when gating says no (cooldown / already answered)", async () => {
    generateRewrites.mockRejectedValue(quotaError())
    shouldShowSurvey.mockResolvedValue(false)

    await renderWith({ isPro: false })
    await clickGenerate()

    expect(shouldShowSurvey).toHaveBeenCalledTimes(1)
    expect(container.querySelector("[data-testid='survey']")).toBeNull()
    expect(container.querySelector(".postpilot-rewrites__error")).not.toBeNull()
  })

  it("never checks or shows the survey for a Pro user", async () => {
    generateRewrites.mockRejectedValue(quotaError())
    shouldShowSurvey.mockResolvedValue(true)

    await renderWith({ isPro: true })
    await clickGenerate()

    expect(shouldShowSurvey).not.toHaveBeenCalled()
    expect(container.querySelector("[data-testid='survey']")).toBeNull()
    // Pro sees the quota message but no upgrade link
    expect(container.querySelector(".postpilot-rewrites__pro-link")).toBeNull()
  })

  it("never checks the survey on a non-quota error", async () => {
    generateRewrites.mockRejectedValue(new Error("NETWORK_DOWN"))
    shouldShowSurvey.mockResolvedValue(true)

    await renderWith({ isPro: false })
    await clickGenerate()

    expect(shouldShowSurvey).not.toHaveBeenCalled()
    expect(container.querySelector("[data-testid='survey']")).toBeNull()
    expect(container.querySelector(".postpilot-rewrites__error")?.textContent).toContain("NETWORK_DOWN")
  })

  it("never checks the survey on a successful generation", async () => {
    generateRewrites.mockResolvedValue({
      suggestions: [{ text: "a better draft", rationale: "tighter hook" }],
      remaining: 2,
    })

    await renderWith({ isPro: false })
    await clickGenerate()

    expect(shouldShowSurvey).not.toHaveBeenCalled()
    expect(container.querySelector("[data-testid='survey']")).toBeNull()
    expect(container.querySelector(".postpilot-rewrites__results")).not.toBeNull()
  })

  it("renders the survey via the lazy wrapper (deferred one tick, not on first paint)", async () => {
    generateRewrites.mockRejectedValue(quotaError())
    let release: (v: boolean) => void = () => {}
    shouldShowSurvey.mockReturnValue(new Promise<boolean>((r) => { release = r }))

    await renderWith({ isPro: false })
    await clickGenerate()

    // gating still pending -> quota message shown, survey not yet
    expect(container.querySelector(".postpilot-rewrites__error")).not.toBeNull()
    expect(container.querySelector("[data-testid='survey']")).toBeNull()

    await act(async () => {
      release(true)
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(container.querySelector("[data-testid='survey']")).not.toBeNull()
  })
})
