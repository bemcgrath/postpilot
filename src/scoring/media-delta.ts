import type { ComposeMedia } from "./types"

/** Algorithm priors when the learning engine has no image/link split yet. */
export const IMAGE_PRIOR_DELTA = 4
export const LINK_PRIOR_DELTA = -3

export interface MediaBoosts {
  imageBoost: number
  linkBoost: number
}

/**
 * Convert a learned ER ratio (1.0 = no difference) into a small score delta.
 * Missing or 1.0 boosts fall back to the algorithm prior.
 */
export function boostToDelta(boost: number | undefined, prior: number): number {
  if (boost == null || boost === 1) return prior
  return Math.max(-8, Math.min(8, Math.round((boost - 1) * 8)))
}

/**
 * Score attached media and links in compose.
 * Only applies a delta for what is actually present — never a hypothetical.
 */
export function computeMediaDelta(
  media: ComposeMedia,
  boosts?: MediaBoosts | null
): { delta: number; reasons: string[] } {
  const reasons: string[] = []
  let delta = 0

  if (media.hasImage || media.hasVideo) {
    const d = boostToDelta(boosts?.imageBoost, IMAGE_PRIOR_DELTA)
    delta += d
    if (d !== 0) {
      reasons.push(d > 0 ? `Image/video ${d > 0 ? "+" : ""}${d}` : `Image/video ${d}`)
    }
  }

  if (media.hasLink) {
    const d = boostToDelta(boosts?.linkBoost, LINK_PRIOR_DELTA)
    delta += d
    if (d !== 0) {
      reasons.push(`Link ${d > 0 ? "+" : ""}${d}`)
    }
  }

  return { delta, reasons }
}

export const EMPTY_MEDIA: ComposeMedia = {
  hasImage: false,
  hasVideo: false,
  hasLink: false
}
