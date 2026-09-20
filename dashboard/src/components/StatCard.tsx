interface StatCardProps {
  label: string;
  value: string | number;
  accent?: "default" | "critical" | "warning" | "success";
  sub?: string;
}

export function StatCard({ label, value, accent = "default", sub }: StatCardProps) {
  const accentStyles: Record<string, string> = {
    default: "text-navy-900",
    critical: "text-red-600",
    warning: "text-amber-600",
    success: "text-green-600",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${accentStyles[accent]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
