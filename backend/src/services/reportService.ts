import { Incident, Response } from "../models";
import { IncidentType, Severity } from "../types";
import {
  buildDangerZones,
  findPeakWindow,
  hourlyHistogram,
  MIN_INCIDENTS_FOR_PATTERN,
  PeakWindow,
} from "./dangerZoneService";
import {
  DAY_MS,
  addDaysToKey,
  dayLabel,
  dhakaDateKey,
  formatDhakaDate,
  formatDuration,
  formatHourRange,
  startOfDhakaDay,
} from "../utils/dhakaTime";

/**
 * Weekly summary for authorities.
 *
 * Counting rules (stated in the PDF footer too):
 *  - "Detections" = everything the AI flagged in the period.
 *  - "Verified"   = a human operator confirmed it (verified/dispatched/
 *                   responding/resolved). All type/area/time statistics are
 *                   computed from verified incidents only.
 *  - False alarms are counted, never analysed as incidents.
 *  - Time-of-day patterns are only claimed with enough data behind them.
 */

export const CONFIRMED_STATUSES = ["verified", "dispatched", "responding", "resolved"];
export const REPORT_DAYS = 7;

export const TYPE_LABELS: Record<string, string> = {
  physical_altercation: "Physical altercation",
  road_accident: "Road accident",
  fire_smoke: "Fire / smoke",
  person_fall: "Person fall",
  normal: "Normal activity",
};

export const AUTHORITY_LABELS: Record<string, string> = {
  police: "Police",
  fire_service: "Fire Service",
  ambulance: "Ambulance",
  traffic_police: "Traffic Police",
};

export const STATUS_LABELS: Record<string, string> = {
  detected: "Detected",
  under_review: "Under review",
  verified: "Verified",
  false_alarm: "False alarm",
  dispatched: "Dispatched",
  responding: "Responding",
  resolved: "Resolved",
};

export interface ReportIncident {
  incidentId: string;
  cameraId: string;
  type: IncidentType;
  severity: Severity;
  confidence: number;
  status: string;
  location: string;
  latitude: number;
  longitude: number;
  detectedAt: Date;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  falseAlarmReason: string | null;
  assignedAuthority: string | null;
  responseId: string | null;
  resolvedAt: Date | null;
}

export interface ReportResponse {
  responseId: string;
  incidentId: string;
  authority: string;
  status: string;
  dispatchedAt: Date;
  arrivedAt: Date | null;
  resolvedAt: Date | null;
}

export interface Period {
  startKey: string;
  endKey: string; // inclusive
  start: Date;
  endExclusive: Date;
  label: string;
  days: number;
}

