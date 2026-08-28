import { describe, expect, it } from "vitest"
import {
  boostToDelta,
  computeMediaDelta,
  IMAGE_PRIOR_DELTA,
  VIDEO_PRIOR_DELTA,
  LINK_PRIOR_DELTA
} from "~scoring/media-delta"

describe("boostToDelta", () => {
  it("uses the prior when boost is missing or 1", () => {
    expect(boostToDelta(undefined, 4)).toBe(4)
    expect(boostToDelta(1, 4)).toBe(4)
  })

  it("converts a learned ratio into a clamped point delta", () => {
    expect(boostToDelta(1.5, 4)).toBe(4)
    expect(boostToDelta(0.5, -3)).toBe(-4)
    expect(boostToDelta(3, 4)).toBe(8)
  })
})

describe("computeMediaDelta", () => {
  it("applies image and link priors when nothing is learned", () => {
    const { delta } = computeMediaDelta(
      { hasImage: true, hasVideo: false, hasLink: true },
      null
    )
    expect(delta).toBe(IMAGE_PRIOR_DELTA + LINK_PRIOR_DELTA)
  })

  it("does nothing when no media is present", () => {
    const { delta } = computeMediaDelta(
      { hasImage: false, hasVideo: false, hasLink: false },
      { imageBoost: 2, videoBoost: 2, linkBoost: 0.5 }
    )
    expect(delta).toBe(0)
  })

  it("uses learned boosts when ready", () => {
    const { delta } = computeMediaDelta(
      { hasImage: true, hasVideo: false, hasLink: false },
      { imageBoost: 1.25, videoBoost: 1, linkBoost: 0.5 }
    )
    expect(delta).toBe(2)
  })

  it("scores video independently from image, with its own prior", () => {
    const { delta, reasons } = computeMediaDelta(
      { hasImage: false, hasVideo: true, hasLink: false },
      null
    )
    expect(delta).toBe(VIDEO_PRIOR_DELTA)
    expect(reasons).toEqual([`Video +${VIDEO_PRIOR_DELTA}`])
  })

  it("applies both image and video deltas when a post somehow has both", () => {
    const { delta } = computeMediaDelta(
      { hasImage: true, hasVideo: true, hasLink: false },
      null
    )
    expect(delta).toBe(IMAGE_PRIOR_DELTA + VIDEO_PRIOR_DELTA)
  })

  it("uses a learned video boost over the prior", () => {
    const { delta } = computeMediaDelta(
      { hasImage: false, hasVideo: true, hasLink: false },
      { imageBoost: 1, videoBoost: 1.25, linkBoost: 1 }
    )
    expect(delta).toBe(2)
  })
})
