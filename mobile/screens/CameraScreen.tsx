import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCameraConfig } from "../context/CameraConfigContext";
import { StatusPill } from "../components/StatusPill";
import { DemoModePanel, Scenario } from "../components/DemoModePanel";
import { registerCamera, sendFrame, simulateIncident } from "../services/api";

let frameCounter = 0;

export default function CameraScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { config } = useCameraConfig();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [monitoring, setMonitoring] = useState(false);
  const [connected, setConnected] = useState(true);
  const [sendingFrame, setSendingFrame] = useState(false);
  const [lastDetection, setLastDetection] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [framesSent, setFramesSent] = useState(0);
  const [locationStatus, setLocationStatus] = useState<"pending" | "live" | "denied" | "unavailable">("pending");
  const [resolvedLocationName, setResolvedLocationName] = useState<string | null>(null);

  const positionRef = useRef({ latitude: config.latitude, longitude: config.longitude });
  const resolvedLocationRef = useRef<string | null>(null);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  const acquireLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationStatus("denied");
        return;
      }
      // "Highest" forces a real satellite GPS fix rather than a coarse
      // WiFi/cell-tower estimate — the latter is often only accurate to
      // city level, which produces overly generic reverse-geocoded names
      // like "Dhaka District" instead of the actual neighborhood/street.
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      positionRef.current = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLocationStatus("live");

      try {
        const [addr] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (addr) {
          const streetLabel = [addr.streetNumber, addr.street].filter(Boolean).join(" ") || null;
          // Android's geocoder falls back to a Google Plus Code (e.g. "RC6G+94P")
          // in the "name" field when it can't resolve a real place/street name
          // for a location — that's not human-readable, so skip it if seen.
          const isPlusCode = (v: string | null) => !!v && /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i.test(v);
          const name = isPlusCode(addr.name) ? null : addr.name;
          const area = streetLabel || name || addr.subregion || addr.district;
          const city = addr.city || addr.region;
          const label = [area, city].filter(Boolean).join(", ") || null;
          resolvedLocationRef.current = label;
          setResolvedLocationName(label);
        }
      } catch {
        // reverse geocoding is best-effort; fall back to the configured location name
      }
    } catch {
      setLocationStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    acquireLocation();
  }, [acquireLocation]);

  useEffect(() => {
    registerCamera(config).catch(() => setConnected(false));
  }, [config.cameraId]); // eslint-disable-line react-hooks/exhaustive-deps

  const captureAndSendFrame = useCallback(async () => {
    if (!cameraRef.current) return;
    setSendingFrame(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        base64: true,
        skipProcessing: true,
      });
      if (!photo?.base64) return;

      frameCounter += 1;
      const response = await sendFrame(config, {
        imageBase64: photo.base64,
        timestamp: new Date().toISOString(),
        latitude: positionRef.current.latitude,
        longitude: positionRef.current.longitude,
        location: resolvedLocationRef.current || config.location,
        frameId: `${config.cameraId}-${Date.now()}-${frameCounter}`,
      });

      setConnected(true);
      setFramesSent((n) => n + 1);
      if (response.detection && response.detection.incident_type !== "normal") {
        setLastDetection(
          `${response.detection.incident_type.replace("_", " ")} (${Math.round(response.detection.confidence * 100)}%)`
        );
      }
    } catch (err) {
      setConnected(false);
    } finally {
      setSendingFrame(false);
    }
  }, [config]);

  const startMonitoring = useCallback(async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    if (locationStatus !== "live") {
      await acquireLocation();
    }
    setMonitoring(true);
  }, [permission, requestPermission, locationStatus, acquireLocation]);

  const stopMonitoring = useCallback(() => {
    setMonitoring(false);
  }, []);

  // Re-creates the capture loop whenever monitoring toggles OR the config
  // changes (e.g. Detection Interval edited in Settings while monitoring is
  // already running) — previously the interval was only ever set up once
  // inside startMonitoring, so a mid-session interval/settings change was
  // silently ignored until the user manually stopped and restarted.
  useEffect(() => {
    if (!monitoring) return;
    const id = setInterval(captureAndSendFrame, config.detectionIntervalMs);
    return () => clearInterval(id);
  }, [monitoring, captureAndSendFrame, config.detectionIntervalMs]);

  async function handleSimulate(scenario: Scenario) {
    const response = await simulateIncident(config, scenario);
    setConnected(true);
    if (response.detection) {
      setLastDetection(
        `${response.detection.incident_type.replace("_", " ")} (${Math.round(response.detection.confidence * 100)}%) [DEMO]`
      );
    }
  }

  if (!permission) {
    return <View style={styles.center}><Text style={styles.permText}>Loading camera permissions...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>SafeCity Camera needs access to your camera to monitor this location.</Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.cameraWrap}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />

          <View style={styles.topOverlay}>
            <View>
              <Text style={styles.cameraId}>{config.cameraId}</Text>
              <Text style={styles.location}>{resolvedLocationName || config.location}</Text>
            </View>
            <TouchableOpacity onPress={onOpenSettings} style={styles.settingsBtn}>
              <Text style={styles.settingsBtnText}>⚙</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomOverlay}>
            <StatusPill label={connected ? "Connected" : "Connection Lost"} tone={connected ? "ok" : "warn"} />
            {monitoring && (
              <StatusPill label={sendingFrame ? "Sending frame..." : "Frame sent"} tone="info" pulse={sendingFrame} />
            )}
            {monitoring && <StatusPill label="AI Monitoring Active" tone="ok" pulse />}
          </View>

          <View style={styles.clockBadge}>
            <Text style={styles.clockText}>{now.toLocaleTimeString()}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <InfoRow label="Camera Status" value={connected ? "Online" : "Offline"} />
          <InfoRow label="AI Monitoring" value={monitoring ? "Active" : "Standby"} />
          <InfoRow label="Detection Interval" value={`${config.detectionIntervalMs} ms`} />
          <InfoRow label="Frames Sent" value={String(framesSent)} />
          <InfoRow
            label="GPS Location"
            value={
              locationStatus === "live"
                ? `Live (${positionRef.current.latitude.toFixed(4)}, ${positionRef.current.longitude.toFixed(4)})${
                    resolvedLocationName ? ` — ${resolvedLocationName}` : ""
                  }`
                : locationStatus === "denied"
                ? "Permission denied — using configured default"
                : locationStatus === "unavailable"
                ? "GPS unavailable — using configured default"
                : "Acquiring..."
            }
            highlight={locationStatus !== "live"}
          />
          {lastDetection && <InfoRow label="Last Detection" value={lastDetection} highlight />}
        </View>

        <View style={styles.controlsRow}>
          {!monitoring ? (
            <TouchableOpacity style={[styles.controlBtn, styles.startBtn]} onPress={startMonitoring}>
              <Text style={styles.controlBtnText}>▶ Start Monitoring</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.controlBtn, styles.stopBtn]} onPress={stopMonitoring}>
              <Text style={styles.controlBtnText}>■ Stop Monitoring</Text>
            </TouchableOpacity>
          )}
        </View>

        <DemoModePanel onTrigger={handleSimulate} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && styles.infoValueHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1128" },
  scroll: { padding: 14, gap: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a1128", padding: 24 },
  permText: { color: "white", textAlign: "center", marginBottom: 16, fontSize: 14 },
  permButton: { backgroundColor: "#2a4d8a", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  permButtonText: { color: "white", fontWeight: "700" },

  cameraWrap: { aspectRatio: 3 / 4, borderRadius: 16, overflow: "hidden", backgroundColor: "#000" },
  camera: { flex: 1 },
  topOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cameraId: { color: "white", fontWeight: "800", fontSize: 16 },
  location: { color: "#cbd5e1", fontSize: 12 },
  settingsBtn: {
    backgroundColor: "rgba(15,27,61,0.85)",
    height: 34,
    width: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsBtnText: { color: "white", fontSize: 16 },
  bottomOverlay: { position: "absolute", bottom: 12, left: 12, right: 12, gap: 6 },
  clockBadge: {
    position: "absolute",
    top: 12,
    left: "50%",
    marginLeft: -35,
    backgroundColor: "rgba(15,27,61,0.85)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  clockText: { color: "white", fontSize: 11, fontWeight: "600" },

  infoCard: { backgroundColor: "#111c3d", borderRadius: 14, padding: 14, gap: 8 },
  infoRow: { flexDirection: "row", justifyContent: "space-between" },
  infoLabel: { color: "#94a3b8", fontSize: 13 },
  infoValue: { color: "white", fontSize: 13, fontWeight: "600" },
  infoValueHighlight: { color: "#f59e0b" },

  controlsRow: { flexDirection: "row" },
  controlBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  startBtn: { backgroundColor: "#16a34a" },
  stopBtn: { backgroundColor: "#dc2626" },
  controlBtnText: { color: "white", fontWeight: "700", fontSize: 15 },
});