export interface PeriodStats {
  detections: number;
  confirmed: number;
  falseAlarms: number;
  pending: number;
  criticalConfirmed: number;
  resolved: number;
  falseAlarmRatePct: number | null; // of reviewed (confirmed + false alarms)
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function resolvePeriod(endKey: string, days = REPORT_DAYS): Period {
  const startKey = addDaysToKey(endKey, -(days - 1));
  const start = startOfDhakaDay(startKey);
  const endExclusive = new Date(startOfDhakaDay(endKey).getTime() + DAY_MS);
  const a = formatDhakaDate(startKey);
  const b = formatDhakaDate(endKey);
  const label = a.slice(-4) === b.slice(-4) ? `${a.slice(0, -5)} – ${b}` : `${a} – ${b}`;
  return { startKey, endKey, start, endExclusive, label, days };
}

export function statsFor(incidents: ReportIncident[]): PeriodStats {
  const confirmed = incidents.filter((i) => CONFIRMED_STATUSES.includes(i.status));
  const falseAlarms = incidents.filter((i) => i.status === "false_alarm").length;
  return {
    detections: incidents.length,
    confirmed: confirmed.length,
    falseAlarms,
    pending: incidents.filter((i) => i.status === "detected" || i.status === "under_review").length,
    criticalConfirmed: confirmed.filter((i) => i.severity === "critical").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
    falseAlarmRatePct: confirmed.length + falseAlarms > 0 ? pct(falseAlarms, confirmed.length + falseAlarms) : null,
  };
}

function countBy<T>(items: T[], key: (t: T) => string): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count);
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function buildReport(
  period: Period,
  previousPeriod: Period,
  incidents: ReportIncident[],
  responses: ReportResponse[],
  previousIncidents: ReportIncident[],
  generatedAt = new Date()
) {
  const confirmed = incidents.filter((i) => CONFIRMED_STATUSES.includes(i.status));
  const totals = statsFor(incidents);
  const previous = statsFor(previousIncidents);

  const byType = countBy(confirmed, (i) => i.type).map((r) => ({
    type: r.key as IncidentType,
    label: TYPE_LABELS[r.key] ?? r.key,
    count: r.count,
  }));
  const bySeverity = countBy(confirmed, (i) => i.severity).map((r) => ({ severity: r.key as Severity, count: r.count }));

  // Day-by-day, always all 7 days so quiet days show as zero
  const byDay = Array.from({ length: period.days }, (_, i) => {
    const date = addDaysToKey(period.startKey, i);
    const dayIncidents = incidents.filter((inc) => dhakaDateKey(inc.detectedAt) === date);
    return {
      date,
      label: dayLabel(date),
      detections: dayIncidents.length,
      confirmed: dayIncidents.filter((inc) => CONFIRMED_STATUSES.includes(inc.status)).length,
    };
  });

  const hourly = hourlyHistogram(confirmed);
  const peak: PeakWindow | null = findPeakWindow(hourly);

  const zones = buildDangerZones(
    confirmed.map((i) => ({
      type: i.type,
      severity: i.severity,
      location: i.location,
      latitude: i.latitude,
      longitude: i.longitude,
      detectedAt: i.detectedAt,
    }))
  ).zones;
  const topAreas = zones.slice(0, 8).map((z) => ({
    name: z.name,
    incidents: z.incidentCount,
    serious: z.seriousCount,
    riskLevel: z.riskLevel,
    types: z.types.map((t) => ({ type: t.type, label: TYPE_LABELS[t.type] ?? t.type, count: t.count })),
  }));

  // Timings — each carries its sample size so readers can judge reliability
  const reviewSecs = incidents
    .filter((i) => i.verifiedAt)
    .map((i) => (i.verifiedAt!.getTime() - i.detectedAt.getTime()) / 1000);
  const responseSecs = responses.filter((r) => r.arrivedAt).map((r) => (r.arrivedAt!.getTime() - r.dispatchedAt.getTime()) / 1000);
  const resolveSecs = incidents
    .filter((i) => i.status === "resolved" && i.resolvedAt)
    .map((i) => (i.resolvedAt!.getTime() - i.detectedAt.getTime()) / 1000);
  const timings = {
    avgReviewSec: mean(reviewSecs),
    reviewN: reviewSecs.length,
    avgResponseSec: mean(responseSecs),
    responseN: responseSecs.length,
    avgResolveSec: mean(resolveSecs),
    resolveN: resolveSecs.length,
  };

  const byAuthority = countBy(responses, (r) => r.authority).map((r) => ({
    authority: r.key,
    label: AUTHORITY_LABELS[r.key] ?? r.key,
    count: r.count,
  }));

  // ---- Key observations: only statements the data actually supports ----
  const highlights: string[] = [];
  if (totals.detections === 0) {
    highlights.push("No incidents were detected in this period.");
  } else {
    let line = `${plural(totals.confirmed, "incident")} verified by operators out of ${plural(totals.detections, "AI detection")}`;
    line += totals.falseAlarms > 0
      ? `; ${totals.falseAlarms} marked false alarm (${totals.falseAlarmRatePct}% of reviewed).`
      : ".";
    highlights.push(line);

    if (totals.pending > 0) {
      highlights.push(`${plural(totals.pending, "detection")} still awaiting operator review at the end of the period.`);
    }

    if (previous.detections > 0 || previous.confirmed > 0) {
      const diff = totals.confirmed - previous.confirmed;
      highlights.push(
        diff === 0
          ? `Verified incidents are unchanged from the previous 7 days (${previous.confirmed}).`
          : `Verified incidents ${diff > 0 ? "rose" : "fell"} by ${Math.abs(diff)} compared with the previous 7 days (from ${previous.confirmed} to ${totals.confirmed}).`
      );
    }
  }

  if (confirmed.length > 0) {
    const top = byType[0];
    highlights.push(`Most common verified type: ${top.label} (${top.count} of ${confirmed.length}, ${pct(top.count, confirmed.length)}%).`);
    if (topAreas.length > 0) {
      const a = topAreas[0];
      highlights.push(`Highest-volume area: ${a.name} (${plural(a.incidents, "verified incident")}).`);
    }
    if (peak) {
      highlights.push(
        `Verified incidents cluster between ${formatHourRange(peak.startHour, peak.endHour)} (${Math.round(peak.share * 100)}% of the week's incidents) — a possible window for extra patrols.`
      );
    } else if (confirmed.length < MIN_INCIDENTS_FOR_PATTERN) {
      highlights.push(
        `Only ${plural(confirmed.length, "verified incident")} this period — too few to identify a time-of-day pattern (at least ${MIN_INCIDENTS_FOR_PATTERN} needed).`
      );
    } else {
      highlights.push("Verified incidents are spread across the day with no clear time-of-day pattern.");
    }
  }

  if (timings.reviewN > 0) {
    highlights.push(
      `Average time from detection to operator decision: ${formatDuration(timings.avgReviewSec)} (${plural(timings.reviewN, "incident")}).`
    );
  }
  if (timings.responseN > 0) {
    highlights.push(
      `Average time from dispatch to a team being on scene: ${formatDuration(timings.avgResponseSec)} (${plural(timings.responseN, "response")}).`
    );
  }

  return {
    period: {
      label: period.label,
      startKey: period.startKey,
      endKey: period.endKey,
      days: period.days,
    },
    previousPeriod: { label: previousPeriod.label, startKey: previousPeriod.startKey, endKey: previousPeriod.endKey },
    generatedAt: generatedAt.toISOString(),
    totals,
    previous,
    byType,
    bySeverity,
    byDay,
    timeOfDay: {
      hourly,
      total: confirmed.length,
      minRequired: MIN_INCIDENTS_FOR_PATTERN,
      peak,
      peakLabel: peak ? formatHourRange(peak.startHour, peak.endHour) : null,
    },
    topAreas,
    timings,
    responses: { total: responses.length, byAuthority },
    highlights,
    // Verified incidents, newest first — the log printed in the PDF
    incidents: [...confirmed]
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
      .map((i) => ({
        incidentId: i.incidentId,
        detectedAt: i.detectedAt.toISOString(),
        type: i.type,
        typeLabel: TYPE_LABELS[i.type] ?? i.type,
        severity: i.severity,
        location: i.location,
        status: i.status,
        statusLabel: STATUS_LABELS[i.status] ?? i.status,
        verifiedBy: i.verifiedBy,
        authority: i.assignedAuthority ? AUTHORITY_LABELS[i.assignedAuthority] ?? i.assignedAuthority : null,
      })),
  };
}

