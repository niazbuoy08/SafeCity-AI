import { MapContainer, TileLayer, CircleMarker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Camera, Incident, ResponseTeam, Hotspot, INCIDENT_LABELS } from "../types";

// Vite bundles leaflet's default marker assets oddly; we render CircleMarkers
// instead of the default pin icon so no extra asset wiring is needed.
void L;

const DHAKA_CENTER: [number, number] = [23.7808, 90.3795];

interface SafetyMapProps {
  cameras?: Camera[];
  incidents?: Incident[];
  teams?: ResponseTeam[];
  hotspots?: Hotspot[];
  height?: string;
}

export function SafetyMap({ cameras = [], incidents = [], teams = [], hotspots = [], height = "480px" }: SafetyMapProps) {
  return (
    <div style={{ height }} className="rounded-xl overflow-hidden border border-slate-200">
      <MapContainer center={DHAKA_CENTER} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {hotspots.map((h, i) => (
          <Circle
            key={`hotspot-${i}`}
            center={[h.latitude, h.longitude]}
            radius={h.riskLevel === "high" ? 900 : h.riskLevel === "medium" ? 600 : 350}
            pathOptions={{
              color: h.riskLevel === "high" ? "#dc2626" : h.riskLevel === "medium" ? "#f59e0b" : "#16a34a",
              fillOpacity: 0.12,
              weight: 1,
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{h.location} — Hotspot</div>
                <div>Incidents: {h.incidentCount}</div>
                <div>Risk level: {h.riskLevel}</div>
              </div>
            </Popup>
          </Circle>
        ))}

        {cameras.map((c) => (
          <CircleMarker
            key={c.cameraId}
            center={[c.latitude, c.longitude]}
            radius={7}
            pathOptions={{
              color: "#1e3a6b",
              fillColor: c.status === "online" ? "#2a4d8a" : "#94a3b8",
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{c.cameraId}</div>
                <div>{c.location}</div>
                <div>Status: {c.status}</div>
                <div>Last activity: {c.lastSeen ? new Date(c.lastSeen).toLocaleString() : "never"}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {incidents.map((inc) => {
          const color =
            inc.status === "false_alarm"
              ? "#94a3b8"
              : inc.severity === "critical"
              ? "#dc2626"
              : inc.severity === "high"
              ? "#ea580c"
              : inc.status === "verified" || inc.status === "resolved"
              ? "#16a34a"
              : "#d97706";
          return (
            <CircleMarker
              key={inc.incidentId}
              center={[inc.latitude, inc.longitude]}
              radius={10}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 2 }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{INCIDENT_LABELS[inc.type]}</div>
                  <div>{inc.location}</div>
                  <div>{new Date(inc.detectedAt).toLocaleString()}</div>
                  <div>Severity: {inc.severity}</div>
                  <div>Status: {inc.status}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {teams.map((t) => (
          <CircleMarker
            key={t.teamId}
            center={[t.latitude, t.longitude]}
            radius={6}
            pathOptions={{
              color: "#0f1b3d",
              fillColor: t.status === "available" ? "#16a34a" : "#f59e0b",
              fillOpacity: 0.9,
              weight: 1,
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{t.name}</div>
                <div>Authority: {t.authority}</div>
                <div>Status: {t.status}</div>
                <div>Base: {t.baseLocation}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
