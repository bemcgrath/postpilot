import React, { useCallback, useEffect, useState } from "react"

import type { SamplePost, VoiceFingerprint, VoiceOverrides } from "~scoring/voice-types"
import type { PostPilotConfig } from "~config/types"

import { extractFingerprint } from "~scoring/voice-fingerprint"
import {
  fingerprintFromProfile,
  mergeProfileIntoFingerprint,
  parseVoiceProfile
} from "~scoring/voice-profile-parser"
import {
  emptyOverrides,
  loadFingerprint,
  loadNicheSpec,
  loadSamplePosts,
  loadVoiceOverrides,
  loadVoiceProfile,
  saveFingerprint,
  saveNicheSpec,
  saveSamplePosts,
  saveVoiceOverrides,
  saveVoiceProfile
} from "~scoring/voice-storage"
import { diagnoseFingerprint } from "~scoring/voice-diagnostics"
import { humanizeHookType } from "~scoring/hook-types"
import { buildDefaults } from "~config/defaults"
import { initConfig, saveConfig } from "~config/config-storage"
import { activateLicense, deactivateLicense, loadLicenseStatus } from "~config/license"
import type { LicenseStatus } from "~config/license"
import { getClaudeApiKey, setClaudeApiKey, clearClaudeApiKey } from "~rewrite/api-key-storage"

import { GovernorSettings } from "~components/settings/GovernorSettings"
import { HookScoringSettings } from "~components/settings/HookScoringSettings"
import { HookTypesSettings } from "~components/settings/HookTypesSettings"
import { ConfigActions } from "~components/settings/ConfigActions"
import { AnalyticsTab } from "~components/settings/AnalyticsTab"
import { VoiceCoachPanel } from "~components/settings/VoiceCoachPanel"

const MIN_POSTS = 5
const SEPARATOR = "---"

