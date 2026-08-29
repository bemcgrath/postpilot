import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useShareIntent } from "expo-share-intent";

import { installPlatform } from "@postpilot/core/storage/adapter";
import { createMobilePlatform } from "./src/platform/mmkv-platform";
import { ComposeScreen } from "./src/screens/ComposeScreen";
import { DraftsScreen } from "./src/screens/DraftsScreen";
import { HooksScreen } from "./src/screens/HooksScreen";
import { InsightsScreen } from "./src/screens/InsightsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";

// Installed once at module load, before any component can call a
// @postpilot/core storage function -- Hermes has no reliable "is MMKV
// available" signal the way `typeof chrome` gives the extension, so mobile
// always installs explicitly rather than auto-detecting (see the M3 plan's
// "installPlatform() at app startup, not auto-detected").
installPlatform(createMobilePlatform());

type Screen = "compose" | "drafts" | "hooks" | "insights" | "settings";

const TABS: Array<{ key: Screen; label: string }> = [
  { key: "compose", label: "Compose" },
  { key: "drafts", label: "Drafts" },
  { key: "hooks", label: "Hooks" },
  { key: "insights", label: "Insights" },
  { key: "settings", label: "Settings" }
];

export default function App() {
  const [screen, setScreen] = useState<Screen>("compose");
  const [text, setText] = useState("");

  // useShareIntent must be called before any Provider per expo-share-intent's
  // own docs; App.tsx has no Provider tree today, so this is already at the
  // top. iOS is disabled in app.json's plugin config for this pass (no Apple
  // Developer account yet to build/test that side) -- this hook still works
  // fine with only Android active, hasShareIntent just never fires on iOS.
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (hasShareIntent && shareIntent.text) {
      setText(shareIntent.text);
      setScreen("compose");
      resetShareIntent();
    }
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  function restoreDraft(draftText: string) {
    setText(draftText);
    setScreen("compose");
  }

  function useHook(hookText: string) {
    setText(hookText);
    setScreen("compose");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.title}>PostPilot</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBarScroll}>
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, screen === tab.key && styles.tabActive]}
              onPress={() => setScreen(tab.key)}>
              <Text style={[styles.tabText, screen === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {screen === "compose" && <ComposeScreen text={text} onChangeText={setText} />}
      {screen === "drafts" && <DraftsScreen onRestore={restoreDraft} />}
      {screen === "hooks" && <HooksScreen onUse={useHook} />}
      {screen === "insights" && <InsightsScreen />}
      {screen === "settings" && <SettingsScreen />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#16181c" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { color: "#e7e9ea", fontSize: 20, fontWeight: "700" },
  tabBarScroll: { flexGrow: 0, marginBottom: 4 },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8
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
