import type { LearnedInsights } from "@postpilot/core/learning/types"
import { computeInsights } from "@postpilot/core/learning/engine"
import { loadCollectedPosts, loadLearnedInsights, saveLearnedInsights } from "./storage"

export { computeInsights }

/**
 * Run the full learning engine on collected posts: load from storage, run
 * the pure computation, save the result. Split out of
 * @postpilot/core/learning/engine (2026-08-28 monorepo extraction) because
 * it's the one part of "the learning engine" that isn't actually pure --
 * everything computeInsights() does is; this is just its storage-touching
 * shell.
 */
export async function runLearningEngine(): Promise<LearnedInsights> {
  const posts = await loadCollectedPosts()
  const previousInsights = await loadLearnedInsights()

  const insights = computeInsights(posts, previousInsights)

  await saveLearnedInsights(insights)
  return insights
}
