export interface ChecklistItem {
  id: string
  ok: boolean
  label: string
}

export function buildPrePublishChecklist(args: {
  hookScore: number
  governorErrors: number
  inSweetSpot: boolean
  hasImage: boolean
  hasLink: boolean
  mediaDelta: number
  nowGood: boolean | null
}): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      id: "hook",
      ok: args.hookScore >= 60,
      label: args.hookScore >= 60 ? "Hook is solid" : "Hook is weak"
    },
    {
      id: "governor",
      ok: args.governorErrors === 0,
      label:
        args.governorErrors === 0
          ? "No blocking phrases"
          : `${args.governorErrors} blocking issue${args.governorErrors === 1 ? "" : "s"}`
    },
    {
      id: "length",
      ok: args.inSweetSpot,
      label: args.inSweetSpot ? "Length in the sweet spot" : "Length outside the sweet spot"
    }
  ]

  if (args.hasImage || args.hasLink) {
    const bits = [
      args.hasImage ? "image" : null,
      args.hasLink ? "link" : null
    ].filter(Boolean)
    const delta =
      args.mediaDelta === 0
        ? ""
        : ` (${args.mediaDelta > 0 ? "+" : ""}${args.mediaDelta})`
    items.push({
      id: "media",
      ok: args.mediaDelta >= 0,
      label: `${bits.join(" + ")} attached${delta}`
    })
  }

  if (args.nowGood !== null) {
    items.push({
      id: "time",
      ok: args.nowGood,
      label: args.nowGood ? "Now is a good time" : "Not your best hour"
    })
  }

  return items
}
