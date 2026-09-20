import React, { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CameraConfigProvider } from "./context/CameraConfigContext";
import CameraScreen from "./screens/CameraScreen";
import SettingsScreen from "./screens/SettingsScreen";

export default function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <SafeAreaProvider>
      <CameraConfigProvider>
        {showSettings ? (
          <SettingsScreen onClose={() => setShowSettings(false)} />
        ) : (
          <CameraScreen onOpenSettings={() => setShowSettings(true)} />
        )}
      </CameraConfigProvider>
    </SafeAreaProvider>
  );
}
