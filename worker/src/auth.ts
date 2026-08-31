import type { Env } from "./types"

export const CLIENT_KEY_HEADER = "X-PostPilot-Key"

/**
 * True if the request carries the shared secret the extension's background
 * worker sends on every rewrite/trial call. Fails *open* (returns true) when
 * the secret itself is unset on the worker, so a missing
 * `wrangler secret put REWRITE_CLIENT_SECRET` cannot take these routes down --
 * once it's set (matching the extension's PLASMO_PUBLIC_REWRITE_KEY), this
 * branch stops running and the header becomes required.
 */
export function isAuthorized(request: Request, env: Env): boolean {
  const expected = env.REWRITE_CLIENT_SECRET
  if (!expected) {
    console.warn("[postpilot-rewrite-worker] REWRITE_CLIENT_SECRET unset; allowing request")
    return true
  }
  return request.headers.get(CLIENT_KEY_HEADER) === expected
}