export type WeeklyReport = ReturnType<typeof buildReport>;

const INCIDENT_FIELDS =
  "incidentId cameraId type severity confidence status location latitude longitude detectedAt verifiedBy verifiedAt falseAlarmReason assignedAuthority responseId resolvedAt";

export async function fetchIncidents(start: Date, endExclusive: Date, statuses?: string[], types?: string[]) {
  const filter: Record<string, unknown> = { detectedAt: { $gte: start, $lt: endExclusive } };
  if (statuses?.length) filter.status = { $in: statuses };
  if (types?.length) filter.type = { $in: types };
  return Incident.find(filter).select(INCIDENT_FIELDS).sort({ detectedAt: -1 }).limit(20000).lean<ReportIncident[]>();
}

export async function fetchResponsesFor(incidentIds: string[]) {
  if (incidentIds.length === 0) return [] as ReportResponse[];
  return Response.find({ incidentId: { $in: incidentIds } })
    .select("responseId incidentId authority status dispatchedAt arrivedAt resolvedAt")
    .lean<ReportResponse[]>();
}

export async function buildWeeklyReport(endKey: string): Promise<WeeklyReport> {
  const period = resolvePeriod(endKey);
  const previousPeriod = resolvePeriod(addDaysToKey(period.startKey, -1));

  const [incidents, previousIncidents] = await Promise.all([
    fetchIncidents(period.start, period.endExclusive),
    fetchIncidents(previousPeriod.start, previousPeriod.endExclusive),
  ]);
  const responses = await fetchResponsesFor(incidents.map((i) => i.incidentId));

  return buildReport(period, previousPeriod, incidents, responses, previousIncidents);
}
