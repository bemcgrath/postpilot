import React from "react"

interface Props {
  count: number
  inSweetSpot: boolean
  sweetSpotRange: { min: number; max: number }
}

export function CharacterCount({ count, inSweetSpot, sweetSpotRange }: Props) {
  let className = "postpilot-char-count"
  let label = ""

  // +30 over the band's max mirrors the original hardcoded 320/350
  // relationship exactly, generalized to whichever band was actually
  // applied (originals' 280-320, a reply's 60-160, or a learned band).
  if (inSweetSpot) {
    className += " postpilot-char-count--sweet"
    label = "sweet spot"
  } else if (count > sweetSpotRange.max + 30) {
    className += " postpilot-char-count--over"
    label = "too long"
  } else if (count > sweetSpotRange.max) {
    className += " postpilot-char-count--long"
    label = "long"
  }

  return (
    <span className={className}>
      {count}
      {label ? ` (${label})` : ""}
    </span>
  )
}
