import { CameraConfig } from "./config";

export interface FramePayload {
  imageBase64: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  location: string;
  frameId: string;
}

export interface DetectionResult {
  incident_type: string;
  confidence: number;
  severity: string;
  description: string;
  detected_objects: string[];
}

export interface FrameResponse {
  received: boolean;
  frameUrl: string;
  detection: DetectionResult | null;
  incident: any;
  isNewIncident: boolean;
}

async function request<T>(url: string, options: RequestInit, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function registerCamera(config: CameraConfig): Promise<void> {
  await request(`${config.backendUrl}/api/cameras`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cameraId: config.cameraId,
      name: config.name,
      location: config.location,
      latitude: config.latitude,
      longitude: config.longitude,
      detectionIntervalMs: config.detectionIntervalMs,
      source: "mobile",
    }),
  });
}

export async function sendFrame(config: CameraConfig, payload: FramePayload): Promise<FrameResponse> {
  return request<FrameResponse>(`${config.backendUrl}/api/cameras/${config.cameraId}/frame`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function checkHealth(backendUrl: string): Promise<boolean> {
  try {
    await request(`${backendUrl}/api/health`, { method: "GET" }, 4000);
    return true;
  } catch {
    return false;
  }
}

// ---- Public Danger Map (operator-verified incidents only) -------------------

export type RiskLevel = "low" | "medium" | "high";

export interface DangerZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  incidentCount: number;
  seriousCount: number;
  riskLevel: RiskLevel;
  types: { type: string; count: number }[];
  lastIncidentAt: string;
}

export interface HeatPoint {
  latitude: number;
  longitude: number;
  weight: number;
}

export interface PeakWindow {
  startHour: number;
  endHour: number; // exclusive
  incidents: number;
  share: number; // 0-1
}

export interface TimeOfDay {
  hourly: number[]; // incidents per Dhaka hour, index 0-23
  total: number;
  minRequired: number; // below this many incidents no pattern is claimed
  peak: PeakWindow | null;
}

export interface DangerZonesResponse {
  generatedAt: string;
  days: number;
  filters: { types: string[]; hours: { from: number; to: number } | null };
  totalIncidents: number;
  zones: DangerZone[];
  heatPoints: HeatPoint[];
  timeOfDay: TimeOfDay;
}

export interface DangerQuery {
  days: number;
  types: string[]; // empty = all types
  hours: string | null; // Dhaka-time window "from-to", e.g. "17-22"; null = any time
}

export async function fetchDangerZones(backendUrl: string, q: DangerQuery): Promise<DangerZonesResponse> {
  const params = [`days=${q.days}`];
  if (q.types.length) params.push(`types=${encodeURIComponent(q.types.join(","))}`);
  if (q.hours) params.push(`hours=${encodeURIComponent(q.hours)}`);
  return request<DangerZonesResponse>(`${backendUrl}/api/public/danger-zones?${params.join("&")}`, { method: "GET" }, 12000);
}
