import type { SamplePost, VoiceFingerprint, VoiceOverrides } from "./voice-types"

const KEY_SAMPLE_POSTS = "postpilot_sample_posts"
const KEY_FINGERPRINT = "postpilot_voice_fingerprint"
const KEY_VOICE_PROFILE = "postpilot_voice_profile"
const KEY_NICHE_SPEC = "postpilot_niche_spec"
const KEY_VOICE_OVERRIDES = "postpilot_voice_overrides"

/** Safely access chrome.storage.local — returns null if unavailable or context invalidated. */
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
  } catch {
    // Extension context invalidated or not available
  }
  return null
}

export async function loadSamplePosts(): Promise<SamplePost[]> {
  const storage = getStorage()
  if (!storage) return []
  return new Promise((resolve) => {
    storage.get(KEY_SAMPLE_POSTS, (result) => {
      resolve((result[KEY_SAMPLE_POSTS] as SamplePost[]) ?? [])
    })
  })
}

export async function saveSamplePosts(posts: SamplePost[]): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => {
    storage.set({ [KEY_SAMPLE_POSTS]: posts }, resolve)
  })
}

export async function loadFingerprint(): Promise<VoiceFingerprint | null> {
  const storage = getStorage()
  if (!storage) return null
  return new Promise((resolve) => {
    storage.get(KEY_FINGERPRINT, (result) => {
      resolve((result[KEY_FINGERPRINT] as VoiceFingerprint) ?? null)
    })
  })
}

export async function saveFingerprint(
  fp: VoiceFingerprint | null
): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => {
    storage.set({ [KEY_FINGERPRINT]: fp }, resolve)
  })
}

export async function loadVoiceProfile(): Promise<string> {
  const storage = getStorage()
  if (!storage) return ""
  return new Promise((resolve) => {
    storage.get(KEY_VOICE_PROFILE, (result) => {
      resolve((result[KEY_VOICE_PROFILE] as string) ?? "")
    })
  })
}

export async function saveVoiceProfile(text: string): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => {
    storage.set({ [KEY_VOICE_PROFILE]: text }, resolve)
  })
}

export async function loadNicheSpec(): Promise<string> {
  const storage = getStorage()
  if (!storage) return ""
  return new Promise((resolve) => {
    storage.get(KEY_NICHE_SPEC, (result) => {
      resolve((result[KEY_NICHE_SPEC] as string) ?? "")
    })
  })
}

export async function saveNicheSpec(text: string): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => {
    storage.set({ [KEY_NICHE_SPEC]: text }, resolve)
  })
}

export function emptyOverrides(): VoiceOverrides {
  return {
    addSignatureWords: [],
    removeSignatureWords: [],
    addNicheKeywords: [],
    removeNicheKeywords: [],
    lengthMin: null,
    lengthMax: null,
    preferredHookTypes: [],
    firstPersonRatio: null,
    secondPersonRatio: null,
    questionRatio: null,
    exclamationRatio: null
  }
}

export async function loadVoiceOverrides(): Promise<VoiceOverrides> {
  const storage = getStorage()
  if (!storage) return emptyOverrides()
  return new Promise((resolve) => {
    storage.get(KEY_VOICE_OVERRIDES, (result) => {
      resolve((result[KEY_VOICE_OVERRIDES] as VoiceOverrides) ?? emptyOverrides())
    })
  })
}

export async function saveVoiceOverrides(
  overrides: VoiceOverrides
): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  return new Promise((resolve) => {
    storage.set({ [KEY_VOICE_OVERRIDES]: overrides }, resolve)
  })
}
