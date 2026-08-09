// Shared install-redirect tracker for per-tactic distribution links.
// Each /install/<tactic>/index.html sets window.POSTPILOT_TACTIC before loading this.
;(function () {
  var CWS_URL = "https://chromewebstore.google.com/detail/postpilot-for-x/jhpaadadlahdlmkoejpfdlflkpofcjgf"
  var GA_MEASUREMENT_ID = "G-REPLACE_ME" // TODO: swap in the real GA4 measurement ID before deploying
  var tactic = window.POSTPILOT_TACTIC || "unknown"
  var redirected = false

  function redirect() {
    if (redirected) return
    redirected = true
    location.replace(CWS_URL)
  }

  // Always redirect within 600ms even if the analytics call is slow, blocked
  // (adblock), or GA fails to load — never let tracking hold up the install.
  var fallbackTimer = setTimeout(redirect, 600)

  var script = document.createElement("script")
  script.async = true
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID
  script.onload = function () {
    window.dataLayer = window.dataLayer || []
    function gtag() {
      window.dataLayer.push(arguments)
    }
    gtag("js", new Date())
    gtag("config", GA_MEASUREMENT_ID, { send_page_view: false })
    gtag("event", "install_click", {
      tactic: tactic,
      event_callback: function () {
        clearTimeout(fallbackTimer)
        redirect()
      }
    })
  }
  script.onerror = redirect
  document.head.appendChild(script)
})()
