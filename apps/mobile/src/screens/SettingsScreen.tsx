import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { extractFingerprint } from "@postpilot/core/scoring/voice-fingerprint";
import { humanizeHookType } from "@postpilot/core/scoring/hook-types";
import type { SamplePost, VoiceFingerprint } from "@postpilot/core/scoring/voice-types";
import {
  loadSamplePosts,
  saveSamplePosts,
  loadFingerprint,
  saveFingerprint
} from "@postpilot/core/scoring/voice-storage";
import { uuid } from "@postpilot/core/storage/adapter";

// Mirrors options.tsx's Sample Posts tab threshold (MIN_POSTS = 5) -- not
// exported from voice-fingerprint.ts, so kept local here same as there.
const MIN_POSTS = 5;

export function SettingsScreen() {
  const [posts, setPosts] = useState<SamplePost[]>([]);
  const [fingerprint, setFingerprint] = useState<VoiceFingerprint | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadSamplePosts(), loadFingerprint()]).then(([samplePosts, fp]) => {
      setPosts(samplePosts);
      setFingerprint(fp);
    });
  }, []);

  async function handleAddPost() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const entry: SamplePost = { id: uuid(), text: trimmed, addedAt: Date.now() };
    const updated = [entry, ...posts];
    setPosts(updated);
    setDraft("");
    await saveSamplePosts(updated);
  }

  async function handleRemovePost(id: string) {
    const updated = posts.filter((p) => p.id !== id);
    setPosts(updated);
    await saveSamplePosts(updated);
  }

  async function handleAnalyze() {
    setStatus(null);
    try {
      const fp = extractFingerprint(posts.map((p) => p.text));
      await saveFingerprint(fp);
      setFingerprint(fp);
      setStatus("Voice Match updated");
    } catch (e) {
      setStatus(`Couldn't build a voice profile: ${String(e)}`);
    }
  }

  const canAnalyze = posts.length >= MIN_POSTS;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.sectionTitle}>Voice Match</Text>
      <Text style={styles.sectionSubtitle}>
        Paste {MIN_POSTS}+ of your own posts. PostPilot learns your vocabulary, sentence length, and hook
        preferences from them, then scores new posts against your own voice -- not a generic rubric.
      </Text>

      <TextInput
        style={styles.input}
        multiline
        placeholder="Paste one of your own posts..."
        placeholderTextColor="#71767b"
        value={draft}
        onChangeText={setDraft}
      />
      <TouchableOpacity
        style={[styles.secondaryButton, draft.trim().length === 0 && styles.buttonDisabled]}
        disabled={draft.trim().length === 0}
        onPress={handleAddPost}>
        <Text style={styles.secondaryButtonText}>Add Post</Text>
      </TouchableOpacity>

      {posts.length > 0 && (
        <View style={styles.postList}>
          <Text style={styles.postListHeader}>
            {posts.length} post{posts.length === 1 ? "" : "s"} added
          </Text>
          {posts.map((p) => (
            <View key={p.id} style={styles.postRow}>
              <Text style={styles.postRowText} numberOfLines={2}>
                {p.text}
              </Text>
              <TouchableOpacity onPress={() => handleRemovePost(p.id)}>
                <Text style={styles.postRowRemove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, !canAnalyze && styles.buttonDisabled]}
        disabled={!canAnalyze}
        onPress={handleAnalyze}>
        <Text style={styles.primaryButtonText}>
          {canAnalyze ? "Analyze" : `Analyze (${posts.length}/${MIN_POSTS} posts min)`}
        </Text>
      </TouchableOpacity>

      {status && <Text style={styles.status}>{status}</Text>}

      {fingerprint && (
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Your Voice</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Sentence length</Text>
            <Text style={styles.value}>{Math.round(fingerprint.sentenceLength.mean)} words avg</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Post length</Text>
            <Text style={styles.value}>{Math.round(fingerprint.postLength.mean)} chars avg</Text>
          </View>
          {fingerprint.topHookTypes.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Top hooks</Text>
              <Text style={styles.value}>
                {fingerprint.topHookTypes.map((h) => humanizeHookType(h)).join(", ")}
              </Text>
            </View>
          )}
          {fingerprint.distinctiveTerms.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Signature words</Text>
              <Text style={styles.value}>
                {fingerprint.distinctiveTerms.slice(0, 6).map((t) => t.term).join(", ")}
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12 },
  sectionTitle: { color: "#e7e9ea", fontSize: 18, fontWeight: "700", marginTop: 4 },
  sectionSubtitle: { color: "#71767b", fontSize: 13, lineHeight: 18, marginBottom: 4 },
  input: {
    minHeight: 80,
    backgroundColor: "#1e2024",
    borderColor: "#2f3336",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: "#e7e9ea",
    fontSize: 15
  },
  secondaryButton: {
    backgroundColor: "#1e2024",
    borderColor: "#2f3336",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: "center"
  },
  secondaryButtonText: { color: "#e7e9ea", fontWeight: "600", fontSize: 14 },
  buttonDisabled: { opacity: 0.4 },
  postList: { gap: 6, marginTop: 4 },
  postListHeader: { color: "#71767b", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  postRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1e2024",
    borderRadius: 8,
    padding: 10
  },
  postRowText: { flex: 1, color: "#e7e9ea", fontSize: 13, lineHeight: 17 },
  postRowRemove: { color: "#f4212e", fontSize: 12, fontWeight: "600" },
  primaryButton: { backgroundColor: "#1d9bf0", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  status: { color: "#71767b", fontSize: 12, textAlign: "center" },
  section: { backgroundColor: "#1e2024", borderRadius: 10, padding: 14, gap: 10, marginTop: 8 },
  sectionHeading: { color: "#71767b", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { gap: 2 },
  label: { color: "#71767b", fontSize: 12 },
  value: { color: "#e7e9ea", fontSize: 14, fontWeight: "600" }
});
