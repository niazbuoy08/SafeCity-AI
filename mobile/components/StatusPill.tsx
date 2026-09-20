import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Tone = "ok" | "warn" | "off" | "info";

const TONE_COLORS: Record<Tone, string> = {
  ok: "#16a34a",
  warn: "#f59e0b",
  off: "#64748b",
  info: "#2a4d8a",
};

export function StatusPill({ label, tone, pulse }: { label: string; tone: Tone; pulse?: boolean }) {
  return (
    <View style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: TONE_COLORS[tone] }, pulse && styles.pulse]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,27,61,0.85)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pulse: {
    shadowColor: "#fff",
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  label: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
  },
});
