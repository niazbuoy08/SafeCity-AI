import { IncidentStatus, Severity, CameraStatus, STATUS_LABELS } from "../types";

export function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    critical: "bg-red-100 text-red-700 border-red-300",
    high: "bg-orange-100 text-orange-700 border-orange-300",
    medium: "bg-amber-100 text-amber-700 border-amber-300",
    low: "bg-green-100 text-green-700 border-green-300",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[severity]}`}>
      {severity.toUpperCase()}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const styles: Record<IncidentStatus, string> = {
    detected: "bg-slate-100 text-slate-700 border-slate-300",
    under_review: "bg-amber-100 text-amber-700 border-amber-300",
    verified: "bg-green-100 text-green-700 border-green-300",
    false_alarm: "bg-slate-200 text-slate-500 border-slate-300 line-through",
    dispatched: "bg-blue-100 text-blue-700 border-blue-300",
    responding: "bg-indigo-100 text-indigo-700 border-indigo-300",
    resolved: "bg-emerald-100 text-emerald-700 border-emerald-300",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function CameraStatusDot({ status }: { status: CameraStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className={`h-2 w-2 rounded-full ${status === "online" ? "bg-green-500 animate-pulse" : "bg-slate-400"}`}
      />
      {status === "online" ? "Online" : "Offline"}
    </span>
  );
}
