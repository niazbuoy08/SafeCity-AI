import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api, frameUrl } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { CameraStatusDot, SeverityBadge, StatusBadge } from "../components/Badges";
import { Camera, Incident, INCIDENT_LABELS, SOCKET_EVENTS } from "../types";

export default function CameraDetail() {
  const { cameraId } = useParams<{ cameraId: string }>();
  const socket = useSocket();
  const [camera, setCamera] = useState<Camera | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const load = useCallback(async () => {
    if (!cameraId) return;
    const [c, i] = await Promise.all([
      api.get(`/cameras/${cameraId}`),
      api.get(`/incidents?cameraId=${cameraId}&limit=20`),
    ]);
    setCamera(c.data);
    setIncidents(i.data);
  }, [cameraId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on(SOCKET_EVENTS.CAMERA_FRAME, refresh);
    socket.on(SOCKET_EVENTS.CAMERA_ONLINE, refresh);
    socket.on(SOCKET_EVENTS.CAMERA_OFFLINE, refresh);
    socket.on(SOCKET_EVENTS.INCIDENT_DETECTED, refresh);
    socket.on(SOCKET_EVENTS.INCIDENT_UPDATED, refresh);
    return () => {
      socket.off(SOCKET_EVENTS.CAMERA_FRAME, refresh);
      socket.off(SOCKET_EVENTS.CAMERA_ONLINE, refresh);
      socket.off(SOCKET_EVENTS.CAMERA_OFFLINE, refresh);
      socket.off(SOCKET_EVENTS.INCIDENT_DETECTED, refresh);
      socket.off(SOCKET_EVENTS.INCIDENT_UPDATED, refresh);
    };
  }, [socket, load]);

  if (!camera) return <div className="p-6 text-slate-400">Loading camera...</div>;

  const img = frameUrl(camera.lastFrameUrl);

  return (
    <div className="p-6 space-y-6">
      <Link to="/cameras" className="text-sm text-blue-600 hover:underline">
        ← Back to Live Cameras
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-navy-950 rounded-xl overflow-hidden aspect-video flex items-center justify-center relative">
            {img ? (
              <img src={img} className="w-full h-full object-contain" alt={camera.cameraId} />
            ) : (
              <span className="text-slate-500">No frame received yet</span>
            )}
            {camera.aiMonitoring && (
              <div className="absolute top-3 right-3 bg-blue-600/90 text-white text-xs font-semibold px-2.5 py-1 rounded flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> AI MONITORING ACTIVE
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent Incidents on {camera.cameraId}</h2>
            <div className="divide-y divide-slate-100">
              {incidents.length === 0 && <div className="text-sm text-slate-400 py-2">No incidents recorded.</div>}
              {incidents.map((inc) => (
                <Link key={inc.incidentId} to={`/incidents/${inc.incidentId}`} className="block py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{INCIDENT_LABELS[inc.type]}</span>
                    <SeverityBadge severity={inc.severity} />
                  </div>
                  <div className="text-xs text-slate-500">{new Date(inc.detectedAt).toLocaleString()}</div>
                  <div className="mt-1">
                    <StatusBadge status={inc.status} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Camera Information</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Camera ID" value={camera.cameraId} />
              <Row label="Name" value={camera.name} />
              <Row label="Location" value={camera.location} />
              <Row label="Coordinates" value={`${camera.latitude.toFixed(4)}, ${camera.longitude.toFixed(4)}`} />
              <Row label="Source" value={camera.source} />
              <Row label="Detection Interval" value={`${camera.detectionIntervalMs} ms`} />
              <div className="flex items-center justify-between pt-1">
                <dt className="text-slate-500">Status</dt>
                <dd><CameraStatusDot status={camera.status} /></dd>
              </div>
              <Row
                label="Last Activity"
                value={camera.lastSeen ? new Date(camera.lastSeen).toLocaleString() : "never"}
              />
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-700">AI Status</h2>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  camera.aiMonitoring ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {camera.aiMonitoring ? "Monitoring" : "Not Monitored"}
              </span>
            </div>

            {camera.lastDetectionAt ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-navy-900">
                    {INCIDENT_LABELS[camera.lastDetectionType!]}
                  </span>
                  {camera.lastDetectionSeverity && <SeverityBadge severity={camera.lastDetectionSeverity} />}
                </div>
                <p className="text-sm text-slate-600">{camera.lastDetectionDescription}</p>
                <div className="text-xs text-slate-400">
                  Confidence: {camera.lastDetectionConfidence}% · as of{" "}
                  {new Date(camera.lastDetectionAt).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No frames analyzed yet — start monitoring from the camera to see live AI classifications here.
              </p>
            )}

            <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
              Detections are grouped over a rolling window, so consecutive frames of the same event become a single
              incident instead of duplicates. Most frames classify as "normal" and never create an incident — this
              panel shows the AI's most recent classification either way.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-navy-900">{value}</dd>
    </div>
  );
}
