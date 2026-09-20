import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, frameUrl } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { Incident, IncidentStatus, IncidentType, INCIDENT_LABELS, SOCKET_EVENTS } from "../types";

const STATUS_FILTERS: Array<{ value: IncidentStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "detected", label: "Detected" },
  { value: "under_review", label: "Under Review" },
  { value: "verified", label: "Verified" },
  { value: "false_alarm", label: "False Alarm" },
  { value: "dispatched", label: "Dispatched" },
  { value: "responding", label: "Responding" },
  { value: "resolved", label: "Resolved" },
];

const TYPE_FILTERS: Array<{ value: IncidentType | "all"; label: string }> = [
  { value: "all", label: "All Types" },
  { value: "physical_altercation", label: "Physical Altercation" },
  { value: "road_accident", label: "Road Accident" },
  { value: "fire_smoke", label: "Fire / Smoke" },
  { value: "person_fall", label: "Person Fall" },
];

export default function Incidents() {
  const socket = useSocket();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [status, setStatus] = useState<IncidentStatus | "all">("all");
  const [type, setType] = useState<IncidentType | "all">("all");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (type !== "all") params.set("type", type);
    params.set("limit", "200");
    const res = await api.get(`/incidents?${params.toString()}`);
    setIncidents(res.data);
  }, [status, type]);

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
      <header>
        <h1 className="text-xl font-bold text-navy-900">Incidents</h1>
        <p className="text-sm text-slate-500">{incidents.length} incidents match current filters</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              status === f.value ? "bg-navy-900 text-white border-navy-900" : "bg-white text-slate-600 border-slate-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setType(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              type === f.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Evidence</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Camera</th>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-left px-4 py-3">Confidence</th>
              <th className="text-left px-4 py-3">Severity</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {incidents.map((inc) => {
              const img = frameUrl(inc.evidenceFrames[inc.evidenceFrames.length - 1]);
              return (
                <tr key={inc.incidentId} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-2">
                    <Link to={`/incidents/${inc.incidentId}`}>
                      <div className="h-12 w-16 bg-navy-950 rounded overflow-hidden flex items-center justify-center">
                        {img ? (
                          <img src={img} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-slate-500">No frame</span>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Link to={`/incidents/${inc.incidentId}`} className="font-medium text-navy-900 hover:underline">
                      {INCIDENT_LABELS[inc.type]}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{inc.cameraId}</td>
                  <td className="px-4 py-2 text-slate-600">{inc.location}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(inc.detectedAt).toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium">{Math.round(inc.confidence)}%</td>
                  <td className="px-4 py-2">
                    <SeverityBadge severity={inc.severity} />
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={inc.status} />
                  </td>
                </tr>
              );
            })}
            {incidents.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No incidents match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
