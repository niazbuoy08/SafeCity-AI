import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api/client";
import { StatCard } from "../components/StatCard";
import { HeatmapLayer, HeatPoint } from "../components/HeatmapLayer";
import { INCIDENT_LABELS, Hotspot, Incident, Severity } from "../types";

const COLORS = ["#1e3a6b", "#2a4d8a", "#d97706", "#dc2626", "#16a34a", "#94a3b8"];

const SEVERITY_WEIGHT: Record<Severity, number> = {
  low: 0.2,
  medium: 0.45,
  high: 0.7,
  critical: 1.0,
};

const DHAKA_CENTER: [number, number] = [23.7808, 90.3795];

interface CameraActivity {
  cameraId: string;
  name: string;
  location: string;
  status: string;
  incidentCount: number;
}

export default function Analytics() {
  const [data, setData] = useState<any>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [cameraActivity, setCameraActivity] = useState<CameraActivity[]>([]);
  const [heatPoints, setHeatPoints] = useState<HeatPoint[]>([]);

  useEffect(() => {
    async function load() {
      const [a, h, c, i] = await Promise.all([
        api.get("/analytics/incidents"),
        api.get("/analytics/hotspots"),
        api.get("/analytics/cameras"),
        api.get("/incidents?limit=500"),
      ]);
      setData(a.data);
      setHotspots(h.data);
      setCameraActivity(c.data);
      setHeatPoints(
        (i.data as Incident[])
          .filter((inc) => inc.status !== "false_alarm")
          .map((inc) => ({
            latitude: inc.latitude,
            longitude: inc.longitude,
            weight: SEVERITY_WEIGHT[inc.severity],
          }))
      );
    }
    load();
  }, []);

  if (!data) return <div className="p-6 text-slate-400">Loading analytics...</div>;

  const byType = data.byType.map((d: any) => ({ name: INCIDENT_LABELS[d._id as keyof typeof INCIDENT_LABELS] || d._id, count: d.count }));
  const byLocation = data.byLocation.map((d: any) => ({ name: d._id, count: d.count }));
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const found = data.byHour.find((d: any) => d._id === h);
    return { hour: `${h}:00`, count: found?.count || 0 };
  });
  const byDay = data.byDay.map((d: any) => ({ date: d._id, count: d.count }));
  const verifiedVsFalse = data.verifiedVsFalse.map((d: any) => ({
    name: d._id === "false_alarm" ? "False Alarm" : "Verified",
    value: d.count,
  }));

  const topHotspot = [...hotspots].sort((a, b) => b.incidentCount - a.incidentCount)[0];
  const eveningType = byHour.slice(17, 22).reduce((a, b) => a + b.count, 0);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-xl font-bold text-navy-900">Analytics</h1>
        <p className="text-sm text-slate-500">
          Prototype analytics — patterns shown here are derived from demo seed data and any incidents created during
          this session. Intended to illustrate preventive-planning value, not to make operational claims.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Avg Verification Time" value={fmtSeconds(data.avgVerificationSeconds)} />
        <StatCard label="Avg Response Time" value={fmtSeconds(data.avgResponseSeconds)} />
        <StatCard label="Total Verified" value={verifiedVsFalse.find((v: any) => v.name === "Verified")?.value ?? 0} accent="success" />
        <StatCard label="Total False Alarms" value={verifiedVsFalse.find((v: any) => v.name === "False Alarm")?.value ?? 0} accent="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Incidents by Type">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byType}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#1e3a6b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Incidents by Location">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byLocation}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#2a4d8a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Incidents by Hour of Day">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byHour}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Incidents by Day">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#1e3a6b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Verified vs False Alarms">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={verifiedVsFalse} dataKey="value" nameKey="name" outerRadius={90} label>
                {verifiedVsFalse.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-700">Danger Heatmap</h2>
          <span className="text-xs text-slate-400">
            Density of verified/unresolved incidents, weighted by severity — darker red = higher risk
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl overflow-hidden border border-slate-200" style={{ height: 420 }}>
            <MapContainer center={DHAKA_CENTER} zoom={12} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <HeatmapLayer points={heatPoints} />
            </MapContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">Danger Board</h3>
              <p className="text-xs text-slate-400">Ranked by incident volume</p>
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto" style={{ maxHeight: 372 }}>
              {[...hotspots]
                .sort((a, b) => b.incidentCount - a.incidentCount)
                .map((h, i) => (
                  <div key={h.location} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0
                          ? "bg-red-600 text-white"
                          : i === 1
                          ? "bg-orange-500 text-white"
                          : i === 2
                          ? "bg-amber-500 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-navy-900 truncate">{h.location}</div>
                      <div className="text-xs text-slate-400 truncate">
                        {h.types.map((t) => INCIDENT_LABELS[t as keyof typeof INCIDENT_LABELS] || t).join(", ")}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        h.riskLevel === "high"
                          ? "bg-red-100 text-red-700"
                          : h.riskLevel === "medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {h.incidentCount}
                    </span>
                  </div>
                ))}
              {hotspots.length === 0 && <div className="text-sm text-slate-400 py-6 px-4">No hotspot data yet.</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Prototype Insight</h2>
        <p className="text-sm text-slate-600">
          {topHotspot
            ? `${INCIDENT_LABELS[topHotspot.types[0] as keyof typeof INCIDENT_LABELS] || topHotspot.types[0]} incidents are concentrated around ${topHotspot.location}, which recorded ${topHotspot.incidentCount} incidents in the observed period.`
            : "Not enough data yet to surface a location insight."}
          {" "}
          {eveningType > 0 &&
            `Roughly ${eveningType} incidents occurred during evening hours (5 PM–10 PM) across all cameras, suggesting evening patrols may be worth prioritizing.`}
        </p>
        <p className="text-xs text-slate-400 mt-2">
          These are illustrative insights generated from prototype data — not a substitute for a full statistical
          study. SafeCity AI does not claim to prevent crime with certainty; it assists detection, verification, and
          response, and this analytics view supports preventive planning.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Camera Activity</h2>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Camera</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Incidents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cameraActivity.map((c) => (
                <tr key={c.cameraId}>
                  <td className="px-4 py-2 font-medium text-navy-900">{c.name}</td>
                  <td className="px-4 py-2 text-slate-600">{c.location}</td>
                  <td className="px-4 py-2 capitalize">{c.status}</td>
                  <td className="px-4 py-2">{c.incidentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-2">{title}</h2>
      {children}
    </div>
  );
}

function fmtSeconds(s: number | null): string {
  if (s === null || s === undefined) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.round(s / 60)}m`;
}
