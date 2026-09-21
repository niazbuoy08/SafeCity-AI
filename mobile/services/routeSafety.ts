/**
 * "Safer route" hint — computed entirely on the phone from the danger zones
 * already downloaded. No routing service is involved: the destination never
 * leaves the device until the user taps "Open in Maps".
 *
 * How it works:
 *  1. Take the straight line from the user to their destination.
 *  2. If it passes within EXPOSURE_RADIUS_M of a danger zone, try bending the
 *     path around the worst zone with a waypoint placed CLEARANCE_M to either
 *     side of it; keep whichever side leaves less exposure. Repeat (max 3).
 *  3. Hand origin + waypoints to a real maps app for turn-by-turn directions.
 *
 * It is a HINT, and deliberately says so: real roads don't follow straight
 * lines, so the maps app may route differently between waypoints.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RiskZone extends LatLng {
  id: string;
  name: string;
  riskLevel: "low" | "medium" | "high";
  incidentCount: number;
}

export const EXPOSURE_RADIUS_M = 500; // a path this close to a zone's centre counts as passing through it
export const CLEARANCE_M = 800; // how far from the zone centre a detour waypoint is placed
const MAX_WAYPOINTS = 3;
const MAX_DETOUR_FACTOR = 2.5; // ignore detours longer than this multiple of the direct path (+500 m)

const RISK_WEIGHT = { high: 3, medium: 2, low: 1 } as const;

type XY = [number, number];

// Planar metres relative to a reference point — accurate at city scale.
function toXY(p: LatLng, ref: LatLng): XY {
  const kx = 111320 * Math.cos((ref.latitude * Math.PI) / 180);
  return [(p.longitude - ref.longitude) * kx, (p.latitude - ref.latitude) * 110540];
}

function fromXY([x, y]: XY, ref: LatLng): LatLng {
  const kx = 111320 * Math.cos((ref.latitude * Math.PI) / 180);
  return { latitude: ref.latitude + y / 110540, longitude: ref.longitude + x / kx };
}

export function distanceM(a: LatLng, b: LatLng): number {
  const [x, y] = toXY(b, a);
  return Math.sqrt(x * x + y * y);
}

/** Closest point on segment a-b to p, in planar coordinates. */
function closestOnSegment(p: XY, a: XY, b: XY): { dist: number; t: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const cx = a[0] + t * dx;
  const cy = a[1] + t * dy;
  return { dist: Math.hypot(p[0] - cx, p[1] - cy), t };
}

function closestSegment(p: LatLng, path: LatLng[]): { index: number; dist: number } {
  const ref = path[0];
  const pp = toXY(p, ref);
  let best = { index: 0, dist: Infinity };
  for (let i = 0; i < path.length - 1; i++) {
    const { dist } = closestOnSegment(pp, toXY(path[i], ref), toXY(path[i + 1], ref));
    if (dist < best.dist) best = { index: i, dist };
  }
  return best;
}

export function distanceToPathM(p: LatLng, path: LatLng[]): number {
  return closestSegment(p, path).dist;
}

export function pathLengthM(path: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += distanceM(path[i], path[i + 1]);
  return total;
}

export interface Exposure {
  score: number; // sum of risk weights of the zones the path passes near
  zones: RiskZone[]; // those zones, riskiest first
}

export function pathExposure(path: LatLng[], zones: RiskZone[], radius = EXPOSURE_RADIUS_M): Exposure {
  const hit = zones
    .filter((z) => distanceToPathM(z, path) <= radius)
    .sort((a, b) => RISK_WEIGHT[b.riskLevel] - RISK_WEIGHT[a.riskLevel] || b.incidentCount - a.incidentCount);
  return { score: hit.reduce((sum, z) => sum + RISK_WEIGHT[z.riskLevel], 0), zones: hit };
}

