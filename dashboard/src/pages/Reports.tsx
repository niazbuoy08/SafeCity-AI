import { useCallback, useEffect, useState } from "react";
import { api, downloadFile } from "../api/client";
import { StatCard } from "../components/StatCard";
import { WeeklyReport } from "../types";

const DAY_MS = 86400000;

// Bangladesh is UTC+6 with no daylight saving, so a fixed offset gives the
// Dhaka calendar date exactly — the backend buckets reports the same way.
const dhakaToday = () => new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10);
const shiftKey = (key: string, days: number) => new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

function fmtDuration(sec: number | null): string {
  if (sec === null) return "—";
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function delta(now: number, prev: number, hasPrev: boolean): string | undefined {
  if (!hasPrev) return "no earlier data";
  if (now === prev) return "same as previous 7 days";
  return `${now > prev ? "+" : "−"}${Math.abs(now - prev)} vs previous 7 days`;
}

const STATUS_GROUPS: { value: string; label: string; statuses?: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "verified", label: "Verified and later", statuses: "verified,dispatched,responding,resolved" },
  { value: "false", label: "False alarms only", statuses: "false_alarm" },
  { value: "pending", label: "Awaiting review", statuses: "detected,under_review" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "physical_altercation", label: "Physical altercation" },
  { value: "road_accident", label: "Road accident" },
  { value: "fire_smoke", label: "Fire / smoke" },
  { value: "person_fall", label: "Person fall" },
];

