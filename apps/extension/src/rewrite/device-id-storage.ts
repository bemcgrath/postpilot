/**
 * Anonymous per-install identifier used to key Free-tier AI Rewrite quota on
 * the backend (worker/). Not an account -- just enough for the server to
 * tell "same install asking again" from "a different install", so the Free
 * daily cap can't be reset by uninstall/reinstall alone. No PII, never sent
 * anywhere except PostPilot's own rewrite worker.
 */
import { getStore, uuid } from "@postpilot/core/storage/adapter"

const DEVICE_ID_KEY = "postpilot_device_id"

export async function getOrCreateDeviceId(): Promise<string> {
  const storage = getStore()
  if (!storage) return uuid() // no persistence available -- caller still gets a usable id for this call

  const result = await storage.get(DEVICE_ID_KEY)
  const existing = result[DEVICE_ID_KEY] as string | undefined
  if (existing) return existing

  const id = uuid()
  await storage.set({ [DEVICE_ID_KEY]: id })
  return id
}
