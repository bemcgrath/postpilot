/**
 * @vitest-environment happy-dom
 */
import React from "react"
import { createRoot, type Root } from "react-dom/client"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

// happy-dom doesn't set this by default; React's act() warns without it.
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
const act = React.act

const markSurveyShown = vi.fn(async () => {})
const submitSurveyResponse = vi.fn(async () => {})

vi.mock("~rewrite/survey-service", async () => {
  const actual = await vi.importActual<typeof import("../src/rewrite/survey-service")>(
    "../src/rewrite/survey-service"
  )
  return {
    ...actual,
    markSurveyShown: (...args: unknown[]) => markSurveyShown(...(args as [])),
    submitSurveyResponse: (...args: unknown[]) => submitSurveyResponse(...(args as [])),
  }
})

import { SurveyPrompt } from "../src/components/SurveyPrompt"

let container: HTMLDivElement
let root: Root

async function render() {
  await act(async () => {
    root.render(<SurveyPrompt />)
  })
}

function click(el: Element | null) {
  if (!el) throw new Error("element not found")
  ;(el as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }))
}

function optionButtons() {
  return Array.from(container.querySelectorAll(".postpilot-survey__option"))
}

beforeEach(() => {
  markSurveyShown.mockClear()
  submitSurveyResponse.mockClear()
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe("SurveyPrompt", () => {
  it("renders the question and all 5 options, and marks itself shown on mount", async () => {
    await render()
    expect(container.querySelector(".postpilot-survey__question")?.textContent).toBe(
      "What's stopping you from going Pro?"
    )
    expect(optionButtons()).toHaveLength(5)
    expect(optionButtons().map((b) => b.textContent)).toEqual([
      "Not sure what I'd get",
      "Too expensive",
      "Haven't used it enough yet",
      "Just browsing",
      "Other",
    ])
    expect(markSurveyShown).toHaveBeenCalledTimes(1)
  })

  it("reveals a freetext textarea after picking any reason, capped at 500 chars", async () => {
    await render()
    expect(container.querySelector(".postpilot-survey__freetext")).toBeNull()

    await act(async () => click(optionButtons()[1])) // "Too expensive"
    const textarea = container.querySelector(".postpilot-survey__freetext") as HTMLTextAreaElement
    expect(textarea).not.toBeNull()
    expect(textarea.maxLength).toBe(500)
  })

  it("reveals freetext for 'Other' too", async () => {
    await render()
    await act(async () => click(optionButtons()[4])) // "Other"
    expect(container.querySelector(".postpilot-survey__freetext")).not.toBeNull()
  })

  it("keeps submit disabled until a reason is picked", async () => {
    await render()
    const submit = container.querySelector(".postpilot-survey__submit") as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    await act(async () => click(optionButtons()[0]))
    expect(submit.disabled).toBe(false)
  })

  it("submits the picked reason and freetext, shows Sending state, then Thanks", async () => {
    let resolveSubmit: () => void = () => {}
    submitSurveyResponse.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve
        })
    )

    await render()
    await act(async () => click(optionButtons()[2])) // "Haven't used it enough yet"

    const textarea = container.querySelector(".postpilot-survey__freetext") as HTMLTextAreaElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )!.set!
      setter.call(textarea, "still exploring")
      textarea.dispatchEvent(new Event("input", { bubbles: true }))
    })

    const submit = container.querySelector(".postpilot-survey__submit") as HTMLButtonElement
    await act(async () => click(submit))

    expect(submitSurveyResponse).toHaveBeenCalledWith("not_used_enough", "still exploring")
    expect(container.querySelector(".postpilot-survey__submit")?.textContent).toBe("Sending…")
    expect((container.querySelector(".postpilot-survey__submit") as HTMLButtonElement).disabled).toBe(true)
    expect(container.querySelector(".postpilot-survey__thanks")).toBeNull()

    await act(async () => {
      resolveSubmit()
      await Promise.resolve()
    })

    expect(container.querySelector(".postpilot-survey__thanks")?.textContent).toBe(
      "Thanks — that helps us know what to improve."
    )
    expect(container.querySelector(".postpilot-survey__question")).toBeNull()
  })

  it("passes undefined freetext when left blank", async () => {
    submitSurveyResponse.mockResolvedValue(undefined)
    await render()
    await act(async () => click(optionButtons()[3])) // "Just browsing"
    const submit = container.querySelector(".postpilot-survey__submit") as HTMLButtonElement
    await act(async () => click(submit))
    expect(submitSurveyResponse).toHaveBeenCalledWith("just_browsing", undefined)
  })

  it("dismisses on close (×) without submitting", async () => {
    await render()
    await act(async () => click(optionButtons()[0]))
    const close = container.querySelector(".postpilot-survey__close")
    await act(async () => click(close))
    expect(container.querySelector(".postpilot-survey")).toBeNull()
    expect(submitSurveyResponse).not.toHaveBeenCalled()
  })
})