/** Open a file picker for .md/.txt files and call onLoad with the text content. */
function importFile(onLoad: (text: string) => void) {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".md,.txt,.markdown"
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onLoad(reader.result)
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

type TabId = "license" | "profile" | "posts" | "governor" | "hooks" | "analytics" | "aiRewrites"

function Options() {
  const [posts, setPosts] = useState<SamplePost[]>([])
  const [fingerprint, setFingerprint] = useState<VoiceFingerprint | null>(null)
  const [overrides, setOverrides] = useState<VoiceOverrides>(emptyOverrides())
  const [inputText, setInputText] = useState("")
  const [profileText, setProfileText] = useState("")
  const [nicheText, setNicheText] = useState("")
  const [status, setStatus] = useState("")
  const [activeTab, setActiveTab] = useState<TabId>("license")
  const [config, setConfig] = useState<PostPilotConfig>(buildDefaults())
  const [license, setLicense] = useState<LicenseStatus>({ isActive: false, licenseKey: null, instanceId: null, error: null })
  const [licenseInput, setLicenseInput] = useState("")
  const [licenseLoading, setLicenseLoading] = useState(false)
  const [claudeApiKey, setClaudeApiKeyState] = useState<string | null>(null)
  const [claudeApiKeyInput, setClaudeApiKeyInput] = useState("")
  const [apiKeySavedMsg, setApiKeySavedMsg] = useState("")

  useEffect(() => {
    loadSamplePosts().then(setPosts)
    loadFingerprint().then(setFingerprint)
    loadVoiceOverrides().then(setOverrides)
    loadVoiceProfile().then(setProfileText)
    loadNicheSpec().then(setNicheText)
    initConfig().then(setConfig)
    loadLicenseStatus().then(setLicense)
    getClaudeApiKey().then(setClaudeApiKeyState)
    const hash = window.location.hash.slice(1) as TabId
    if (hash) {
      setActiveTab(hash)
    } else {
      chrome.storage.local.get("postpilot_options_tab", (result) => {
        const tab = result.postpilot_options_tab as TabId | undefined
        if (tab) {
          setActiveTab(tab)
          chrome.storage.local.remove("postpilot_options_tab")
        }
      })
    }
  }, [])

  // Auto-save config when it changes (debounced via state)
  const updateConfig = useCallback(
    (newConfig: PostPilotConfig) => {
      setConfig(newConfig)
      saveConfig(newConfig)
    },
    []
  )

  const updateOverrides = useCallback(
    (newOverrides: VoiceOverrides) => {
      setOverrides(newOverrides)
      saveVoiceOverrides(newOverrides)
    },
    []
  )

  const addPosts = useCallback(() => {
    const trimmed = inputText.trim()
    if (!trimmed) return

    const newTexts = trimmed
      .split(SEPARATOR)
      .map((t) => t.trim())
      .filter((t) => t.length > 10)

    if (newTexts.length === 0) {
      setStatus("No valid posts found (each must be >10 chars)")
      return
    }

    const newPosts: SamplePost[] = newTexts.map((text) => ({
      id: crypto.randomUUID(),
      text,
      addedAt: Date.now()
    }))

    const updated = [...posts, ...newPosts]
    setPosts(updated)
    saveSamplePosts(updated)
    setInputText("")
    setStatus(`Added ${newPosts.length} post${newPosts.length > 1 ? "s" : ""}`)
  }, [inputText, posts])

  const removePost = useCallback(
    (id: string) => {
      const updated = posts.filter((p) => p.id !== id)
      setPosts(updated)
      saveSamplePosts(updated)
    },
    [posts]
  )

  const saveProfile = useCallback(() => {
    saveVoiceProfile(profileText)
    saveNicheSpec(nicheText)
    setStatus("Voice profile saved")
  }, [profileText, nicheText])

  const analyze = useCallback(() => {
    const hasProfile = profileText.trim().length > 100
    const hasPosts = posts.length >= MIN_POSTS

    if (!hasProfile && !hasPosts) {
      setStatus(
        `Need a voice profile or at least ${MIN_POSTS} sample posts`
      )
      return
    }

    let fp: VoiceFingerprint

    if (hasProfile && hasPosts) {
      const postFp = extractFingerprint(posts.map((p) => p.text))
      const profile = parseVoiceProfile(profileText, nicheText || undefined)
      fp = mergeProfileIntoFingerprint(postFp, profile)
    } else if (hasProfile) {
      const profile = parseVoiceProfile(profileText, nicheText || undefined)
      fp = fingerprintFromProfile(profile)
    } else {
      fp = extractFingerprint(posts.map((p) => p.text))
    }

    setFingerprint(fp)
    saveFingerprint(fp)

    const source = hasProfile && hasPosts
      ? "profile + posts"
      : hasProfile
        ? "voice profile"
        : "sample posts"
    setStatus(`Voice fingerprint generated from ${source}`)
  }, [posts, profileText, nicheText])

  const clearFingerprint = useCallback(() => {
    setFingerprint(null)
    saveFingerprint(null)
    setStatus("Fingerprint cleared")
  }, [])

  const canAnalyze = profileText.trim().length > 100 || posts.length >= MIN_POSTS
  const accuracy =
    posts.length >= 15 ? "Good" : posts.length >= 10 ? "Moderate" : "Limited"
  const accuracyColor =
    posts.length >= 15 ? "#00ba7c" : posts.length >= 10 ? "#f7b731" : "#71767b"

  const isVoiceTab = activeTab === "profile" || activeTab === "posts"
  const isConfigTab = activeTab === "governor" || activeTab === "hooks"

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>PostPilot Settings</h1>
      <p style={styles.subtitle}>
        Configure voice matching, governor rules, hook scoring, and hook types.
      </p>

      {/* Tabs */}
      <div style={styles.tabBar}>
        {([
          { id: "license" as TabId, label: license.isActive ? "Pro ✓" : "License", indicator: "" },
          { id: "profile" as TabId, label: "Voice", indicator: profileText.trim().length > 100 ? " *" : "" },
          { id: "posts" as TabId, label: "Posts", indicator: posts.length > 0 ? ` (${posts.length})` : "" },
          { id: "governor" as TabId, label: "Governor", indicator: "" },
          { id: "hooks" as TabId, label: "Hooks", indicator: "" },
          { id: "analytics" as TabId, label: "Analytics", indicator: "" },
          { id: "aiRewrites" as TabId, label: "AI Rewrites", indicator: claudeApiKey ? " ✓" : "" }
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {})
            }}>
            {tab.label}
            {tab.indicator && (
              <span style={styles.tabCheck}>{tab.indicator}</span>
            )}
          </button>
        ))}
      </div>

      {/* License tab */}
      {activeTab === "license" && (
        <div style={{ padding: "24px 0" }}>
          {license.isActive ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <span style={{ fontSize: "20px" }}>✓</span>
                <span style={{ fontWeight: 600, fontSize: "15px" }}>PostPilot Pro is active</span>
              </div>
              <p style={{ color: "#555", fontSize: "13px", marginBottom: "20px" }}>
                Voice fingerprinting and the learning engine are unlocked.
              </p>
              <button
                onClick={async () => {
                  await deactivateLicense()
                  setLicense({ isActive: false, licenseKey: null, instanceId: null, error: null })
                  setLicenseInput("")
                }}
                style={{ fontSize: "12px", color: "#999", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Deactivate license
              </button>
            </div>
          ) : (
            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: "15px" }}>Activate PostPilot Pro</h3>
              <p style={{ color: "#555", fontSize: "13px", margin: "0 0 20px" }}>
                Enter your license key from your purchase email to unlock voice fingerprinting and the learning engine.
              </p>
              <p style={{ color: "#555", fontSize: "13px", margin: "0 0 20px" }}>
                Don't have a license?{" "}
                <a href="https://postpilotpro.lemonsqueezy.com/checkout/buy/921ab388-2b1b-44e0-afd7-54da993317d0?discount=0" target="_blank" rel="noreferrer" style={{ color: "#1d9bf0" }}>
                  Get PostPilot Pro for $5/mo
                </a>
              </p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <input
                  type="text"
                  value={licenseInput}
                  onChange={(e) => setLicenseInput(e.target.value)}
                  placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                  style={{ flex: 1, padding: "8px 10px", fontSize: "13px", border: "1px solid #ccc", borderRadius: "6px", fontFamily: "monospace" }}
                />
                <button
                  disabled={licenseLoading || !licenseInput.trim()}
                  onClick={async () => {
                    setLicenseLoading(true)
                    const result = await activateLicense(licenseInput)
                    setLicense(result)
                    if (result.isActive) setLicenseInput("")
                    setLicenseLoading(false)
                  }}
                  style={{ padding: "8px 16px", fontSize: "13px", background: "#1d9bf0", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", opacity: licenseLoading ? 0.6 : 1 }}>
                  {licenseLoading ? "Activating…" : "Activate"}
                </button>
              </div>
              {license.error && (
                <p style={{ color: "#e0245e", fontSize: "13px", margin: 0 }}>{license.error}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Voice Profile tab */}
      {activeTab === "profile" && (
        <>
          <div style={styles.section}>
            <h2 style={styles.heading}>Voice Profile</h2>
            <p style={styles.hint}>
              Paste your voice_profile.md content or import a file. This defines
              your niche, hook preferences, tone, and writing style.
            </p>
            <div style={styles.importRow}>
              <button
                onClick={() => importFile((text) => setProfileText(text))}
                style={styles.button}>
                Import .md file
              </button>
              {profileText.trim().length > 0 && (
                <span style={styles.fileLoaded}>
                  {Math.round(profileText.length / 1024)}KB loaded
                </span>
              )}
            </div>
            <textarea
              value={profileText}
              onChange={(e) => setProfileText(e.target.value)}
              placeholder="# Voice Profile\n\nPaste your voice profile markdown here..."
              style={{ ...styles.textarea, fontFamily: "monospace", fontSize: 12 }}
              rows={10}
            />
          </div>

          <div style={styles.section}>
            <h2 style={styles.heading}>
              Niche Spec
              <span style={styles.optionalBadge}>optional</span>
            </h2>
            <p style={styles.hint}>
              Paste your niche_spec.md or import a file for additional keyword extraction.
            </p>
            <div style={styles.importRow}>
              <button
                onClick={() => importFile((text) => setNicheText(text))}
                style={styles.button}>
                Import .md file
              </button>
              {nicheText.trim().length > 0 && (
                <span style={styles.fileLoaded}>
                  {Math.round(nicheText.length / 1024)}KB loaded
                </span>
              )}
            </div>
            <textarea
              value={nicheText}
              onChange={(e) => setNicheText(e.target.value)}
              placeholder="# Niche Specification\n\nPaste your niche spec markdown here..."
              style={{ ...styles.textarea, fontFamily: "monospace", fontSize: 12 }}
              rows={6}
            />
          </div>

          <div style={styles.section}>
            <button onClick={saveProfile} style={styles.button}>
              Save Profile
            </button>
          </div>
        </>
      )}

      {/* Sample Posts tab */}
      {activeTab === "posts" && (
        <>
          <div style={styles.section}>
            <h2 style={styles.heading}>Add Posts</h2>
            <p style={styles.hint}>
              Paste one post, or multiple posts separated by <code>---</code>.
              Posts refine statistical patterns (sentence length, fragment ratio, etc.)
              that the voice profile alone can't capture.
            </p>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={"Paste your best posts here...\n---\nSeparate multiple posts with three dashes"}
              style={styles.textarea}
              rows={6}
            />
            <button onClick={addPosts} style={styles.button}>
              Add Post{inputText.includes(SEPARATOR) ? "s" : ""}
            </button>
          </div>

          <div style={styles.section}>
            <h2 style={styles.heading}>
              Sample Posts ({posts.length})
              {posts.length > 0 && (
                <span style={{ ...styles.accuracyBadge, color: accuracyColor }}>
                  {accuracy} accuracy
                </span>
              )}
            </h2>
            {posts.length === 0 && (
              <p style={styles.hint}>No posts added yet</p>
            )}
            {posts.map((post) => (
              <div key={post.id} style={styles.postCard}>
                <div style={styles.postText}>
                  {post.text.length > 120
                    ? post.text.slice(0, 120) + "..."
                    : post.text}
                </div>
                <button
                  onClick={() => removePost(post.id)}
                  style={styles.removeBtn}
                  title="Remove post">
                  x
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Analyze button (voice tabs only) */}
      {isVoiceTab && (
        <>
          <div style={styles.section}>
            <button
              onClick={analyze}
              disabled={!canAnalyze}
              style={{
                ...styles.button,
                ...styles.primaryButton,
                opacity: canAnalyze ? 1 : 0.5
              }}>
              {profileText.trim().length > 100 && posts.length >= MIN_POSTS
                ? "Analyze (Profile + Posts)"
                : profileText.trim().length > 100
                  ? "Analyze (Profile)"
                  : `Analyze (${posts.length}/${MIN_POSTS} posts min)`}
            </button>
            {fingerprint && (
              <button
                onClick={clearFingerprint}
                style={{ ...styles.button, marginLeft: 8 }}>
                Clear Fingerprint
              </button>
            )}
          </div>

          {status && <p style={styles.status}>{status}</p>}

          {/* Fingerprint display */}
          {fingerprint && (
            <div style={styles.section}>
              <h2 style={styles.heading}>Your Voice Fingerprint</h2>

              <div style={styles.fpGrid}>
                <FpCard title="Hook Preferences">
                  {fingerprint.topHookTypes.length > 0 ? (
                    <ol style={styles.fpList}>
                      {fingerprint.topHookTypes.map((ht, i) => (
                        <li key={ht}>
                          #{i + 1} {humanizeHookType(ht)}
                          {fingerprint.hookTypeDistribution[ht] != null && (
                            <span style={styles.fpMuted}>
                              {" "}
                              ({Math.round(fingerprint.hookTypeDistribution[ht]! * 100)}%)
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <span style={styles.fpMuted}>No patterns detected</span>
                  )}
                </FpCard>

                <FpCard title="Length Sweet Spot">
                  <span style={styles.fpValue}>
                    {Math.round(fingerprint.postLength.mean)} chars
                  </span>
                  <span style={styles.fpMuted}>
                    {" "}(range {fingerprint.postLength.min}-{fingerprint.postLength.max})
                  </span>
                </FpCard>

                <FpCard title="Signature Words">
                  <div style={styles.tagContainer}>
                    {fingerprint.distinctiveTerms.slice(0, 10).map((t) => (
                      <span key={t.term} style={styles.tag}>
                        {t.term}
                      </span>
                    ))}
                  </div>
                </FpCard>

                <FpCard title="Niche Keywords">
                  <div style={styles.tagContainer}>
                    {fingerprint.nicheKeywords.slice(0, 10).map((t) => (
                      <span key={t.term} style={styles.tag}>
                        {t.term}
                      </span>
                    ))}
                  </div>
                </FpCard>

                <FpCard title="Tone">
                  <div style={styles.fpRow}>
                    <span>First person (I/my):</span>
                    <span style={styles.fpValue}>
                      {Math.round(fingerprint.firstPersonRatio * 100)}%
                    </span>
                  </div>
                  <div style={styles.fpRow}>
                    <span>Addresses reader (you/your):</span>
                    <span style={styles.fpValue}>
                      {Math.round(fingerprint.secondPersonRatio * 100)}%
                    </span>
                  </div>
                  <div style={styles.fpRow}>
                    <span>Questions:</span>
                    <span style={styles.fpValue}>
                      {Math.round(fingerprint.questionRatio * 100)}%
                    </span>
                  </div>
                  <div style={styles.fpRow}>
                    <span>Formality:</span>
                    <span style={styles.fpValue}>
                      {fingerprint.formalityScore < 0.3
                        ? "Casual"
                        : fingerprint.formalityScore < 0.6
                          ? "Conversational"
                          : "Formal"}
                    </span>
                  </div>
                </FpCard>

                <FpCard title="Structure">
                  <div style={styles.fpRow}>
                    <span>Avg paragraphs:</span>
                    <span style={styles.fpValue}>{fingerprint.avgParagraphs}</span>
                  </div>
                  <div style={styles.fpRow}>
                    <span>Uses colons:</span>
                    <span style={styles.fpValue}>
                      {Math.round(fingerprint.usesColons * 100)}%
                    </span>
                  </div>
                  <div style={styles.fpRow}>
                    <span>Short fragments:</span>
                    <span style={styles.fpValue}>
                      {Math.round(fingerprint.fragmentRatio * 100)}%
                    </span>
                  </div>
                  <div style={styles.fpRow}>
                    <span>Avg sentence length:</span>
                    <span style={styles.fpValue}>
                      {fingerprint.sentenceLength.mean} words
                    </span>
                  </div>
                </FpCard>
              </div>

              <p style={styles.fpTimestamp}>
                {fingerprint.sampleCount > 0
                  ? `Generated from ${fingerprint.sampleCount} posts`
                  : "Generated from voice profile"}
                {" \u2022 "}
                {new Date(fingerprint.generatedAt).toLocaleDateString()}
              </p>

              <VoiceCoachPanel
                fingerprint={fingerprint}
                overrides={overrides}
                diagnostics={diagnoseFingerprint(fingerprint, posts.length)}
                onChange={updateOverrides}
              />
            </div>
          )}
        </>
      )}

      {/* Governor tab */}
      {activeTab === "governor" && (
        <div style={styles.section}>
          <GovernorSettings
            config={config.governor}
            onChange={(governor) =>
              updateConfig({ ...config, governor })
            }
          />
        </div>
      )}

      {/* Hooks tab (scoring + types combined) */}
      {activeTab === "hooks" && (
        <>
          <div style={styles.section}>
            <HookScoringSettings
              analyzerConfig={config.hookAnalyzer}
              pipelineConfig={config.pipeline}
              onAnalyzerChange={(hookAnalyzer) =>
                updateConfig({ ...config, hookAnalyzer })
              }
              onPipelineChange={(pipeline) =>
                updateConfig({ ...config, pipeline })
              }
            />
          </div>
          <div style={{ borderTop: "1px solid #2f3336", marginBottom: 24 }} />
          <div style={styles.section}>
            <HookTypesSettings
              config={config.hookTypes}
              onChange={(hookTypes) =>
                updateConfig({ ...config, hookTypes })
              }
            />
          </div>
        </>
      )}

      {/* Analytics tab */}
      {activeTab === "analytics" && (
        <div style={styles.section}>
          <AnalyticsTab />
        </div>
      )}

      {/* AI Rewrites tab */}
      {activeTab === "aiRewrites" && (
        <div style={{ padding: "24px 0" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: "15px" }}>AI Rewrite Suggestions</h3>
          <p style={{ color: "#71767b", fontSize: "13px", margin: "0 0 12px", lineHeight: 1.5 }}>
            When your post scores below 65, PostPilot can suggest stronger rewrites using Claude.
            Your API key is stored locally — it never leaves your browser.
          </p>
          <p style={{ color: "#71767b", fontSize: "13px", margin: "0 0 20px", lineHeight: 1.5 }}>
            Free users get 1 suggestion. Pro users get 3 variants with different hook types.
            Get a key at{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: "#1d9bf0" }}>
              console.anthropic.com
            </a>.
          </p>

          {claudeApiKey ? (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{ fontSize: "14px", color: "#00ba7c" }}>✓</span>
                <span style={{ fontSize: "13px", color: "#e7e9ea" }}>
                  API key saved: sk-ant-…{claudeApiKey.slice(-6)}
                </span>
              </div>
              <button
                onClick={async () => {
                  await clearClaudeApiKey()
                  setClaudeApiKeyState(null)
                  setClaudeApiKeyInput("")
                  setApiKeySavedMsg("")
                }}
                style={{ fontSize: "12px", color: "#71767b", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Remove key
              </button>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="password"
              value={claudeApiKeyInput}
              onChange={(e) => setClaudeApiKeyInput(e.target.value)}
              placeholder="sk-ant-api03-..."
              style={{ flex: 1, padding: "8px 10px", fontSize: "13px", background: "#1e2024", border: "1px solid #2f3336", borderRadius: "6px", color: "#e7e9ea", fontFamily: "monospace" }}
            />
            <button
              disabled={!claudeApiKeyInput.trim()}
              onClick={async () => {
                const key = claudeApiKeyInput.trim()
                await setClaudeApiKey(key)
                setClaudeApiKeyState(key)
                setClaudeApiKeyInput("")
                setApiKeySavedMsg("API key saved")
                setTimeout(() => setApiKeySavedMsg(""), 2000)
              }}
              style={{ padding: "8px 16px", fontSize: "13px", background: "#1d9bf0", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", opacity: claudeApiKeyInput.trim() ? 1 : 0.5 }}>
              Save
            </button>
          </div>
          {apiKeySavedMsg && (
            <p style={{ color: "#00ba7c", fontSize: "13px", margin: 0 }}>{apiKeySavedMsg}</p>
          )}
        </div>
      )}

      {/* Config Actions footer (config tabs only) */}
      {isConfigTab && (
        <ConfigActions
          config={config}
          onImport={(imported) => updateConfig(imported)}
          onReset={() => updateConfig(buildDefaults())}
          onGovernorImport={(governor) => updateConfig({ ...config, governor })}
        />
      )}
    </div>
  )
}

function FpCard({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={styles.fpCard}>
      <div style={styles.fpCardTitle}>{title}</div>
      {children}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "24px 20px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: "#16181c",
    color: "#e7e9ea",
    minHeight: "100vh"
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    margin: "0 0 4px"
  },
  subtitle: {
    fontSize: 14,
    color: "#71767b",
    margin: "0 0 24px",
    lineHeight: 1.5
  },
  tabBar: {
    display: "flex",
    gap: 0,
    marginBottom: 20,
    borderBottom: "1px solid #2f3336",
    overflowX: "auto" as const
  },
  tab: {
    padding: "10px 16px",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#71767b",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0
  },
  tabActive: {
    color: "#e7e9ea",
    borderBottomColor: "#1d9bf0"
  },
  tabCheck: {
    color: "#00ba7c"
  },
  section: {
    marginBottom: 24
  },
  heading: {
    fontSize: 15,
    fontWeight: 600,
    margin: "0 0 8px",
    display: "flex",
    alignItems: "center",
    gap: 8
  },
  hint: {
    fontSize: 13,
    color: "#71767b",
    margin: "0 0 8px"
  },
  textarea: {
    width: "100%",
    padding: 12,
    background: "#1e2024",
    border: "1px solid #2f3336",
    borderRadius: 8,
    color: "#e7e9ea",
    fontSize: 14,
    fontFamily: "inherit",
    resize: "vertical" as const,
    boxSizing: "border-box" as const
  },
  button: {
    marginTop: 8,
    padding: "8px 16px",
    background: "#2f3336",
    border: "none",
    borderRadius: 8,
    color: "#e7e9ea",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer"
  },
  primaryButton: {
    background: "#1d9bf0",
    color: "#fff"
  },
  optionalBadge: {
    fontSize: 11,
    color: "#71767b",
    fontWeight: 400
  },
  importRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 8
  },
  fileLoaded: {
    fontSize: 12,
    color: "#00ba7c"
  },
  postCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "8px 10px",
    background: "#1e2024",
    border: "1px solid #2f3336",
    borderRadius: 8,
    marginBottom: 6,
    fontSize: 13,
    lineHeight: 1.4
  },
  postText: {
    flex: 1,
    color: "#e7e9ea",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#71767b",
    cursor: "pointer",
    fontSize: 14,
    padding: "0 4px",
    flexShrink: 0
  },
  status: {
    fontSize: 13,
    color: "#1d9bf0",
    margin: "8px 0"
  },
  accuracyBadge: {
    fontSize: 11,
    fontWeight: 400
  },
  fpGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10
  },
  fpCard: {
    background: "#1e2024",
    border: "1px solid #2f3336",
    borderRadius: 8,
    padding: 12,
    fontSize: 13
  },
  fpCardTitle: {
    fontSize: 11,
    color: "#71767b",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 6
  },
  fpList: {
    margin: 0,
    paddingLeft: 18,
    lineHeight: 1.6
  },
  fpValue: {
    color: "#1d9bf0",
    fontWeight: 600
  },
  fpMuted: {
    color: "#71767b"
  },
  fpRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "2px 0"
  },
  tagContainer: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4
  },
  tag: {
    background: "#2f3336",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 12,
    color: "#e7e9ea"
  },
  fpTimestamp: {
    fontSize: 11,
    color: "#71767b",
    marginTop: 12,
    textAlign: "center" as const
  }
}

export default Options
