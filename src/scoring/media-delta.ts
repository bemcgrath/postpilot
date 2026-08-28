import type { ComposeMedia } from "./types"

/**
 * Cold-start defaults, used until the learning engine has enough of the
 * user's own posts to replace them with a real learned boost.
 *
 * IMAGE_PRIOR_DELTA / VIDEO_PRIOR_DELTA: photo and native video are scored
 * separately because X's own published ranking algorithm does
 * (xai-org/x-algorithm, home-mixer/params/param.rs: PhotoExpandWeight 0.05,
 * VideoOpenWeight 0.07 — video ~1.4x a photo). VIDEO_PRIOR_DELTA scales
 * IMAGE_PRIOR_DELTA by that same ratio. It is not a claim that these exact
 * point values appear in X's model — only the photo/video split and its
 * rough proportion are grounded in the public source; the rest is a modest,
 * intentionally conservative default.
 *
 * LINK_PRIOR_DELTA: a conservative default, NOT sourced from X's published
 * algorithm. The public weights file has no link penalty at all — a link
 * open/share is modeled as a positive engagement signal, not a negative one
 * — and nothing in the public repo distinguishes Premium/non-Premium
 * treatment. Some ranking components (e.g. spam/gaming rules) are
 * deliberately unpublished, so a real penalty may exist that this can't cite.
 * This prior exists only to give free-tier and cold-start users *some*
 * signal; it is replaced entirely by the user's own learned linkBoost once
 * enough of their posts with and without links have been collected.
 */
export const IMAGE_PRIOR_DELTA = 4
export const VIDEO_PRIOR_DELTA = 6
export const LINK_PRIOR_DELTA = -3

export interface MediaBoosts {
  imageBoost: number
  videoBoost: number
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
 * Image and video are scored independently (see the priors above); a post
 * with both gets both deltas.
 */
export function computeMediaDelta(
  media: ComposeMedia,
  boosts?: MediaBoosts | null
): { delta: number; reasons: string[] } {
  const reasons: string[] = []
  let delta = 0

  if (media.hasImage) {
    const d = boostToDelta(boosts?.imageBoost, IMAGE_PRIOR_DELTA)
    delta += d
    if (d !== 0) {
      reasons.push(`Image ${d > 0 ? "+" : ""}${d}`)
    }
  }

  if (media.hasVideo) {
    const d = boostToDelta(boosts?.videoBoost, VIDEO_PRIOR_DELTA)
    delta += d
    if (d !== 0) {
      reasons.push(`Video ${d > 0 ? "+" : ""}${d}`)
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
