export {}

// Interim endpoint on Cloudflare's free workers.dev subdomain -- move to
// api.postpilotforx.com once DNS for that domain is on Cloudflare (see
// worker/wrangler.toml). Update this, the manifest host_permissions in
// package.json, and privacy-policy.html together when that happens.
const REWRITE_ENDPOINT = "https://postpilot-rewrite-worker.brianemcgrath.workers.dev/v1/rewrite"
const TRIAL_ENDPOINT = "https://postpilot-rewrite-worker.brianemcgrath.workers.dev/v1/trial"

// Same value as the worker's REWRITE_CLIENT_SECRET (wrangler secret).
// Plasmo inlines PLASMO_PUBLIC_* at build time. Copy .env.example to .env.
const REWRITE_CLIENT_KEY = process.env.PLASMO_PUBLIC_REWRITE_KEY ?? ""

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GENERATE_REWRITES") {
    fetchRewrites(message.body)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: Error & { resetsAt?: string }) =>
        sendResponse({ ok: false, error: err.message, resetsAt: err.resetsAt })
      )
    return true // keep channel open for async response
  }

  if (message.type === "GET_TRIAL_STATUS") {
    fetchTrialStatus(message.body?.deviceId)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: Error) => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (message.type === "START_TRIAL") {
    startTrialRequest(message.body?.deviceId)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: Error) => sendResponse({ ok: false, error: err.message }))
    return true
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
      "X-PostPilot-Key": REWRITE_CLIENT_KEY,
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
    let code = `API_ERROR:${response.status}`
    try {
      const parsed = JSON.parse(bodyText) as { error?: string }
      if (parsed.error) code = `${code}:${parsed.error}`
    } catch {
      /* body wasn't JSON */
    }
    throw new Error(code)
  }

  return response.json()
}

async function fetchTrialStatus(deviceId: unknown): Promise<unknown> {
  if (typeof deviceId !== "string" || !deviceId) throw new Error("INVALID_DEVICE_ID")
  const url = `${TRIAL_ENDPOINT}?deviceId=${encodeURIComponent(deviceId)}`
  const response = await fetch(url, {
    headers: { "X-PostPilot-Key": REWRITE_CLIENT_KEY },
  })
  if (!response.ok) throw new Error(`API_ERROR:${response.status}`)
  return response.json()
}

async function startTrialRequest(deviceId: unknown): Promise<unknown> {
  if (typeof deviceId !== "string" || !deviceId) throw new Error("INVALID_DEVICE_ID")
  const response = await fetch(TRIAL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PostPilot-Key": REWRITE_CLIENT_KEY,
    },
    body: JSON.stringify({ deviceId }),
  })
  if (!response.ok) throw new Error(`API_ERROR:${response.status}`)
  return response.json()
}

