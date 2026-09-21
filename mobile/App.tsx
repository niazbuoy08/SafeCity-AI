import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CameraConfigProvider } from "./context/CameraConfigContext";
import CameraScreen from "./screens/CameraScreen";
import DangerMapScreen from "./screens/DangerMapScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { TabBar, Tab } from "./components/TabBar";

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<Tab>("camera");

  return (
    <SafeAreaProvider>
      <CameraConfigProvider>
        {showSettings ? (
          <SettingsScreen onClose={() => setShowSettings(false)} />
        ) : (
          <View style={styles.root}>
            <View style={styles.screen}>
              {tab === "camera" ? (
                <CameraScreen onOpenSettings={() => setShowSettings(true)} />
              ) : (
                <DangerMapScreen onOpenSettings={() => setShowSettings(true)} />
              )}
            </View>
            <TabBar active={tab} onChange={setTab} />
          </View>
        )}
      </CameraConfigProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a1128" },
  screen: { flex: 1 },
});
