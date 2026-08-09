// Shared install-redirect tracker for per-tactic distribution links.
// Each /install/<tactic>/index.html sets window.POSTPILOT_TACTIC before loading this.
//
// Uses Plausible (cookieless, no personal data collected) instead of GA4 —
// this page sits behind a "nothing leaves your browser, no account access"
// pitch, so a Google tracker here undercuts the claim and gets disproportionately
// blocked by the privacy-conscious visitors it's trying to measure.
;(function () {
  var CWS_URL = "https://chromewebstore.google.com/detail/postpilot-for-x/jhpaadadlahdlmkoejpfdlflkpofcjgf"
  var PLAUSIBLE_DOMAIN = "postpilotforx.com"
  var tactic = window.POSTPILOT_TACTIC || "unknown"
  var redirected = false

  function redirect() {
    if (redirected) return
    redirected = true
    location.replace(CWS_URL)
  }

  // Always redirect within 400ms even if the analytics call is slow, blocked,
  // or fails to load — tracking never holds up the install.
  var fallbackTimer = setTimeout(redirect, 400)

  window.plausible =
    window.plausible ||
    function () {
      ;(window.plausible.q = window.plausible.q || []).push(arguments)
    }

  var script = document.createElement("script")
  script.defer = true
  script.setAttribute("data-domain", PLAUSIBLE_DOMAIN)
  script.src = "https://plausible.io/js/script.js"
  script.onload = function () {
    window.plausible("install_click", {
      props: { tactic: tactic },
      callback: function () {
        clearTimeout(fallbackTimer)
        redirect()
      }
    })
  }
  script.onerror = redirect
  document.head.appendChild(script)
})()
