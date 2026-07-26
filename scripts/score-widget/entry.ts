import { scorePost } from "~scoring/scoring-pipeline"
import { humanizeHookType } from "~scoring/hook-types"

declare global {
  interface Window {
    PostPilotScore: {
      score: typeof scorePost
      humanizeHookType: typeof humanizeHookType
    }
  }
}

window.PostPilotScore = { score: scorePost, humanizeHookType }
