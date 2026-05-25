export {}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GENERATE_REWRITES") {
    fetchRewrites(message.apiKey, message.prompt)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: Error) => sendResponse({ ok: false, error: err.message }))
    return true // keep channel open for async response
  }
})

async function fetchRewrites(apiKey: string, prompt: string): Promise<unknown> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!response.ok) {
    if (response.status === 401) throw new Error("INVALID_API_KEY")
    throw new Error(`API_ERROR:${response.status}`)
  }

  return response.json()
}
