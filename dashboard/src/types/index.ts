export type IncidentType = "physical_altercation" | "road_accident" | "fire_smoke" | "person_fall" | "normal";

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

export interface Camera {
  _id: string;
  cameraId: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  status: CameraStatus;
  aiMonitoring: boolean;
  detectionIntervalMs: number;
  lastSeen: string | null;
  lastFrameUrl: string | null;
  source: string;
  lastDetectionType: IncidentType | null;
  lastDetectionConfidence: number | null;
  lastDetectionSeverity: Severity | null;
  lastDetectionDescription: string | null;
  lastDetectionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Incident {
  _id: string;
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
  detectedObjects: string[];
  verifiedBy: string | null;
  verifiedAt: string | null;
  falseAlarmReason: string | null;
  assignedAuthority: ResponseAuthority | null;
  responseId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentEvent {
  _id: string;
  incidentId: string;
  cameraId: string;
  type: IncidentType;
  confidence: number;
  severity: Severity;
  frameUrl: string | null;
  detectedObjects: string[];
  detectedAt: string;
}

export interface ResponseTeam {
  _id: string;
  teamId: string;
  name: string;
  authority: ResponseAuthority;
  status: "available" | "dispatched" | "off_duty";
  baseLocation: string;
  latitude: number;
  longitude: number;
}

export interface ResponseRecord {
  _id: string;
  responseId: string;
  incidentId: string;
  teamId: string;
  authority: ResponseAuthority;
  status: "dispatched" | "responding" | "resolved";
  priority: Severity;
  dispatchedAt: string;
  arrivedAt: string | null;
  resolvedAt: string | null;
  teamName?: string;
}

export interface AnalyticsSummary {
  totalCameras: number;
  camerasOnline: number;
  incidentsToday: number;
  incidentsAwaitingVerification: number;
  verifiedIncidents: number;
  activeResponses: number;
  criticalIncidents: number;
  allIncidentsCount: number;
}

export interface Hotspot {
  location: string;
  latitude: number;
  longitude: number;
  incidentCount: number;
  criticalCount: number;
  types: string[];
  riskLevel: "low" | "medium" | "high";
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export const INCIDENT_LABELS: Record<IncidentType, string> = {
  physical_altercation: "Physical Altercation",
  road_accident: "Road Accident",
  fire_smoke: "Fire / Smoke",
  person_fall: "Person Fall",
  normal: "Normal Activity",
};

export const AUTHORITY_LABELS: Record<ResponseAuthority, string> = {
  police: "Police",
  fire_service: "Fire Service",
  ambulance: "Ambulance",
  traffic_police: "Traffic Police",
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  detected: "Detected",
  under_review: "Under Review",
  verified: "Verified",
  false_alarm: "False Alarm",
  dispatched: "Dispatched",
  responding: "Responding",
  resolved: "Resolved",
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

// ---- Reports (weekly summary for authorities) ----

export interface PeriodStats {
  detections: number;
  confirmed: number;
  falseAlarms: number;
  pending: number;
  criticalConfirmed: number;
  resolved: number;
  falseAlarmRatePct: number | null;
}

export interface WeeklyReport {
  period: { label: string; startKey: string; endKey: string; days: number };
  previousPeriod: { label: string; startKey: string; endKey: string };
  generatedAt: string;
  totals: PeriodStats;
  previous: PeriodStats;
  byType: { type: IncidentType; label: string; count: number }[];
  byDay: { date: string; label: string; detections: number; confirmed: number }[];
  timeOfDay: {
    hourly: number[];
    total: number;
    minRequired: number;
    peak: { startHour: number; endHour: number; incidents: number; share: number } | null;
    peakLabel: string | null;
  };
  topAreas: {
    name: string;
    incidents: number;
    serious: number;
    riskLevel: "low" | "medium" | "high";
    types: { type: IncidentType; label: string; count: number }[];
  }[];
  timings: {
    avgReviewSec: number | null;
    reviewN: number;
    avgResponseSec: number | null;
    responseN: number;
    avgResolveSec: number | null;
    resolveN: number;
  };
  responses: { total: number; byAuthority: { authority: string; label: string; count: number }[] };
  highlights: string[];
  incidents: { incidentId: string }[];
}
