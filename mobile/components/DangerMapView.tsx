import React, { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { DANGER_MAP_HTML } from "../services/dangerMapHtml";
import { DangerZone, HeatPoint } from "../services/api";
import { LatLng } from "../services/routeSafety";

export interface MapFocus {
  latitude: number;
  longitude: number;
  nonce: number; // changes on every tap so re-selecting the same zone re-centres
}

export interface MapRoute {
  destination: LatLng;
  direct: LatLng[];
  detour: LatLng[] | null;
  via: LatLng[];
}

interface Props {
  zones: DangerZone[];
  heatPoints: HeatPoint[];
  user: LatLng | null;
  focus: MapFocus | null;
  pickMode: boolean;
  route: MapRoute | null;
  onPick: (point: LatLng) => void;
}

/** Leaflet heatmap in a WebView; data is pushed in via injectJavaScript. */
export function DangerMapView({ zones, heatPoints, user, focus, pickMode, route, onPick }: Props) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  // window.SC is undefined if the CDN scripts failed to load (offline) — the
  // try/catch keeps that from surfacing as a red-box error in the app.
  const run = (js: string) => ref.current?.injectJavaScript(`try { ${js} } catch (e) {} true;`);

  useEffect(() => {
    if (ready) run(`window.SC.setData(${JSON.stringify({ zones, heatPoints })});`);
  }, [ready, zones, heatPoints]);

  useEffect(() => {
    if (ready) run(`window.SC.setUser(${JSON.stringify(user)});`);
  }, [ready, user]);

  useEffect(() => {
    if (ready && focus) run(`window.SC.focus(${focus.latitude}, ${focus.longitude});`);
  }, [ready, focus]);

  useEffect(() => {
    if (ready) run(`window.SC.setPickMode(${pickMode});`);
  }, [ready, pickMode]);

  useEffect(() => {
    if (ready) run(`window.SC.setRoute(${JSON.stringify(route)});`);
  }, [ready, route]);

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === "pick" && typeof msg.latitude === "number" && typeof msg.longitude === "number") {
        onPick({ latitude: msg.latitude, longitude: msg.longitude });
      }
    } catch {
      // ignore anything that isn't our own JSON message
    }
  };

  return (
    <WebView
      ref={ref}
      style={styles.web}
      originWhitelist={["*"]}
      source={{ html: DANGER_MAP_HTML }}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      onLoadEnd={() => setReady(true)}
      onMessage={handleMessage}
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "#e5e7eb" },
});
