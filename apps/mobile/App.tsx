import { useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { installPlatform } from "@postpilot/core/storage/adapter";
import { createMobilePlatform } from "./src/platform/mmkv-platform";
import { ComposeScreen } from "./src/screens/ComposeScreen";
import { DraftsScreen } from "./src/screens/DraftsScreen";

// Installed once at module load, before any component can call a
// @postpilot/core storage function -- Hermes has no reliable "is MMKV
// available" signal the way `typeof chrome` gives the extension, so mobile
// always installs explicitly rather than auto-detecting (see the M3 plan's
// "installPlatform() at app startup, not auto-detected").
installPlatform(createMobilePlatform());

type Screen = "compose" | "drafts";

export default function App() {
  const [screen, setScreen] = useState<Screen>("compose");
  const [text, setText] = useState("");

  function restoreDraft(draftText: string) {
    setText(draftText);
    setScreen("compose");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.title}>PostPilot</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, screen === "compose" && styles.tabActive]}
          onPress={() => setScreen("compose")}>
          <Text style={[styles.tabText, screen === "compose" && styles.tabTextActive]}>Compose</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, screen === "drafts" && styles.tabActive]}
          onPress={() => setScreen("drafts")}>
          <Text style={[styles.tabText, screen === "drafts" && styles.tabTextActive]}>Drafts</Text>
        </TouchableOpacity>
      </View>

      {screen === "compose" ? (
        <ComposeScreen text={text} onChangeText={setText} />
      ) : (
        <DraftsScreen onRestore={restoreDraft} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#16181c" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { color: "#e7e9ea", fontSize: 20, fontWeight: "700" },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 4
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#1e2024"
  },
  tabActive: { backgroundColor: "#1d9bf0" },
  tabText: { color: "#71767b", fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#fff" }
});
