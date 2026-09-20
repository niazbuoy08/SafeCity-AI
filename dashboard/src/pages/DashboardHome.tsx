import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { StatCard } from "../components/StatCard";
import { SafetyMap } from "../components/SafetyMap";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { AnalyticsSummary, Camera, Incident, Hotspot, INCIDENT_LABELS, SOCKET_EVENTS } from "../types";

export default function DashboardHome() {
  const socket = useSocket();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);

  const load = useCallback(async () => {
    const [s, c, i, h] = await Promise.all([
      api.get("/analytics/summary"),
      api.get("/cameras"),
      api.get("/incidents?limit=8"),
      api.get("/analytics/hotspots"),
    ]);
    setSummary(s.data);
    setCameras(c.data);
    setIncidents(i.data);
    setHotspots(h.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on(SOCKET_EVENTS.INCIDENT_DETECTED, refresh);
    socket.on(SOCKET_EVENTS.INCIDENT_UPDATED, refresh);
    socket.on(SOCKET_EVENTS.CAMERA_ONLINE, refresh);
    socket.on(SOCKET_EVENTS.CAMERA_OFFLINE, refresh);
    socket.on(SOCKET_EVENTS.ANALYTICS_UPDATED, refresh);
    return () => {
      socket.off(SOCKET_EVENTS.INCIDENT_DETECTED, refresh);
      socket.off(SOCKET_EVENTS.INCIDENT_UPDATED, refresh);
      socket.off(SOCKET_EVENTS.CAMERA_ONLINE, refresh);
      socket.off(SOCKET_EVENTS.CAMERA_OFFLINE, refresh);
      socket.off(SOCKET_EVENTS.ANALYTICS_UPDATED, refresh);
    };
  }, [socket, load]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-xl font-bold text-navy-900">City Safety Control Room</h1>
        <p className="text-sm text-slate-500">
          AI-assisted incident detection and response — humans verify every incident before dispatch.
        </p>
      </header>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
          <StatCard label="Active Cameras" value={summary.totalCameras} />
          <StatCard label="Cameras Online" value={summary.camerasOnline} accent="success" />
          <StatCard label="Incidents Today" value={summary.incidentsToday} />
          <StatCard label="Awaiting Verification" value={summary.incidentsAwaitingVerification} accent="warning" />
          <StatCard label="Verified Incidents" value={summary.verifiedIncidents} accent="success" />
          <StatCard label="Active Responses" value={summary.activeResponses} />
          <StatCard label="Critical Incidents" value={summary.criticalIncidents} accent="critical" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">City Safety Map</h2>
          <SafetyMap cameras={cameras} incidents={incidents} hotspots={hotspots} height="420px" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700">Recent Incidents</h2>
            <Link to="/incidents" className="text-xs text-blue-600 font-medium hover:underline">
              View all
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {incidents.length === 0 && <div className="p-4 text-sm text-slate-400">No incidents yet.</div>}
            {incidents.map((inc) => (
              <Link
                key={inc.incidentId}
                to={`/incidents/${inc.incidentId}`}
                className="block p-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-navy-900">{INCIDENT_LABELS[inc.type]}</span>
                  <SeverityBadge severity={inc.severity} />
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {inc.cameraId} · {inc.location} · {new Date(inc.detectedAt).toLocaleTimeString()}
                </div>
                <div className="mt-1.5">
                  <StatusBadge status={inc.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
