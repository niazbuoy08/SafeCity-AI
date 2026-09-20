import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { Incident, INCIDENT_LABELS, SOCKET_EVENTS } from "../types";

interface AlertItem extends Incident {
  _alertId: string;
}

export function IncidentAlertToast() {
  const socket = useSocket();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const dismiss = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a._alertId !== alertId));
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (incident: Incident) => {
      const alertId = `${incident.incidentId}-${Date.now()}`;
      setAlerts((prev) => [{ ...incident, _alertId: alertId }, ...prev].slice(0, 3));
      const audio = playChime();
      void audio;
      setTimeout(() => dismiss(alertId), 10000);
    };
    socket.on(SOCKET_EVENTS.INCIDENT_DETECTED, handler);
    return () => {
      socket.off(SOCKET_EVENTS.INCIDENT_DETECTED, handler);
    };
  }, [socket, dismiss]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 w-96">
      {alerts.map((incident) => (
        <div
          key={incident._alertId}
          className="bg-white border-l-4 border-red-600 shadow-xl rounded-lg p-4 animate-[slideIn_0.25s_ease-out]"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-red-600 font-bold text-xs tracking-wide">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
              NEW INCIDENT
            </div>
            <button
              onClick={() => dismiss(incident._alertId)}
              className="text-slate-400 hover:text-slate-600 text-sm leading-none"
            >
              ✕
            </button>
          </div>
          <div className="mt-1 font-semibold text-navy-900">{INCIDENT_LABELS[incident.type]}</div>
          <div className="text-sm text-slate-600">
            {incident.cameraId} · {incident.location}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {new Date(incident.detectedAt).toLocaleTimeString()} · Confidence: {Math.round(incident.confidence)}% ·{" "}
            <span className="font-medium text-slate-500">{incident.severity.toUpperCase()}</span>
          </div>
          <button
            onClick={() => {
              navigate(`/incidents/${incident.incidentId}`);
              dismiss(incident._alertId);
            }}
            className="mt-3 w-full bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium rounded-md py-1.5"
          >
            Show Evidence
          </button>
        </div>
      ))}
    </div>
  );
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    return ctx;
  } catch {
    return null;
  }
}
