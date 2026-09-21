import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type Tab = "camera" | "map";

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: "camera", icon: "📷", label: "Camera" },
  { key: "map", icon: "🗺", label: "Danger Map" },
];

export function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((t) => {
        const selected = t.key === active;
        return (
          <TouchableOpacity key={t.key} style={styles.tab} onPress={() => onChange(t.key)} activeOpacity={0.7}>
            <Text style={styles.icon}>{t.icon}</Text>
            <Text style={[styles.label, selected && styles.labelActive]}>{t.label}</Text>
            {selected && <View style={styles.indicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#0f1b3d",
    borderTopWidth: 1,
    borderTopColor: "#1e3a6b",
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  icon: { fontSize: 18 },
  label: { color: "#94a3b8", fontSize: 11, fontWeight: "600" },
  labelActive: { color: "white" },
  indicator: { marginTop: 2, height: 3, width: 24, borderRadius: 2, backgroundColor: "#60a5fa" },
});
