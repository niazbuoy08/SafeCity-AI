import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCameraConfig } from "../context/CameraConfigContext";
import { checkHealth } from "../services/api";

export default function SettingsScreen({ onClose }: { onClose: () => void }) {
  const { config, updateConfig } = useCameraConfig();
  const [form, setForm] = useState({
    cameraId: config.cameraId,
    name: config.name,
    location: config.location,
    latitude: String(config.latitude),
    longitude: String(config.longitude),
    detectionIntervalMs: String(config.detectionIntervalMs),
    backendUrl: config.backendUrl,
  });
  const [testing, setTesting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    const latitude = parseFloat(form.latitude);
    const longitude = parseFloat(form.longitude);
    const detectionIntervalMs = parseInt(form.detectionIntervalMs, 10);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      Alert.alert("Invalid coordinates", "Latitude and longitude must be numbers.");
      return;
    }
    if (Number.isNaN(detectionIntervalMs) || detectionIntervalMs < 200) {
      Alert.alert("Invalid interval", "Detection interval must be at least 200ms.");
      return;
    }

    updateConfig({
      cameraId: form.cameraId.trim(),
      name: form.name.trim(),
      location: form.location.trim(),
      latitude,
      longitude,
      detectionIntervalMs,
      backendUrl: form.backendUrl.trim().replace(/\/$/, ""),
    });
    onClose();
  }

  async function testConnection() {
    setTesting(true);
    const ok = await checkHealth(form.backendUrl.trim().replace(/\/$/, ""));
    setTesting(false);
    Alert.alert(ok ? "Connected" : "Connection failed", ok ? "Backend is reachable." : "Could not reach backend at that address.");
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Camera Settings</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>Done</Text>
          </TouchableOpacity>
        </View>

        <Field label="Camera ID" value={form.cameraId} onChangeText={(v) => set("cameraId", v)} />
        <Field label="Camera Name" value={form.name} onChangeText={(v) => set("name", v)} />
        <Field label="Location" value={form.location} onChangeText={(v) => set("location", v)} />
        <View style={styles.row}>
          <View style={styles.half}>
            <Field label="Latitude" value={form.latitude} onChangeText={(v) => set("latitude", v)} keyboardType="numeric" />
          </View>
          <View style={styles.half}>
            <Field label="Longitude" value={form.longitude} onChangeText={(v) => set("longitude", v)} keyboardType="numeric" />
          </View>
        </View>
        <Field
          label="Detection Interval (ms)"
          value={form.detectionIntervalMs}
          onChangeText={(v) => set("detectionIntervalMs", v)}
          keyboardType="numeric"
        />

        <Text style={styles.sectionLabel}>Backend Connection</Text>
        <Field label="Backend URL" value={form.backendUrl} onChangeText={(v) => set("backendUrl", v)} autoCapitalize="none" />
        <Text style={styles.hint}>
          Use your computer's LAN IP (e.g. http://192.168.1.20:4000) when testing on a physical device —
          "localhost" only works on emulators.
        </Text>

        <TouchableOpacity style={styles.testBtn} onPress={testConnection} disabled={testing}>
          <Text style={styles.testBtnText}>{testing ? "Testing..." : "Test Connection"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>Save Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "numeric";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType || "default"}
        autoCapitalize={props.autoCapitalize || "sentences"}
        placeholderTextColor="#64748b"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1128" },
  scroll: { padding: 18, gap: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { color: "white", fontSize: 20, fontWeight: "800" },
  closeBtn: { color: "#60a5fa", fontWeight: "700", fontSize: 15 },
  field: { marginBottom: 14 },
  label: { color: "#94a3b8", fontSize: 12, marginBottom: 5, fontWeight: "600" },
  input: {
    backgroundColor: "#111c3d",
    color: "white",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#1e3a6b",
  },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  sectionLabel: { color: "white", fontWeight: "700", fontSize: 14, marginTop: 8, marginBottom: 8 },
  hint: { color: "#64748b", fontSize: 11, marginBottom: 14, lineHeight: 16 },
  testBtn: {
    backgroundColor: "#1e3a6b",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  testBtnText: { color: "white", fontWeight: "600" },
  saveBtn: { backgroundColor: "#2a4d8a", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { color: "white", fontWeight: "800", fontSize: 15 },
});
