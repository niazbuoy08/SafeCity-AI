import { Incident } from "../models";
import { IncidentType, Severity } from "../types";
import { dhakaHour } from "../utils/dhakaTime";

/**
 * Public-facing danger-zone data for the mobile app's Danger Map.
 *
 * Deliberately conservative about what it exposes:
 *  - Only operator-VERIFIED incidents count (verified/dispatched/responding/
 *    resolved). Unreviewed AI detections and false alarms never appear —
 *    "AI detects, humans verify" applies to what the public sees too.
 *  - Output contains no incident IDs, camera IDs, evidence frames, or
 *    operator names — only where, what kind, how severe, and when.
 */

const PUBLIC_STATUSES = ["verified", "dispatched", "responding", "resolved"];

export const PUBLIC_INCIDENT_TYPES: IncidentType[] = [
  "physical_altercation",
  "road_accident",
  "fire_smoke",
  "person_fall",
];

const SEVERITY_WEIGHT: Record<Severity, number> = {
  low: 0.2,
  medium: 0.45,
  high: 0.7,
  critical: 1.0,
};

// Incidents within this distance of a zone's centre belong to that zone.
const ZONE_RADIUS_M = 750;

// A time-of-day pattern is only claimed with enough data behind it.
export const MIN_INCIDENTS_FOR_PATTERN = 5;
const PEAK_WINDOW_HOURS = 4;
const PEAK_MIN_SHARE = 0.3; // a 4h window is 1/6 of the day; 30% is ~2x what chance gives

export interface PublicIncident {
  type: IncidentType;
  severity: Severity;
  location: string;
  latitude: number;
  longitude: number;
  detectedAt: Date;
}

export interface DangerZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  incidentCount: number;
  seriousCount: number; // high + critical
  riskLevel: "low" | "medium" | "high";
  types: { type: IncidentType; count: number }[];
  lastIncidentAt: string;
}

export interface HeatPoint {
  latitude: number;
  longitude: number;
  weight: number;
}

export interface HourWindow {
  from: number; // inclusive, 0-23 (Dhaka time)
  to: number; // exclusive, 0-23; may be < from to wrap past midnight
}

export interface PeakWindow {
  startHour: number;
  endHour: number; // exclusive
  incidents: number;
  share: number; // 0-1 of the incidents that had a time-of-day pattern basis
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** Equirectangular distance in metres — accurate enough at city scale. */
function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dy = (aLat - bLat) * 110540;
  const dx = (aLng - bLng) * 111320 * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  return Math.sqrt(dx * dx + dy * dy);
}

interface Cluster {
  latSum: number;
  lngSum: number;
  members: PublicIncident[];
}

