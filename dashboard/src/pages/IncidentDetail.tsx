import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api, frameUrl } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import {
  Incident,
  IncidentEvent,
  ResponseRecord,
  ResponseTeam,
  INCIDENT_LABELS,
  AUTHORITY_LABELS,
  SOCKET_EVENTS,
} from "../types";

export default function IncidentDetail() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const socket = useSocket();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [response, setResponse] = useState<ResponseRecord | null>(null);
  const [teams, setTeams] = useState<ResponseTeam[]>([]);
  const [showFalseAlarmModal, setShowFalseAlarmModal] = useState(false);
  const [falseAlarmReason, setFalseAlarmReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!incidentId) return;
    const res = await api.get(`/incidents/${incidentId}`);
    setIncident(res.data.incident);
    setEvents(res.data.events);

    if (res.data.incident.responseId) {
      const responsesRes = await api.get("/responses");
      const found = responsesRes.data.find((r: ResponseRecord) => r.responseId === res.data.incident.responseId);
      setResponse(found || null);
    } else {
      setResponse(null);
    }

    const teamsRes = await api.get("/responses/teams");
    setTeams(teamsRes.data);
  }, [incidentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on(SOCKET_EVENTS.INCIDENT_UPDATED, refresh);
    socket.on(SOCKET_EVENTS.INCIDENT_VERIFIED, refresh);
    socket.on(SOCKET_EVENTS.INCIDENT_FALSE_ALARM, refresh);
    socket.on(SOCKET_EVENTS.RESPONSE_CREATED, refresh);
    socket.on(SOCKET_EVENTS.RESPONSE_UPDATED, refresh);
    return () => {
      socket.off(SOCKET_EVENTS.INCIDENT_UPDATED, refresh);
      socket.off(SOCKET_EVENTS.INCIDENT_VERIFIED, refresh);
      socket.off(SOCKET_EVENTS.INCIDENT_FALSE_ALARM, refresh);
      socket.off(SOCKET_EVENTS.RESPONSE_CREATED, refresh);
      socket.off(SOCKET_EVENTS.RESPONSE_UPDATED, refresh);
    };
  }, [socket, load]);

  async function confirmIncident() {
    if (!incidentId) return;
    setBusy(true);
    try {
      await api.patch(`/incidents/${incidentId}/verify`, { action: "confirm" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function submitFalseAlarm() {
    if (!incidentId) return;
    setBusy(true);
    try {
      await api.patch(`/incidents/${incidentId}/verify`, { action: "false_alarm", reason: falseAlarmReason });
      setShowFalseAlarmModal(false);
      setFalseAlarmReason("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function dispatchResponse() {
    if (!incidentId) return;
    setBusy(true);
    try {
      await api.patch(`/incidents/${incidentId}/dispatch`, {});
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function advanceResponse(status: "responding" | "resolved") {
    if (!response) return;
    setBusy(true);
    try {
      await api.patch(`/responses/${response.responseId}`, { status });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!incident) return <div className="p-6 text-slate-400">Loading incident...</div>;

  const latestFrame = frameUrl(incident.evidenceFrames[incident.evidenceFrames.length - 1]);
  const canVerify = incident.status === "detected" || incident.status === "under_review";
  const canDispatch = incident.status === "verified";
  const assignedTeam = teams.find((t) => t.teamId === response?.teamId);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <Link to="/incidents" className="text-sm text-blue-600 hover:underline">
        ← Back to Incidents
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-navy-900">{INCIDENT_LABELS[incident.type]}</h1>
            <SeverityBadge severity={incident.severity} />
            <StatusBadge status={incident.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {incident.incidentId} · {incident.cameraId} · {incident.location}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-navy-950 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
            {latestFrame ? (
              <img src={latestFrame} className="w-full h-full object-contain" alt="Evidence" />
            ) : (
              <span className="text-slate-500">No evidence frame captured</span>
            )}
          </div>

          {incident.evidenceFrames.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {incident.evidenceFrames.map((f, idx) => (
                <img
                  key={idx}
                  src={frameUrl(f) || ""}
                  className="h-16 w-24 object-cover rounded border border-slate-200 shrink-0"
                />
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">AI Description</h2>
            <p className="text-sm text-slate-600">{incident.description}</p>
            {incident.detectedObjects.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {incident.detectedObjects.map((o, i) => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {o}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Incident Timeline</h2>
            <ol className="space-y-3">
              <TimelineRow label="First detected" time={incident.firstDetectedAt} />
              {events.length > 1 && (
                <TimelineRow
                  label={`${events.length} detections grouped into this incident`}
                  time={incident.lastDetectedAt}
                />
              )}
              {incident.verifiedAt && (
                <TimelineRow
                  label={`${incident.status === "false_alarm" ? "Marked false alarm" : "Verified"} by ${incident.verifiedBy}`}
                  time={incident.verifiedAt}
                />
              )}
              {response && <TimelineRow label={`Dispatched to ${AUTHORITY_LABELS[response.authority]}`} time={response.dispatchedAt} />}
              {response?.arrivedAt && <TimelineRow label="Response team responding on scene" time={response.arrivedAt} />}
              {response?.resolvedAt && <TimelineRow label="Incident resolved" time={response.resolvedAt} />}
            </ol>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 text-sm">
            <Row label="Camera" value={incident.cameraId} />
            <Row label="Location" value={incident.location} />
            <Row label="Detected At" value={new Date(incident.detectedAt).toLocaleString()} />
            <Row label="Confidence" value={`${Math.round(incident.confidence)}%`} />
            <Row label="Severity" value={incident.severity} />
          </div>

          {canVerify && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Operator Actions</h2>
              <button
                disabled={busy}
                onClick={confirmIncident}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-md py-2.5 disabled:opacity-60"
              >
                ✓ CONFIRM INCIDENT
              </button>
              <button
                disabled={busy}
                onClick={() => setShowFalseAlarmModal(true)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-md py-2.5 disabled:opacity-60"
              >
                ✕ FALSE ALARM
              </button>
            </div>
          )}

          {incident.status === "false_alarm" && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Marked False Alarm</h2>
              <p className="text-sm text-slate-500">{incident.falseAlarmReason || "No reason provided"}</p>
            </div>
          )}

          {canDispatch && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
              <h2 className="text-sm font-semibold text-slate-700">Recommended Response</h2>
              <div className="text-lg font-bold text-navy-900">{AUTHORITY_LABELS[incident.assignedAuthority!]}</div>
              <button
                disabled={busy}
                onClick={dispatchResponse}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md py-2.5 disabled:opacity-60"
              >
                Confirm Assignment & Dispatch
              </button>
            </div>
          )}

          {response && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 text-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Response Tracking</h2>
              <Row label="Assigned Team" value={assignedTeam?.name || response.teamId} />
              <Row label="Authority" value={AUTHORITY_LABELS[response.authority]} />
              <Row label="Dispatch Time" value={new Date(response.dispatchedAt).toLocaleTimeString()} />
              <Row label="Priority" value={response.priority} />
              <div className="pt-1">
                <StatusBadge status={response.status === "dispatched" ? "dispatched" : response.status === "responding" ? "responding" : "resolved"} />
              </div>

              {response.status === "dispatched" && (
                <button
                  disabled={busy}
                  onClick={() => advanceResponse("responding")}
                  className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md py-2 disabled:opacity-60"
                >
                  Mark Responding On-Scene
                </button>
              )}
              {response.status === "responding" && (
                <button
                  disabled={busy}
                  onClick={() => advanceResponse("resolved")}
                  className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md py-2 disabled:opacity-60"
                >
                  Mark Resolved
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showFalseAlarmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-3">
            <h3 className="font-semibold text-navy-900">Mark as False Alarm</h3>
            <p className="text-sm text-slate-500">Optionally provide a reason for the record.</p>
            <textarea
              value={falseAlarmReason}
              onChange={(e) => setFalseAlarmReason(e.target.value)}
              className="w-full border border-slate-300 rounded-md p-2 text-sm"
              rows={3}
              placeholder="e.g. Reviewed footage — no real threat present"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowFalseAlarmModal(false)}
                className="px-3 py-1.5 text-sm rounded-md text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={submitFalseAlarm}
                className="px-3 py-1.5 text-sm rounded-md bg-navy-900 text-white hover:bg-navy-800"
              >
                Confirm False Alarm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-navy-900">{value}</span>
    </div>
  );
}

function TimelineRow({ label, time }: { label: string; time: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
      <div>
        <div className="text-sm text-navy-900">{label}</div>
        <div className="text-xs text-slate-400">{new Date(time).toLocaleString()}</div>
      </div>
    </li>
  );
}
