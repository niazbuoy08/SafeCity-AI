import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraConfig, DEFAULT_CAMERA_CONFIG } from "../services/config";

const STORAGE_KEY = "safecity_camera_config";

interface CameraConfigContextValue {
  config: CameraConfig;
  updateConfig: (patch: Partial<CameraConfig>) => void;
  loaded: boolean;
}

const CameraConfigContext = createContext<CameraConfigContextValue | undefined>(undefined);

export function CameraConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<CameraConfig>(DEFAULT_CAMERA_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setConfig({ ...DEFAULT_CAMERA_CONFIG, ...JSON.parse(raw) });
      })
      .finally(() => setLoaded(true));
  }, []);

  const updateConfig = useCallback((patch: Partial<CameraConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <CameraConfigContext.Provider value={{ config, updateConfig, loaded }}>{children}</CameraConfigContext.Provider>
  );
}

export function useCameraConfig() {
  const ctx = useContext(CameraConfigContext);
  if (!ctx) throw new Error("useCameraConfig must be used within CameraConfigProvider");
  return ctx;
}