/** A waypoint that pushes the path to one side of `zone`, perpendicular to segment a-b. */
function waypointBeside(zone: LatLng, a: LatLng, b: LatLng, side: 1 | -1): LatLng {
  const [dx, dy] = toXY(b, a);
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * side;
  const ny = (dx / len) * side;
  const [zx, zy] = toXY(zone, a);
  return fromXY([zx + nx * CLEARANCE_M, zy + ny * CLEARANCE_M], a);
}

export interface Detour {
  path: LatLng[]; // origin, waypoints..., destination
  via: LatLng[];
  exposure: Exposure;
  extraM: number; // added straight-line length vs the direct path
}

export function suggestDetour(origin: LatLng, destination: LatLng, zones: RiskZone[]): Detour | null {
  const direct = [origin, destination];
  const directLen = pathLengthM(direct);
  let path = direct;
  let best = pathExposure(path, zones);
  if (best.score === 0) return null;

  for (let i = 0; i < MAX_WAYPOINTS && best.score > 0; i++) {
    const target = best.zones[0];
    const seg = closestSegment(target, path).index;
    let chosen: { cand: LatLng[]; ex: Exposure; len: number } | null = null;

    for (const side of [1, -1] as const) {
      const w = waypointBeside(target, path[seg], path[seg + 1], side);
      const cand = [...path.slice(0, seg + 1), w, ...path.slice(seg + 1)];
      const ex = pathExposure(cand, zones);
      const len = pathLengthM(cand);
      if (!chosen || ex.score < chosen.ex.score || (ex.score === chosen.ex.score && len < chosen.len)) {
        chosen = { cand, ex, len };
      }
    }

    if (!chosen || chosen.ex.score >= best.score) break; // no improvement — stop rather than wander
    path = chosen.cand;
    best = chosen.ex;
  }

  if (path.length === 2) return null;
  const len = pathLengthM(path);
  if (len > directLen * MAX_DETOUR_FACTOR + 500) return null; // not a sensible detour

  return { path, via: path.slice(1, -1), exposure: best, extraM: len - directLen };
}

export type Verdict = "clear" | "detour" | "no_better";

export interface RouteAnalysis {
  directPath: LatLng[];
  directM: number;
  /** Zones the direct path passes near, excluding ones the trip starts/ends inside. */
  passesNear: RiskZone[];
  /** Zones the origin or destination itself sits inside — no detour can avoid these. */
  endpointZones: RiskZone[];
  detour: Detour | null;
  verdict: Verdict;
}

export function analyzeRoute(origin: LatLng, destination: LatLng, zones: RiskZone[]): RouteAnalysis {
  const endpointZones = zones.filter(
    (z) => distanceM(z, origin) <= EXPOSURE_RADIUS_M || distanceM(z, destination) <= EXPOSURE_RADIUS_M
  );
  const avoidable = zones.filter((z) => !endpointZones.includes(z));

  const directPath = [origin, destination];
  const passesNear = pathExposure(directPath, avoidable).zones;
  const detour = passesNear.length ? suggestDetour(origin, destination, avoidable) : null;

  return {
    directPath,
    directM: pathLengthM(directPath),
    passesNear,
    endpointZones,
    detour,
    verdict: passesNear.length === 0 ? "clear" : detour ? "detour" : "no_better",
  };
}

/** Google Maps directions link — opens the Maps app, or the browser as a fallback. No API key needed. */
export function mapsDirectionsUrl(
  origin: LatLng,
  destination: LatLng,
  via: LatLng[],
  mode: "walking" | "driving"
): string {
  const f = (p: LatLng) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
  const parts = [
    "api=1",
    `origin=${encodeURIComponent(f(origin))}`,
    `destination=${encodeURIComponent(f(destination))}`,
    `travelmode=${mode}`,
  ];
  if (via.length) parts.push(`waypoints=${encodeURIComponent(via.map(f).join("|"))}`);
  return `https://www.google.com/maps/dir/?${parts.join("&")}`;
}

export function formatDistanceM(m: number): string {
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;
}
