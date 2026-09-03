import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import * as Clipboard from "expo-clipboard";

import { scorePost } from "@postpilot/core/scoring/scoring-pipeline";
import { humanizeHookType } from "@postpilot/core/scoring/hook-types";
import { applyOverrides } from "@postpilot/core/scoring/voice-fingerprint";
import { loadFingerprint, loadVoiceOverrides } from "@postpilot/core/scoring/voice-storage";
import { hasLinkInText } from "@postpilot/core/scoring/compose-media";
import { loadLearnedInsights } from "@postpilot/core/learning/storage";
import { saveScoreEntry } from "@postpilot/core/history/score-history-storage";
import { saveHook } from "@postpilot/core/hooks/hook-storage";
import { suggestSelfReply } from "@postpilot/core/scoring/self-reply";
import { buildPrePublishChecklist } from "@postpilot/core/scoring/checklist";
import { evaluatePostingTime } from "@postpilot/core/scoring/timing";
import type { VoiceFingerprint, VoiceOverrides } from "@postpilot/core/scoring/voice-types";
import type { LearnedInsights } from "@postpilot/core/learning/types";
import type { PostScore } from "@postpilot/core/scoring/types";
import { saveDraft } from "@postpilot/core/drafts/draft-storage";

// ---------------------------------------------------------------------------
// M3 first slice. The scoring + "Open in X" handoff logic here is the exact
// mechanism the M0 spike validated on a real device (including the
// multi-line-text edge case) -- this port only changes where scorePost() and
// humanizeHookType() come from: the real @postpilot/core package instead of
// files copied by hand into a throwaway prototype.
//
// M3 completion pass: wires the Voice Match fingerprint (built in Settings)
// and learned insights (built via CSV import in Insights) into the actual
// score, mirroring PostPilotPanel.tsx's scorePost(text, fingerprint,
// hookTypeBoosts, overrides, context) call -- without this, Settings/
// Insights would be settings that visibly do nothing to the live score.
// No Free/Pro gate here (unlike the extension's isPro checks): mobile has
// no tier enforcement yet, so anything the user has built (fingerprint,
// insights) always applies.
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 70) return "#00ba7c";
  if (score >= 50) return "#f7b731";
  return "#f4212e";
}

// X's post limit for standard (non-Premium) accounts. There's no reliable
// way to detect Premium status from mobile (PRODUCT.md's roadmap notes this
// is deliberately unbuilt on desktop too), so this is a conservative default
// -- warn, never block, same "warns, never blocks" discipline the desktop
// pre-publish checklist already follows.
const X_CHAR_LIMIT = 280;

// Matches PostPilotPanel.tsx's auto-save/review-prompt threshold (score >= 70
// triggers a hook auto-save there). Mobile has no Pro gate to hang this
// behind, unlike desktop's `pro && score >= 70` -- see the file-level note.
const HOOK_AUTO_SAVE_THRESHOLD = 70;

interface ComposeScreenProps {
  text: string;
  onChangeText: (text: string) => void;
}