/** Pure function (no DB) so the grouping logic can be tested in isolation. */
export function buildDangerZones(incidents: PublicIncident[]) {
  const heatPoints: HeatPoint[] = incidents.map((i) => ({
    latitude: round4(i.latitude),
    longitude: round4(i.longitude),
    weight: SEVERITY_WEIGHT[i.severity],
  }));

  // Cluster by proximity rather than a fixed grid: a grid puts a cell edge
  // through some neighbourhood and splits nearby incidents into two zones.
  const clusters: Cluster[] = [];
  for (const inc of incidents) {
    let home: Cluster | undefined;
    let best = ZONE_RADIUS_M;
    for (const c of clusters) {
      const d = distanceM(inc.latitude, inc.longitude, c.latSum / c.members.length, c.lngSum / c.members.length);
      if (d <= best) {
        best = d;
        home = c;
      }
    }
    if (!home) {
      home = { latSum: 0, lngSum: 0, members: [] };
      clusters.push(home);
    }
    home.members.push(inc);
    home.latSum += inc.latitude;
    home.lngSum += inc.longitude;
  }

  const zones: DangerZone[] = [];
  for (const { members: bucket } of clusters) {
    const nameCounts = new Map<string, number>();
    const typeCounts = new Map<IncidentType, number>();
    let latSum = 0;
    let lngSum = 0;
    let serious = 0;
    let last = bucket[0].detectedAt;

    for (const inc of bucket) {
      nameCounts.set(inc.location, (nameCounts.get(inc.location) ?? 0) + 1);
      typeCounts.set(inc.type, (typeCounts.get(inc.type) ?? 0) + 1);
      latSum += inc.latitude;
      lngSum += inc.longitude;
      if (inc.severity === "high" || inc.severity === "critical") serious++;
      if (inc.detectedAt > last) last = inc.detectedAt;
    }

    // Label the zone with its most common location string.
    const name = [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const count = bucket.length;

    const latitude = round4(latSum / count);
    const longitude = round4(lngSum / count);

    zones.push({
      id: `${latitude}:${longitude}`,
      name,
      latitude,
      longitude,
      incidentCount: count,
      seriousCount: serious,
      riskLevel: count >= 5 ? "high" : count >= 2 ? "medium" : "low",
      types: [...typeCounts.entries()]
        .map(([type, c]) => ({ type, count: c }))
        .sort((a, b) => b.count - a.count),
      lastIncidentAt: last.toISOString(),
    });
  }

  zones.sort((a, b) => b.incidentCount - a.incidentCount || b.seriousCount - a.seriousCount);
  return { zones, heatPoints };
}

/** Number of incidents in each Dhaka hour of the day (index 0-23). */
export function hourlyHistogram(incidents: { detectedAt: Date }[]): number[] {
  const hourly = new Array<number>(24).fill(0);
  for (const inc of incidents) hourly[dhakaHour(inc.detectedAt)]++;
  return hourly;
}

/** Is `hour` inside [from, to), wrapping past midnight when to <= from? */
export function hourInWindow(hour: number, w: HourWindow): boolean {
  if (w.from === w.to) return true; // whole day
  return w.from < w.to ? hour >= w.from && hour < w.to : hour >= w.from || hour < w.to;
}

/**
 * Busiest 4-hour stretch (wrapping past midnight). Returns null unless there
 * are enough incidents to say anything AND the busiest stretch holds clearly
 * more than an even spread would — we never invent a pattern from thin data.
 */
export function findPeakWindow(
  hourly: number[],
  size = PEAK_WINDOW_HOURS,
  minTotal = MIN_INCIDENTS_FOR_PATTERN,
  minShare = PEAK_MIN_SHARE
): PeakWindow | null {
  const total = hourly.reduce((a, b) => a + b, 0);
  if (total < minTotal) return null;

  let bestStart = 0;
  let bestSum = -1;
  let bestScore = -1;
  for (let s = 0; s < 24; s++) {
    let sum = 0;
    for (let k = 0; k < size; k++) sum += hourly[(s + k) % 24];
    // Tie-break toward windows whose middle hours hold the incidents, so a
    // cluster at 7 PM is reported as an evening window rather than an
    // arbitrary one that merely touches it at the edge.
    const middle = hourly[(s + 1) % 24] + hourly[(s + 2) % 24];
    const score = sum * 1000 + middle;
    if (score > bestScore) {
      bestScore = score;
      bestSum = sum;
      bestStart = s;
    }
  }

  const share = bestSum / total;
  if (share < minShare) return null;
  return {
    startHour: bestStart,
    endHour: (bestStart + size) % 24,
    incidents: bestSum,
    share: Math.round(share * 100) / 100,
  };
}

/** Parse "18-22" (Dhaka hours, wraps past midnight). Returns null if absent/invalid. */
export function parseHourWindow(raw: unknown): HourWindow | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(raw.trim());
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (from > 23 || to > 24) return null;
  const end = to % 24;
  return from === end ? null : { from, to: end };
}

/** Parse "fire_smoke,road_accident" into valid public incident types. */
export function parseTypes(raw: unknown): IncidentType[] {
  if (typeof raw !== "string") return [];
  const wanted = raw.split(",").map((s) => s.trim());
  return PUBLIC_INCIDENT_TYPES.filter((t) => wanted.includes(t));
}

export interface DangerZoneQuery {
  days: number;
  types?: IncidentType[];
  hours?: HourWindow | null;
}

export async function getDangerZones(query: DangerZoneQuery) {
  const { days, types = [], hours = null } = query;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const incidents = await Incident.find({
    status: { $in: PUBLIC_STATUSES },
    type: types.length ? { $in: types } : { $ne: "normal" },
    detectedAt: { $gte: since },
  })
    .select("type severity location latitude longitude detectedAt")
    .lean<PublicIncident[]>();

  // The time-of-day picture is built from everything matching days + type, so
  // picking "Evening" doesn't hide when the other hours are busy.
  const hourly = hourlyHistogram(incidents);
  const inWindow = hours ? incidents.filter((i) => hourInWindow(dhakaHour(i.detectedAt), hours)) : incidents;

  const { zones, heatPoints } = buildDangerZones(inWindow);

  return {
    generatedAt: new Date().toISOString(),
    days,
    filters: { types, hours },
    totalIncidents: inWindow.length,
    zones,
    heatPoints,
    timeOfDay: {
      hourly,
      total: incidents.length,
      minRequired: MIN_INCIDENTS_FOR_PATTERN,
      peak: findPeakWindow(hourly),
    },
  };
}
