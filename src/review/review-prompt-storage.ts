const REVIEW_KEY = "postpilot_review_prompt"
const WINS_TO_TRIGGER = 3

export const REVIEW_URL =
  "https://chromewebstore.google.com/detail/postpilot-for-x/jhpaadadlahdlmkoejpfdlflkpofcjgf/reviews"

interface ReviewPromptState {
  wins: number
  done: boolean
}

function getStorage(): typeof chrome.storage.local | null {
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime?.id &&
      typeof chrome.storage !== "undefined" &&
      typeof chrome.storage.local !== "undefined"
    ) {
      return chrome.storage.local
    }
  } catch {}
  return null
}

async function loadState(): Promise<ReviewPromptState> {
  const storage = getStorage()
  if (!storage) return { wins: 0, done: true }
  return new Promise((resolve) => {
    storage.get(REVIEW_KEY, (result) => {
      resolve((result[REVIEW_KEY] as ReviewPromptState) ?? { wins: 0, done: false })
    })
  })
}

async function saveState(state: ReviewPromptState): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => {
    storage.set({ [REVIEW_KEY]: state }, resolve)
  })
}

/** Record a published post scoring 70+. Returns true when the prompt should now be shown. */
export async function recordHighScorePost(): Promise<boolean> {
  const state = await loadState()
  if (state.done) return false
  const next = { ...state, wins: state.wins + 1 }
  await saveState(next)
  return next.wins >= WINS_TO_TRIGGER
}

/** Whether a previously earned prompt is still waiting for the user to act on it. */
export async function shouldShowPrompt(): Promise<boolean> {
  const state = await loadState()
  return !state.done && state.wins >= WINS_TO_TRIGGER
}

/** Permanently retire the prompt (user reviewed or dismissed). */
export async function markPromptDone(): Promise<void> {
  const state = await loadState()
  await saveState({ ...state, done: true })
}
