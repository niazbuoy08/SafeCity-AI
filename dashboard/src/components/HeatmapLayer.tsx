import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

export interface HeatPoint {
  latitude: number;
  longitude: number;
  weight: number; // 0-1, typically derived from severity
}

// Single-hue red ramp (light -> dark), consistent with this app's existing
// convention of red = danger/critical. Deliberately not the default
// leaflet.heat rainbow gradient (blue/green/yellow/red) — a sequential
// magnitude encoding should read as one hue getting more intense, not a
// spectrum, so low-density areas don't accidentally look "cool and safe"
// in a color (blue) that has no relationship to the danger scale.
const HEAT_GRADIENT: Record<number, string> = {
  0.2: "#fbe4e3",
  0.4: "#f0a8a4",
  0.6: "#e34948",
  0.8: "#c22f2f",
  1.0: "#7d1c1c",
};

export function HeatmapLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    const layer = L.heatLayer(
      points.map((p) => [p.latitude, p.longitude, p.weight]),
      {
        radius: 32,
        blur: 24,
        maxZoom: 15,
        max: 1.0,
        gradient: HEAT_GRADIENT,
      }
    ).addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);

  return null;
}
