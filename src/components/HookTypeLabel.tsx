import React from "react"

import type { HookTypeName } from "~scoring/types"

import { getHookTypeWeight, humanizeHookType } from "~scoring/hook-types"

interface Props {
  hookType: HookTypeName | null
}

export function HookTypeLabel({ hookType }: Props) {
  if (!hookType) {
    return (
      <div className="postpilot-hook-type">
        <span className="postpilot-hook-type__name" style={{ color: "#71767b" }}>
          No hook detected
        </span>
      </div>
    )
  }

  const weight = getHookTypeWeight(hookType)

  return (
    <div className="postpilot-hook-type">
      <span className="postpilot-hook-type__name">
        {humanizeHookType(hookType)}
      </span>
      <span className="postpilot-hook-type__weight">{weight.toFixed(2)}x</span>
    </div>
  )
}
