import { describe, expect, it } from "vitest"
import { parseCompactNumber } from "~learning/collector"

describe("parseCompactNumber", () => {
  it("parses plain numbers", () => {
    expect(parseCompactNumber("123")).toBe(123)
    expect(parseCompactNumber("0")).toBe(0)
    expect(parseCompactNumber("1500")).toBe(1500)
  })

  it("parses K suffix", () => {
    expect(parseCompactNumber("1.2K")).toBe(1200)
    expect(parseCompactNumber("12.3K")).toBe(12300)
    expect(parseCompactNumber("500K")).toBe(500000)
    expect(parseCompactNumber("1k")).toBe(1000)
  })

  it("parses M suffix", () => {
    expect(parseCompactNumber("1.5M")).toBe(1500000)
    expect(parseCompactNumber("2M")).toBe(2000000)
    expect(parseCompactNumber("0.5m")).toBe(500000)
  })

  it("parses B suffix", () => {
    expect(parseCompactNumber("1B")).toBe(1000000000)
    expect(parseCompactNumber("2.5b")).toBe(2500000000)
  })

  it("handles commas and spaces", () => {
    expect(parseCompactNumber("1,234")).toBe(1234)
    expect(parseCompactNumber(" 500 ")).toBe(500)
  })

  it("returns 0 for empty/invalid input", () => {
    expect(parseCompactNumber("")).toBe(0)
    expect(parseCompactNumber("abc")).toBe(0)
    expect(parseCompactNumber("--")).toBe(0)
  })
})
