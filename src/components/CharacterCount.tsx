import React from "react"

interface Props {
  count: number
  inSweetSpot: boolean
}

export function CharacterCount({ count, inSweetSpot }: Props) {
  let className = "postpilot-char-count"
  let label = ""

  if (inSweetSpot) {
    className += " postpilot-char-count--sweet"
    label = "sweet spot"
  } else if (count > 350) {
    className += " postpilot-char-count--over"
    label = "too long"
  } else if (count > 320) {
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