export default function Reports() {
  const today = dhakaToday();
  const [endKey, setEndKey] = useState(today);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [from, setFrom] = useState(shiftKey(today, -6));
  const [to, setTo] = useState(today);
  const [statusGroup, setStatusGroup] = useState("all");
  const [type, setType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<WeeklyReport>("/reports/weekly", { params: { end: endKey } });
      setReport(res.data);
    } catch {
      setError("Could not load the weekly summary. Check that the backend is running.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [endKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(key: string, job: () => Promise<void>) {
    setBusy(key);
    setMessage(null);
    try {
      await job();
    } catch (err: any) {
      setMessage(err?.response?.status === 400 ? "Those dates or filters aren't valid." : "The download failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const downloadPdf = () => run("pdf", () => downloadFile("/reports/weekly.pdf", { end: endKey }, `safecity-weekly-summary-${endKey}.pdf`));
  const downloadWeekCsv = () =>
    run("weekcsv", () =>
      downloadFile("/reports/incidents.csv", { from: report?.period.startKey, to: endKey }, `safecity-incidents-${report?.period.startKey}_to_${endKey}.csv`)
    );
  const exportCustom = () =>
    run("custom", () =>
      downloadFile(
        "/reports/incidents.csv",
        { from, to, status: STATUS_GROUPS.find((g) => g.value === statusGroup)?.statuses, type: type || undefined },
        `safecity-incidents-${from}_to_${to}.csv`
      )
    );

  const hasPrev = !!report && (report.previous.detections > 0 || report.previous.confirmed > 0);
  const maxType = Math.max(1, ...(report?.byType.map((b) => b.count) ?? [1]));
  const maxDay = Math.max(1, ...(report?.byDay.map((d) => d.detections) ?? [1]));
  const maxHour = Math.max(1, ...(report?.timeOfDay.hourly ?? [1]));
  const peak = report?.timeOfDay.peak;
  const inPeak = (h: number) => !!peak && [0, 1, 2, 3].some((k) => (peak.startHour + k) % 24 === h);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <header>
        <h1 className="text-xl font-bold text-navy-900">Reports</h1>
        <p className="text-sm text-slate-500">
          Weekly summary for authorities, plus data exports. Only operator-verified incidents are analysed; false alarms are
          counted but never treated as incidents.
        </p>
      </header>

      {/* ---------- Weekly summary ---------- */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEndKey(shiftKey(endKey, -7))}
              className="h-8 w-8 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
              aria-label="Previous week"
            >
              ‹
            </button>
            <div className="min-w-[190px] text-center">
              <div className="text-sm font-semibold text-navy-900" data-testid="week-label">{report?.period.label ?? "Loading…"}</div>
              <div className="text-[11px] text-slate-400">7 days, Dhaka time</div>
            </div>
            <button
              onClick={() => setEndKey(shiftKey(endKey, 7) > today ? today : shiftKey(endKey, 7))}
              disabled={endKey >= today}
              className="h-8 w-8 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Next week"
            >
              ›
            </button>
            {endKey !== today && (
              <button onClick={() => setEndKey(today)} className="ml-1 text-xs font-medium text-blue-600 hover:underline">
                Latest
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadWeekCsv}
              disabled={busy !== null || !report}
              className="px-3 py-2 text-sm font-semibold rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === "weekcsv" ? "Preparing…" : "Download CSV"}
            </button>
            <button
              onClick={downloadPdf}
              disabled={busy !== null || !report}
              className="px-3 py-2 text-sm font-semibold rounded-md bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-50"
            >
              {busy === "pdf" ? "Preparing…" : "Download PDF"}
            </button>
          </div>
        </div>

        {message && <div className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{message}</div>}
        {error && <div className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{error}</div>}
        {loading && !report && <div className="text-sm text-slate-400 py-6">Building summary…</div>}

        {report && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="AI detections" value={report.totals.detections} sub={delta(report.totals.detections, report.previous.detections, hasPrev)} />
              <StatCard label="Verified incidents" value={report.totals.confirmed} accent="success" sub={delta(report.totals.confirmed, report.previous.confirmed, hasPrev)} />
              <StatCard
                label="False alarms"
                value={report.totals.falseAlarms}
                accent="warning"
                sub={report.totals.falseAlarmRatePct === null ? "none reviewed" : `${report.totals.falseAlarmRatePct}% of reviewed`}
              />
              <StatCard
                label="Time to decision"
                value={fmtDuration(report.timings.avgReviewSec)}
                sub={report.timings.reviewN ? `average of ${report.timings.reviewN}` : "no reviews yet"}
              />
              <StatCard
                label="Dispatch to on scene"
                value={fmtDuration(report.timings.avgResponseSec)}
                sub={report.timings.responseN ? `average of ${report.timings.responseN}` : "no arrivals recorded"}
              />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Key observations</h2>
              <ul className="space-y-1.5">
                {report.highlights.map((h, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-700 mb-2">Verified incidents by type</h2>
                {report.byType.length === 0 ? (
                  <p className="text-sm text-slate-400">No verified incidents in this period.</p>
                ) : (
                  <div className="space-y-2">
                    {report.byType.map((b) => (
                      <div key={b.type} className="flex items-center gap-3 text-sm">
                        <div className="w-36 shrink-0 text-slate-600 truncate">{b.label}</div>
                        <div className="flex-1 h-3.5 bg-slate-100 rounded">
                          <div className="h-full rounded bg-navy-700" style={{ width: `${(b.count / maxType) * 100}%` }} />
                        </div>
                        <div className="w-6 text-right font-semibold text-navy-900">{b.count}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-sm font-semibold text-slate-700 mb-2">Incidents by day</h2>
                <div className="flex items-end gap-2 h-28">
                  {report.byDay.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <div className="w-full flex items-end justify-center gap-0.5 flex-1">
                        <div
                          className="w-2.5 rounded-t bg-blue-200"
                          title={`${d.detections} AI detections`}
                          style={{ height: `${(d.detections / maxDay) * 100}%` }}
                        />
                        <div
                          className="w-2.5 rounded-t bg-navy-700"
                          title={`${d.confirmed} verified`}
                          style={{ height: `${(d.confirmed / maxDay) * 100}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400">{d.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 text-[11px] text-slate-500 mt-1">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-200" /> AI detections</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-navy-700" /> Verified</span>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Verified incidents by time of day (Dhaka)</h2>
              <div className="flex items-end gap-[3px] h-16">
                {report.timeOfDay.hourly.map((v, h) => (
                  <div
                    key={h}
                    title={`${h}:00 — ${v} verified`}
                    className={`flex-1 rounded-t ${inPeak(h) ? "bg-red-600" : "bg-slate-400"}`}
                    style={{ height: v > 0 ? `${Math.max(6, (v / maxHour) * 100)}%` : "0%" }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {peak
                  ? `Busiest stretch: ${report.timeOfDay.peakLabel} — ${peak.incidents} of ${report.timeOfDay.total} verified incidents (${Math.round(peak.share * 100)}%).`
                  : report.timeOfDay.total < report.timeOfDay.minRequired
                  ? `Not enough verified incidents (${report.timeOfDay.total}; at least ${report.timeOfDay.minRequired} needed) to identify a time-of-day pattern.`
                  : "No clear time-of-day pattern: incidents are spread across the day."}
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Areas with the most verified incidents</h2>
              {report.topAreas.length === 0 ? (
                <p className="text-sm text-slate-400">No verified incidents in this period.</p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                      <tr>
                        <th className="text-left px-3 py-2">Area</th>
                        <th className="text-left px-3 py-2">Types</th>
                        <th className="text-right px-3 py-2">Verified</th>
                        <th className="text-right px-3 py-2">Serious</th>
                        <th className="text-left px-3 py-2">Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.topAreas.map((a) => (
                        <tr key={a.name + a.incidents}>
                          <td className="px-3 py-2 font-medium text-navy-900">{a.name}</td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{a.types.map((t) => `${t.label} ×${t.count}`).join(", ")}</td>
                          <td className="px-3 py-2 text-right font-semibold">{a.incidents}</td>
                          <td className="px-3 py-2 text-right">{a.serious}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                a.riskLevel === "high"
                                  ? "bg-red-100 text-red-700"
                                  : a.riskLevel === "medium"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {a.riskLevel.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* ---------- Custom export ---------- */}
      <section className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700">Export incidents (CSV)</h2>
        <p className="text-xs text-slate-400 mb-3">
          Opens in Excel or Google Sheets. Includes locations, review and response times. Dates are Dhaka calendar days, inclusive.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-500">
            From
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-800" />
          </label>
          <label className="text-xs text-slate-500">
            To
            <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="mt-1 block border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-800" />
          </label>
          <label className="text-xs text-slate-500">
            Status
            <select value={statusGroup} onChange={(e) => setStatusGroup(e.target.value)} className="mt-1 block border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-800 bg-white">
              {STATUS_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Type
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 block border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-800 bg-white">
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <button
            onClick={exportCustom}
            disabled={busy !== null || !from || !to}
            className="px-3 py-2 text-sm font-semibold rounded-md bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {busy === "custom" ? "Preparing…" : "Export CSV"}
          </button>
        </div>
      </section>

      <p className="text-xs text-slate-400">
        Prototype figures — AI-assisted detection with human verification. Not an official statistic, and no claim that incidents
        are prevented.
      </p>
    </div>
  );
}
