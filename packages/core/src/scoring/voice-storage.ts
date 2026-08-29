import type { SamplePost, VoiceFingerprint, VoiceOverrides } from "./voice-types"
import { getStore } from "../storage/adapter"

const KEY_SAMPLE_POSTS = "postpilot_sample_posts"
const KEY_FINGERPRINT = "postpilot_voice_fingerprint"
const KEY_VOICE_PROFILE = "postpilot_voice_profile"
const KEY_NICHE_SPEC = "postpilot_niche_spec"
const KEY_VOICE_OVERRIDES = "postpilot_voice_overrides"

export async function loadSamplePosts(): Promise<SamplePost[]> {
  const storage = getStore()
  if (!storage) return []
  const result = await storage.get(KEY_SAMPLE_POSTS)
  return (result[KEY_SAMPLE_POSTS] as SamplePost[]) ?? []
}

export async function saveSamplePosts(posts: SamplePost[]): Promise<void> {
  const storage = getStore()
  if (!storage) return
  await storage.set({ [KEY_SAMPLE_POSTS]: posts })
}

export async function loadFingerprint(): Promise<VoiceFingerprint | null> {
  const storage = getStore()
  if (!storage) return null
  const result = await storage.get(KEY_FINGERPRINT)
  return (result[KEY_FINGERPRINT] as VoiceFingerprint) ?? null
}

export async function saveFingerprint(
  fp: VoiceFingerprint | null
): Promise<void> {
  const storage = getStore()
  if (!storage) return
  await storage.set({ [KEY_FINGERPRINT]: fp })
}

export async function loadVoiceProfile(): Promise<string> {
  const storage = getStore()
  if (!storage) return ""
  const result = await storage.get(KEY_VOICE_PROFILE)
  return (result[KEY_VOICE_PROFILE] as string) ?? ""
}

export async function saveVoiceProfile(text: string): Promise<void> {
  const storage = getStore()
  if (!storage) return
  await storage.set({ [KEY_VOICE_PROFILE]: text })
}

export async function loadNicheSpec(): Promise<string> {
  const storage = getStore()
  if (!storage) return ""
  const result = await storage.get(KEY_NICHE_SPEC)
  return (result[KEY_NICHE_SPEC] as string) ?? ""
}

export async function saveNicheSpec(text: string): Promise<void> {
  const storage = getStore()
  if (!storage) return
  await storage.set({ [KEY_NICHE_SPEC]: text })
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
  const storage = getStore()
  if (!storage) return emptyOverrides()
  const result = await storage.get(KEY_VOICE_OVERRIDES)
  return (result[KEY_VOICE_OVERRIDES] as VoiceOverrides) ?? emptyOverrides()
}

export async function saveVoiceOverrides(
  overrides: VoiceOverrides
): Promise<void> {
  const storage = getStore()
  if (!storage) return
  await storage.set({ [KEY_VOICE_OVERRIDES]: overrides })
}
