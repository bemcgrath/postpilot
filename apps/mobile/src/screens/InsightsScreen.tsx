import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";

import { parseAnalyticsCsv } from "@postpilot/core/learning/csv-import";
import { upsertCollectedPosts, loadLearnedInsights } from "@postpilot/core/learning/storage";
import { runLearningEngine } from "@postpilot/core/learning/engine";
import { MIN_POSTS_FOR_LEARNING } from "@postpilot/core/learning/types";
import type { LearnedInsights } from "@postpilot/core/learning/types";

/**
 * There's no DOM to passively scrape posts from on mobile the way
 * analytics-collector.ts does on the extension -- CSV import is the only
 * ingestion path here (see the mobile plan's "Pro cold-start problem"
 * section). The empty state below says so plainly rather than implying
 * insights will "just show up" the way they eventually do on desktop.
 */
export function InsightsScreen() {
  const [insights, setInsights] = useState<LearnedInsights | null>(null);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(() => {
    loadLearnedInsights().then(setInsights);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleImportCsv() {
    setStatus(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "application/csv"],
      copyToCacheDirectory: true
    });
    if (result.canceled || !result.assets?.[0]) return;

    setImporting(true);
    try {
      const text = await fetch(result.assets[0].uri).then((r) => r.text());
      const parsed = parseAnalyticsCsv(text);
      if (!parsed.ok) {
        setStatus(parsed.error);
        return;
      }
      await upsertCollectedPosts(parsed.posts);
      const computed = await runLearningEngine();
      setInsights(computed);
      const skipNote = parsed.skipped > 0 ? ` (${parsed.skipped} rows skipped)` : "";
      setStatus(
        computed.isReady
          ? `Imported ${parsed.posts.length} posts${skipNote}. Insights ready.`
          : `Imported ${parsed.posts.length} posts${skipNote}. Need ${MIN_POSTS_FOR_LEARNING - computed.postsAnalyzed} more for insights.`
      );
    } catch {
      setStatus("Couldn't read that file -- make sure it's the CSV export from X Analytics.");
    } finally {
      setImporting(false);
    }
  }

  if (!insights || !insights.isReady) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No insights yet</Text>
          <Text style={styles.emptyBody}>
            Insights come from your own post history -- what actually worked for your audience. PostPilot
            Mobile has no way to collect that passively (there's no browser tab to watch the way the desktop
            extension does), so the only way to get insights here is to import your X Analytics CSV export.
          </Text>
          {insights && (
            <Text style={styles.progress}>
              {insights.postsAnalyzed}/{MIN_POSTS_FOR_LEARNING} posts imported so far.
            </Text>
          )}
          <TouchableOpacity
            style={[styles.primaryButton, importing && styles.buttonDisabled]}
            disabled={importing}
            onPress={handleImportCsv}>
            <Text style={styles.primaryButtonText}>{importing ? "Importing..." : "Import Analytics CSV"}</Text>
          </TouchableOpacity>
          {status && <Text style={styles.status}>{status}</Text>}
          <Text style={styles.hint}>
            On a computer: analytics.x.com → Export data. Share or AirDrop the file to your phone, then pick
            it here. This is a one-time snapshot, not a live feed -- import again later for fresh numbers.
          </Text>
        </View>
      </ScrollView>
    );
  }

  const topRecs = insights.recommendations.slice(0, 5);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.sectionTitle}>Your Data</Text>
      <Text style={styles.sectionSubtitle}>
        {insights.postsAnalyzed} posts analyzed · baseline {(insights.baselineEngagementRate * 100).toFixed(1)}%
        engagement
      </Text>

      {topRecs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Recommendations</Text>
          {topRecs.map((rec, i) => (
            <Text key={i} style={styles.rec}>
              • {rec.text}
            </Text>
          ))}
        </View>
      )}

      {insights.optimalLengthRange && (
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Length sweet spot</Text>
          <Text style={styles.value}>
            {insights.optimalLengthRange.min}-{insights.optimalLengthRange.max} chars
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.secondaryButton, importing && styles.buttonDisabled]}
        disabled={importing}
        onPress={handleImportCsv}>
        <Text style={styles.secondaryButtonText}>{importing ? "Importing..." : "Re-import CSV (refresh)"}</Text>
      </TouchableOpacity>
      {status && <Text style={styles.status}>{status}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12 },
  empty: { gap: 12, paddingTop: 20 },
  emptyTitle: { color: "#e7e9ea", fontSize: 18, fontWeight: "700" },
  emptyBody: { color: "#71767b", fontSize: 14, lineHeight: 20 },
  progress: { color: "#71767b", fontSize: 12, fontWeight: "600" },
  primaryButton: { backgroundColor: "#1d9bf0", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryButton: {
    backgroundColor: "#1e2024",
    borderColor: "#2f3336",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 4
  },
  secondaryButtonText: { color: "#e7e9ea", fontWeight: "600", fontSize: 14 },
  buttonDisabled: { opacity: 0.4 },
  status: { color: "#71767b", fontSize: 12, textAlign: "center" },
  hint: { color: "#71767b", fontSize: 12, lineHeight: 17, marginTop: 4 },
  sectionTitle: { color: "#e7e9ea", fontSize: 18, fontWeight: "700" },
  sectionSubtitle: { color: "#71767b", fontSize: 13 },
  section: { backgroundColor: "#1e2024", borderRadius: 10, padding: 14, gap: 8 },
  sectionHeading: { color: "#71767b", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  rec: { color: "#e7e9ea", fontSize: 13, lineHeight: 19 },
  value: { color: "#e7e9ea", fontSize: 15, fontWeight: "700" }
});
