import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";

export type Scenario = "fight" | "accident" | "fire" | "fall";

const SCENARIOS: { key: Scenario; label: string; icon: string }[] = [
  { key: "fight", label: "Simulate Fight", icon: "⚔" },
  { key: "accident", label: "Simulate Accident", icon: "🚗" },
  { key: "fire", label: "Simulate Fire", icon: "🔥" },
  { key: "fall", label: "Simulate Person Fall", icon: "⚠" },
];

export function DemoModePanel({ onTrigger }: { onTrigger: (scenario: Scenario) => Promise<void> }) {
  const [loading, setLoading] = useState<Scenario | null>(null);

  async function handlePress(scenario: Scenario) {
    setLoading(scenario);
    try {
      await onTrigger(scenario);
    } catch (err: any) {
      Alert.alert("Simulation failed", err.message || "Could not reach backend");
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.badge}>DEMO MODE</Text>
        <Text style={styles.title}>Demo Scenario</Text>
      </View>
      <Text style={styles.subtitle}>
        Sends a realistic simulated event through the real backend + AI pipeline — guarantees the workflow works
        during a live demo.
      </Text>
      <View style={styles.grid}>
        {SCENARIOS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={styles.button}
            onPress={() => handlePress(s.key)}
            disabled={loading !== null}
          >
            {loading === s.key ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.buttonIcon}>{s.icon}</Text>
                <Text style={styles.buttonLabel}>{s.label}</Text>
              </>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#3b1d1d",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#7c2d2d",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: "#dc2626",
    color: "white",
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    letterSpacing: 0.5,
  },
  title: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
  subtitle: {
    color: "#fca5a5",
    fontSize: 11,
    marginBottom: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  button: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: "#7c2d2d",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonIcon: {
    fontSize: 18,
  },
  buttonLabel: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
});
