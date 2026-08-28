import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { deleteDraft, loadDrafts, type DraftEntry } from "@postpilot/core/drafts/draft-storage";

function scoreColor(score: number): string {
  if (score >= 70) return "#00ba7c";
  if (score >= 50) return "#f7b731";
  return "#f4212e";
}

interface DraftsScreenProps {
  onRestore: (text: string) => void;
}

export function DraftsScreen({ onRestore }: DraftsScreenProps) {
  const [drafts, setDrafts] = useState<DraftEntry[] | null>(null);

  const refresh = useCallback(() => {
    loadDrafts().then(setDrafts);
  }, []);

  // Mounts fresh each time the Drafts tab is switched to (see App.tsx), so a
  // plain load-on-mount is enough for this slice -- no shared store needed
  // yet for a two-screen app.
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleDelete(id: string) {
    await deleteDraft(id);
    refresh();
  }

  if (drafts === null) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Loading...</Text>
      </View>
    );
  }

  if (drafts.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No saved drafts yet.</Text>
        <Text style={styles.emptySubtext}>Score a post on the Compose tab, then tap Save Draft.</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={drafts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardMain} onPress={() => onRestore(item.text)}>
            <View style={styles.cardHeader}>
              <View style={[styles.scoreDot, { backgroundColor: scoreColor(item.score) }]}>
                <Text style={styles.scoreDotText}>{item.score}</Text>
              </View>
              <Text style={styles.hookType}>{item.hookType ?? "No hook"}</Text>
            </View>
            <Text style={styles.draftText} numberOfLines={3}>
              {item.text}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 10 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 6 },
  emptyText: { color: "#e7e9ea", fontSize: 15, fontWeight: "600" },
  emptySubtext: { color: "#71767b", fontSize: 13, textAlign: "center" },
  card: {
    backgroundColor: "#1e2024",
    borderColor: "#2f3336",
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
    overflow: "hidden"
  },
  cardMain: { padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  scoreDot: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  scoreDotText: { color: "#0f1419", fontWeight: "800", fontSize: 12 },
  hookType: { color: "#71767b", fontSize: 12 },
  draftText: { color: "#e7e9ea", fontSize: 14, lineHeight: 19 },
  deleteButton: {
    borderTopWidth: 1,
    borderTopColor: "#2f3336",
    padding: 10,
    alignItems: "center"
  },
  deleteButtonText: { color: "#f4212e", fontSize: 13, fontWeight: "600" }
});
