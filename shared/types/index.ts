/**
 * SafeCity AI — Shared Type Definitions
 *
 * These types are the canonical contract between backend, dashboard, and mobile.
 * Each project keeps its own local copy (backend/src/types, dashboard/src/types)
 * since they are independent npm packages, but all three MUST stay in sync with
 * the shapes defined here.
 */

export type IncidentType =
  | "physical_altercation"
  | "road_accident"
  | "fire_smoke"
  | "person_fall"
  | "normal";

export type Severity = "low" | "medium" | "high" | "critical";

export type IncidentStatus =
  | "detected"
  | "under_review"
  | "verified"
  | "false_alarm"
  | "dispatched"
  | "responding"
  | "resolved";

export type ResponseAuthority =
  | "police"
  | "fire_service"
  | "ambulance"
  | "traffic_police";

export type CameraStatus = "online" | "offline";

export type UserRole = "admin" | "operator";

export interface GeoLocation {
  area: string;
  city: string;
  latitude: number;
  longitude: number;
}

export interface Camera {
  cameraId: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  status: CameraStatus;
  aiMonitoring: boolean;
  lastSeen: string | null;
  lastFrameUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DetectionResult {
  incident_type: IncidentType;
  confidence: number;
  severity: Severity;
  description: string;
  detected_objects: string[];
  timestamp: string;
}

export interface Incident {
  incidentId: string;
  cameraId: string;
  type: IncidentType;
  confidence: number;
  severity: Severity;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  detectedAt: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  status: IncidentStatus;
  evidenceFrames: string[];
  verifiedBy: string | null;
  verifiedAt: string | null;
  falseAlarmReason: string | null;
  assignedAuthority: ResponseAuthority | null;
  responseId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResponseTeam {
  teamId: string;
  name: string;
  authority: ResponseAuthority;
  status: "available" | "dispatched" | "off_duty";
  baseLocation: string;
  latitude: number;
  longitude: number;
}

export interface ResponseRecord {
  responseId: string;
  incidentId: string;
  teamId: string;
  authority: ResponseAuthority;
  status: "dispatched" | "responding" | "resolved";
  dispatchedAt: string;
  arrivedAt: string | null;
  resolvedAt: string | null;
  priority: Severity;
}

export const INCIDENT_TO_AUTHORITY: Record<Exclude<IncidentType, "normal">, ResponseAuthority> = {
  physical_altercation: "police",
  road_accident: "traffic_police",
  fire_smoke: "fire_service",
  person_fall: "ambulance",
};

export const SOCKET_EVENTS = {
  CAMERA_ONLINE: "camera:online",
  CAMERA_OFFLINE: "camera:offline",
  CAMERA_FRAME: "camera:frame",
  INCIDENT_DETECTED: "incident:detected",
  INCIDENT_UPDATED: "incident:updated",
  INCIDENT_VERIFIED: "incident:verified",
  INCIDENT_FALSE_ALARM: "incident:false_alarm",
  RESPONSE_CREATED: "response:created",
  RESPONSE_UPDATED: "response:updated",
  ANALYTICS_UPDATED: "analytics:updated",
} as const;
