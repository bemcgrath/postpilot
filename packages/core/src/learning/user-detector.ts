/**
 * Split from the extension's src/dom/user-detector.ts (2026-08-28 monorepo
 * extraction): this half is the pure cache-vs-detection merge logic. DOM
 * detection (detectFromDOM) and the storage-touching bridge
 * (detectUserHandle) stay extension-side -- mobile has no x.com DOM to
 * detect a handle from.
 *
 * Pure merge logic (unit-testable without a DOM): a fresh detection always
 * wins over the cache, falling back to the cache only when detection itself
 * failed (e.g. the page is still loading) -- the one scenario the cache
 * actually exists for.
 */
export function resolveUserHandle(
  detected: string | null,
  cached: string | null
): { handle: string | null; shouldUpdateCache: boolean } {
  if (detected) {
    return { handle: detected, shouldUpdateCache: detected !== cached }
  }
  return { handle: cached, shouldUpdateCache: false }
}
