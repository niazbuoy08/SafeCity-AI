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

export type ResponseAuthority = "police" | "fire_service" | "ambulance" | "traffic_police";

export type CameraStatus = "online" | "offline";

export type UserRole = "admin" | "operator";

export interface DetectionResult {
  incident_type: IncidentType;
  confidence: number; // 0-1
  severity: Severity;
  description: string;
  detected_objects: string[];
  timestamp: string;
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
