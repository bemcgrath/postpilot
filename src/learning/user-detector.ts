import { loadUserHandle, saveUserHandle } from "./storage"

/**
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

/**
 * Detect the current user's X handle.
 *
 * Real bug found live: the cache was never re-validated against the DOM, so
 * when a user renamed their X handle, every post's isOwnPost() check
 * silently failed forever against the stale cached name -- freezing post
 * collection entirely, for months, with no visible error anywhere.
 */
export async function detectUserHandle(): Promise<string | null> {
  const cached = await loadUserHandle()
  const detected = detectFromDOM()
  const { handle, shouldUpdateCache } = resolveUserHandle(detected, cached)
  if (shouldUpdateCache && detected) {
    await saveUserHandle(detected)
  }
  return handle
}

/** Extract handle from DOM without async storage access. */
export function detectFromDOM(): string | null {
  // Strategy 1: sidebar profile link (most reliable)
  const profileLink = document.querySelector<HTMLAnchorElement>(
    'a[data-testid="AppTabBar_Profile_Link"]'
  )
  if (profileLink) {
    const href = profileLink.getAttribute("href")
    if (href) {
      const match = href.match(/^\/([A-Za-z0-9_]+)$/)
      if (match) return match[1]
    }
  }

  // Strategy 2: current URL on profile page
  const url = window.location.pathname
  // Profile pages: /handle or /handle/with_replies etc.
  // But NOT /home, /explore, /notifications, /messages, /settings, /i/*
  const reserved = new Set([
    "home", "explore", "notifications", "messages",
    "settings", "i", "search", "compose", "hashtag"
  ])
  const pathMatch = url.match(/^\/([A-Za-z0-9_]+)/)
  if (pathMatch && !reserved.has(pathMatch[1].toLowerCase())) {
    // Only use URL if it looks like a profile (has the profile indicator)
    const profileIndicator = document.querySelector(
      '[data-testid="UserName"]'
    )
    if (profileIndicator) {
      return pathMatch[1]
    }
  }

  return null
}
