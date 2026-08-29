import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
import { loadLearnedInsights } from "@postpilot/core/learning/storage";
import type { VoiceFingerprint, VoiceOverrides } from "@postpilot/core/scoring/voice-types";
import type { LearnedInsights } from "@postpilot/core/learning/types";
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

interface ComposeScreenProps {
  text: string;
  onChangeText: (text: string) => void;
}

export function ComposeScreen({ text, onChangeText }: ComposeScreenProps) {
  const [lastScoreMs, setLastScoreMs] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<VoiceFingerprint | null>(null);
  const [overrides, setOverrides] = useState<VoiceOverrides | null>(null);
  const [insights, setInsights] = useState<LearnedInsights | null>(null);
  const scoreStartRef = useRef<number>(0);

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

  const score = useMemo(() => {
    scoreStartRef.current = Date.now();
    const result =
      text.length > 0
        ? scorePost(
            text,
            effectiveFingerprint,
            insights?.isReady ? insights.hookTypeBoosts : undefined,
            overrides,
            {
              originalLengthRange: insights?.isReady ? insights.optimalLengthRange : null
            }
          )
        : null;
    setLastScoreMs(Date.now() - scoreStartRef.current);
    return result;
  }, [text, effectiveFingerprint, overrides, insights]);

  async function openInX() {
    setStatus(null);
    const encoded = encodeURIComponent(text);

    // Ladder: native scheme -> universal link -> clipboard fallback. Same
    // sequence M0 validated; canOpenURL is skipped because Expo Go itself
    // restricts which custom schemes it reports as available, independent
    // of this app's own app.json -- a real dev-client build honors it, but
    // attempting openURL directly works in both cases.
    try {
      await Linking.openURL(`twitter://post?message=${encoded}`);
      setStatus("Opened via twitter:// scheme");
      return;
    } catch {
      // fall through
    }

    try {
      await Linking.openURL(`https://x.com/intent/post?text=${encoded}`);
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

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <TextInput
        style={styles.input}
        multiline
        placeholder="Write your X post here..."
        placeholderTextColor="#71767b"
        value={text}
        onChangeText={onChangeText}
        maxLength={2000}
      />

      <View style={styles.scoreRow}>
        <View style={[styles.badge, { backgroundColor: scoreColor(total) }]}>
          <Text style={styles.badgeText}>{text.length > 0 ? total : "--"}</Text>
        </View>
        <View style={styles.scoreMeta}>
          <Text style={styles.hookLabel}>{hookLabel}</Text>
          <Text style={styles.charCount}>
            {text.length} chars{lastScoreMs != null ? ` -- scored in ${lastScoreMs}ms` : ""}
          </Text>
        </View>
      </View>

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
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#0f1419", fontWeight: "800", fontSize: 18 },
  scoreMeta: { flex: 1 },
  hookLabel: { color: "#e7e9ea", fontSize: 15, fontWeight: "600" },
  charCount: { color: "#71767b", fontSize: 12, marginTop: 2 },
  section: { backgroundColor: "#1e2024", borderRadius: 10, padding: 12, gap: 4, marginTop: 14 },
  sectionTitle: { color: "#71767b", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  issueText: { color: "#e7e9ea", fontSize: 13, lineHeight: 18 },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  secondaryButton: { flex: 1, backgroundColor: "#1e2024", borderColor: "#2f3336", borderWidth: 1, borderRadius: 10, padding: 14, alignItems: "center" },
  secondaryButtonText: { color: "#e7e9ea", fontWeight: "600", fontSize: 15 },
  openButton: { flex: 1, backgroundColor: "#1d9bf0", borderRadius: 10, padding: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.4 },
  openButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  status: { color: "#71767b", fontSize: 12, textAlign: "center", marginTop: 10 }
});
