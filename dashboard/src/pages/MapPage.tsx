import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { SafetyMap } from "../components/SafetyMap";
import { Camera, Incident, ResponseTeam, Hotspot, SOCKET_EVENTS } from "../types";

export default function MapPage() {
  const socket = useSocket();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [teams, setTeams] = useState<ResponseTeam[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [showHotspots, setShowHotspots] = useState(true);

  const load = useCallback(async () => {
    const [c, i, t, h] = await Promise.all([
      api.get("/cameras"),
      api.get("/incidents?limit=200"),
      api.get("/responses/teams"),
      api.get("/analytics/hotspots"),
    ]);
    setCameras(c.data);
    setIncidents(i.data.filter((inc: Incident) => inc.status !== "resolved"));
    setTeams(t.data);
    setHotspots(h.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    Object.values(SOCKET_EVENTS).forEach((evt) => socket.on(evt, refresh));
    return () => {
      Object.values(SOCKET_EVENTS).forEach((evt) => socket.off(evt, refresh));
    };
  }, [socket, load]);

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">City Safety Map</h1>
          <p className="text-sm text-slate-500">Cameras, active incidents, response teams, and risk hotspots.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showHotspots} onChange={(e) => setShowHotspots(e.target.checked)} />
          Show hotspots
        </label>
      </header>

      <div className="flex gap-4 text-xs text-slate-600 flex-wrap">
        <Legend color="#2a4d8a" label="Camera (online)" />
        <Legend color="#94a3b8" label="Camera (offline)" />
        <Legend color="#d97706" label="Incident (unverified)" />
        <Legend color="#dc2626" label="Incident (critical/high)" />
        <Legend color="#16a34a" label="Incident (verified/resolved) / Team available" />
        <Legend color="#f59e0b" label="Team dispatched" />
      </div>

      <SafetyMap
        cameras={cameras}
        incidents={incidents}
        teams={teams}
        hotspots={showHotspots ? hotspots : []}
        height="640px"
      />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}
