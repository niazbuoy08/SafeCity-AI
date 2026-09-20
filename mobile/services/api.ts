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

export async function simulateIncident(
  config: CameraConfig,
  scenario: "fight" | "accident" | "fire" | "fall"
): Promise<FrameResponse> {
  return request<FrameResponse>(`${config.backendUrl}/api/cameras/${config.cameraId}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario }),
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
