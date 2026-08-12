export {}

// Interim endpoint on Cloudflare's free workers.dev subdomain -- move to
// api.postpilotforx.com once DNS for that domain is on Cloudflare (see
// worker/wrangler.toml). Update this, the manifest host_permissions in
// package.json, and privacy-policy.html together when that happens.
const REWRITE_ENDPOINT = "https://postpilot-rewrite-worker.brianemcgrath.workers.dev/v1/rewrite"

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GENERATE_REWRITES") {
    fetchRewrites(message.body)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: Error & { resetsAt?: string }) =>
        sendResponse({ ok: false, error: err.message, resetsAt: err.resetsAt })
      )
    return true // keep channel open for async response
  }

  if (message.type === "OPEN_OPTIONS_TAB") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("options.html") + "#" + message.tab
    })
  }
})

async function fetchRewrites(body: unknown): Promise<unknown> {
  const response = await fetch(REWRITE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    if (response.status === 429) {
      const data = await response.json().catch(() => ({}) as { resetsAt?: string })
      const err = new Error("QUOTA_EXCEEDED") as Error & { resetsAt?: string }
      err.resetsAt = data.resetsAt
      throw err
    }
    const bodyText = await response.text()
    console.error("[PostPilot] Rewrite backend error", response.status, bodyText)
    throw new Error(`API_ERROR:${response.status}`)
  }

  return response.json()
}