export function ComposeScreen({ text, onChangeText }: ComposeScreenProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<VoiceFingerprint | null>(null);
  const [overrides, setOverrides] = useState<VoiceOverrides | null>(null);
  const [insights, setInsights] = useState<LearnedInsights | null>(null);
  // Media doesn't transfer through the "Open in X" handoff -- these are a
  // declarative "will you attach one?" toggle, not a real attachment, so the
  // scorer sees the same image/video delta the desktop DOM-scraped version
  // would. hasLink is auto-derived from the text itself (a pasted URL),
  // matching how the extension already treats a link in text -- no toggle
  // needed for that one.
  const [hasImage, setHasImage] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [selfReply, setSelfReply] = useState<string | null>(null);
  // There's no mobile equivalent of desktop's capture-phase click listener on
  // X's own tweetButton, so publish can't be detected directly -- instead,
  // arm this when openInX() actually hands off to X, and ask once when the
  // app returns to the foreground. Ref, not state: read only from the
  // AppState listener, never rendered.
  const pendingPublishRef = useRef<{ text: string; score: PostScore } | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    Promise.all([loadFingerprint(), loadVoiceOverrides(), loadLearnedInsights()]).then(
      ([fp, ov, ins]) => {
        setFingerprint(fp);
        setOverrides(ov);
        setInsights(ins);
      }
    );
  }, []);

  const effectiveFingerprint = useMemo(() => {
    if (!fingerprint) return null;
    return overrides ? applyOverrides(fingerprint, overrides) : fingerprint;
  }, [fingerprint, overrides]);

  // Score and its timing are computed together in one useMemo, rather than
  // measuring elapsed time via a ref and stashing it in state from inside
  // the memo callback -- that was a setState-during-render (works today,
  // but warns under StrictMode and isn't safe under React 19/concurrent
  // rendering). tookMs is only meaningful when a score was actually run.
  const media = useMemo(
    () => ({ hasImage, hasVideo, hasLink: hasLinkInText(text) }),
    [hasImage, hasVideo, text]
  );

  const mediaBoosts = useMemo(() => {
    if (!insights?.isReady || !insights.mediaPerformance) return null;
    const { imageBoost, videoBoost, linkBoost } = insights.mediaPerformance;
    return { imageBoost, videoBoost, linkBoost };
  }, [insights]);

  const { score, tookMs } = useMemo(() => {
    if (text.length === 0) return { score: null, tookMs: null };
    const start = Date.now();
    const result = scorePost(
      text,
      effectiveFingerprint,
      insights?.isReady ? insights.hookTypeBoosts : undefined,
      overrides,
      {
        originalLengthRange: insights?.isReady ? insights.optimalLengthRange : null,
        media,
        mediaBoosts
      }
    );
    return { score: result, tookMs: Date.now() - start };
  }, [text, effectiveFingerprint, overrides, insights, media, mediaBoosts]);

  // Runs once the user confirms they actually posted. Mirrors
  // PostPilotPanel.tsx's commitClearSave: records score history, auto-saves
  // a 70+ hook, and offers a self-reply -- minus the review-prompt/weekly-
  // stats refresh, which have no mobile UI to update yet.
  async function confirmPublish(pending: { text: string; score: PostScore }) {
    const total = pending.score.hookScore.totalScore;
    try {
      await saveScoreEntry(total);
    } catch (e) {
      console.error("[PostPilot] saveScoreEntry failed", e);
    }
    if (total >= HOOK_AUTO_SAVE_THRESHOLD) {
      try {
        await saveHook(pending.text, pending.score.hookScore.hookType, total, "auto");
      } catch (e) {
        console.error("[PostPilot] saveHook failed", e);
      }
    }
    const suggestion = suggestSelfReply(
      pending.text,
      pending.score.hookScore.hookType,
      pending.score.kind
    );
    setSelfReply(suggestion);
    setStatus("Recorded! Check Hooks/Insights for the update.");
  }

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;
      const returnedToForeground =
        (prevState === "background" || prevState === "inactive") && nextState === "active";
      const pending = pendingPublishRef.current;
      if (!returnedToForeground || !pending) return;
      pendingPublishRef.current = null;
      Alert.alert("Did you post it?", "Recording it updates your score trends and hook library.", [
        { text: "No", style: "cancel" },
        { text: "Yes", onPress: () => confirmPublish(pending) }
      ]);
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- confirmPublish
    // only closes over stable setters + the `pending` argument, never over
    // this render's reactive state, so it's safe for a mount-only effect.
  }, []);

  async function openInX() {
    setStatus(null);
    const encoded = encodeURIComponent(text);

    // Ladder: native scheme -> universal link -> clipboard fallback. Same
    // sequence M0 validated; canOpenURL is skipped because Expo Go itself
    // restricts which custom schemes it reports as available, independent
    // of this app's own app.json -- a real dev-client build honors it, but
    // attempting openURL directly works in both cases. pendingPublishRef is
    // only armed in the two branches that actually hand off to X -- the
    // clipboard fallback means X never opened, so there's nothing to ask
    // about on return.
    try {
      await Linking.openURL(`twitter://post?message=${encoded}`);
      if (score) pendingPublishRef.current = { text, score };
      setStatus("Opened via twitter:// scheme");
      return;
    } catch {
      // fall through
    }

    try {
      await Linking.openURL(`https://x.com/intent/post?text=${encoded}`);
      if (score) pendingPublishRef.current = { text, score };
      setStatus("Opened via x.com/intent/post");
      return;
    } catch {
      // fall through
    }

    try {
      await Clipboard.setStringAsync(text);
      setStatus("Copied to clipboard -- paste into X");
      Alert.alert("Copied", "Couldn't open X directly. Text is on your clipboard -- paste it into X.");
    } catch (e) {
      setStatus(`Clipboard fallback also failed: ${String(e)}`);
    }
  }

  async function handleSaveDraft() {
    if (!score || text.length === 0) return;
    try {
      await saveDraft(text, score.hookScore.totalScore, score.hookScore.hookType);
      setStatus("Draft saved");
    } catch (e) {
      setStatus(`Couldn't save draft: ${String(e)}`);
    }
  }

  const total = score?.hookScore.totalScore ?? 0;
  const hookLabel = score?.hookScore.hookType ? humanizeHookType(score.hookScore.hookType) : "No hook detected";
  const issues = score?.governor.issues ?? [];
  const suggestions = score?.hookScore.suggestions ?? [];
  const isOverLimit = text.length > X_CHAR_LIMIT;

  // No Free/Pro gate here either (see the file-level note) -- evaluatePostingTime
  // is portable and mirrors what PostPilotPanel.tsx does with `hasPro` swapped
  // out, same as everything else insights-derived in this screen.
  const postingTime = insights?.isReady ? evaluatePostingTime(insights) : null;
  const checklist = score
    ? buildPrePublishChecklist({
        hookScore: score.hookScore.totalScore,
        governorErrors: issues.filter((i) => i.severity === "error").length,
        inSweetSpot: score.inSweetSpot,
        hasImage: media.hasImage || media.hasVideo,
        hasLink: media.hasLink,
        mediaDelta: score.mediaDelta,
        nowGood: postingTime ? postingTime.nowGood : null
      })
    : [];

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      {selfReply && (
        <View style={styles.selfReplyCard}>
          <Text style={styles.sectionTitle}>Self-reply suggestion</Text>
          <Text style={styles.issueText}>{selfReply}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setSelfReply(null)}>
              <Text style={styles.secondaryButtonText}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.openButton}
              onPress={() => {
                onChangeText(selfReply);
                setSelfReply(null);
              }}>
              <Text style={styles.openButtonText}>Use as new post</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TextInput
        style={styles.input}
        multiline
        placeholder="Write your X post here..."
        placeholderTextColor="#71767b"
        value={text}
        onChangeText={onChangeText}
        maxLength={2000}
      />

      <View style={styles.mediaRow}>
        <Text style={styles.mediaLabel}>Attaching in X:</Text>
        <TouchableOpacity
          style={[styles.mediaToggle, hasImage && styles.mediaToggleActive]}
          onPress={() => setHasImage((v) => !v)}>
          <Text style={[styles.mediaToggleText, hasImage && styles.mediaToggleTextActive]}>Image</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mediaToggle, hasVideo && styles.mediaToggleActive]}
          onPress={() => setHasVideo((v) => !v)}>
          <Text style={[styles.mediaToggleText, hasVideo && styles.mediaToggleTextActive]}>Video</Text>
        </TouchableOpacity>
        {media.hasLink && <Text style={styles.mediaAutoLink}>Link detected</Text>}
      </View>

      <View style={styles.scoreRow}>
        <View style={[styles.badge, { backgroundColor: scoreColor(total) }]}>
          <Text style={styles.badgeText}>{text.length > 0 ? total : "--"}</Text>
        </View>
        <View style={styles.scoreMeta}>
          <Text style={styles.hookLabel}>{hookLabel}</Text>
          <Text style={[styles.charCount, isOverLimit && styles.charCountOver]}>
            {text.length}/{X_CHAR_LIMIT} chars{tookMs != null ? ` -- scored in ${tookMs}ms` : ""}
            {isOverLimit ? " -- over the limit for standard accounts" : ""}
          </Text>
        </View>
      </View>

      {checklist.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Before you send</Text>
          {checklist.map((item) => (
            <Text
              key={item.id}
              style={[styles.issueText, item.ok ? styles.checklistOk : styles.checklistBad]}>
              {item.ok ? "✓ " : "✗ "}
              {item.label}
            </Text>
          ))}
        </View>
      )}

      {issues.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Governor ({issues.length})</Text>
          {issues.map((issue, i) => (
            <Text key={i} style={styles.issueText}>
              - {issue.message}
            </Text>
          ))}
        </View>
      )}

      {suggestions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suggestions</Text>
          {suggestions.map((s, i) => (
            <Text key={i} style={styles.issueText}>
              - {s}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, text.length === 0 && styles.buttonDisabled]}
          disabled={text.length === 0}
          onPress={handleSaveDraft}>
          <Text style={styles.secondaryButtonText}>Save Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.openButton, text.length === 0 && styles.buttonDisabled]}
          disabled={text.length === 0}
          onPress={openInX}>
          <Text style={styles.openButtonText}>Open in X</Text>
        </TouchableOpacity>
      </View>

      {status && <Text style={styles.status}>{status}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 12, gap: 14 },
  input: {
    minHeight: 120,
    backgroundColor: "#1e2024",
    borderColor: "#2f3336",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: "#e7e9ea",
    fontSize: 16
  },
  selfReplyCard: {
    backgroundColor: "#1e2024",
    borderColor: "#1d9bf0",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 8
  },
  mediaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  mediaLabel: { color: "#71767b", fontSize: 12 },
  mediaToggle: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#1e2024",
    borderColor: "#2f3336",
    borderWidth: 1
  },
  mediaToggleActive: { backgroundColor: "#1d9bf0", borderColor: "#1d9bf0" },
  mediaToggleText: { color: "#71767b", fontSize: 12, fontWeight: "600" },
  mediaToggleTextActive: { color: "#fff" },
  mediaAutoLink: { color: "#71767b", fontSize: 12, fontStyle: "italic" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#0f1419", fontWeight: "800", fontSize: 18 },
  scoreMeta: { flex: 1 },
  hookLabel: { color: "#e7e9ea", fontSize: 15, fontWeight: "600" },
  charCount: { color: "#71767b", fontSize: 12, marginTop: 2 },
  charCountOver: { color: "#f4212e" },
  section: { backgroundColor: "#1e2024", borderRadius: 10, padding: 12, gap: 4, marginTop: 14 },
  sectionTitle: { color: "#71767b", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  issueText: { color: "#e7e9ea", fontSize: 13, lineHeight: 18 },
  checklistOk: { color: "#00ba7c" },
  checklistBad: { color: "#f4212e" },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  secondaryButton: { flex: 1, backgroundColor: "#1e2024", borderColor: "#2f3336", borderWidth: 1, borderRadius: 10, padding: 14, alignItems: "center" },
  secondaryButtonText: { color: "#e7e9ea", fontWeight: "600", fontSize: 15 },
  openButton: { flex: 1, backgroundColor: "#1d9bf0", borderRadius: 10, padding: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.4 },
  openButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  status: { color: "#71767b", fontSize: 12, textAlign: "center", marginTop: 10 }
});
