import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { deleteHook, loadHooks, type HookEntry } from "@postpilot/core/hooks/hook-storage";
import { humanizeHookType } from "@postpilot/core/scoring/hook-types";

function scoreColor(score: number): string {
  if (score >= 70) return "#00ba7c";
  if (score >= 50) return "#f7b731";
  return "#f4212e";
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

interface HooksScreenProps {
  onUse: (text: string) => void;
}

export function HooksScreen({ onUse }: HooksScreenProps) {
  const [hooks, setHooks] = useState<HookEntry[] | null>(null);

  const refresh = useCallback(() => {
    loadHooks().then(setHooks);
  }, []);

  // Same pattern as DraftsScreen -- mounts fresh each time the Hooks tab is
  // switched to, so load-on-mount is enough without a shared store.
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleDelete(id: string) {
    await deleteHook(id);
    refresh();
  }

  if (hooks === null) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Loading...</Text>
      </View>
    );
  }

  if (hooks.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No saved hooks yet.</Text>
        <Text style={styles.emptySubtext}>
          High-scoring posts (70+) save here automatically after you post them, or save one manually from Compose.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={hooks}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardMain} onPress={() => onUse(item.fullText)}>
            <View style={styles.cardHeader}>
              <View style={[styles.scoreDot, { backgroundColor: scoreColor(item.score) }]}>
                <Text style={styles.scoreDotText}>{item.score}</Text>
              </View>
              <Text style={styles.hookType}>
                {item.hookType ? humanizeHookType(item.hookType) : "No hook"}
              </Text>
              <View style={styles.spacer} />
              <Text style={styles.meta}>
                {item.source === "auto" ? "Auto-saved" : "Saved"} · {relativeTime(item.savedAt)}
              </Text>
            </View>
            <Text style={styles.hookText} numberOfLines={2}>
              {item.hook}
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
  spacer: { flex: 1 },
  meta: { color: "#71767b", fontSize: 11 },
  hookText: { color: "#e7e9ea", fontSize: 15, fontWeight: "600", lineHeight: 20 },
  deleteButton: {
    borderTopWidth: 1,
    borderTopColor: "#2f3336",
    padding: 10,
    alignItems: "center"
  },
  deleteButtonText: { color: "#f4212e", fontSize: 13, fontWeight: "600" }
});
