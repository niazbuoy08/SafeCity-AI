import { Schema, model, Document } from "mongoose";
import { IncidentType, Severity, IncidentStatus, ResponseAuthority } from "../types";

export interface IIncident extends Document {
  incidentId: string;
  cameraId: string;
  type: IncidentType;
  confidence: number;
  severity: Severity;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  detectedAt: Date;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  status: IncidentStatus;
  evidenceFrames: string[];
  detectedObjects: string[];
  verifiedBy: string | null;
  verifiedAt: Date | null;
  falseAlarmReason: string | null;
  assignedAuthority: ResponseAuthority | null;
  responseId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const IncidentSchema = new Schema<IIncident>(
  {
    incidentId: { type: String, required: true, unique: true },
    cameraId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["physical_altercation", "road_accident", "fire_smoke", "person_fall", "normal"],
      required: true,
    },
    confidence: { type: Number, required: true },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
    description: { type: String, default: "" },
    location: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    detectedAt: { type: Date, required: true },
    firstDetectedAt: { type: Date, required: true },
    lastDetectedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["detected", "under_review", "verified", "false_alarm", "dispatched", "responding", "resolved"],
      default: "detected",
      index: true,
    },
    evidenceFrames: { type: [String], default: [] },
    detectedObjects: { type: [String], default: [] },
    verifiedBy: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    falseAlarmReason: { type: String, default: null },
    assignedAuthority: {
      type: String,
      enum: ["police", "fire_service", "ambulance", "traffic_police", null],
      default: null,
    },
    responseId: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Incident = model<IIncident>("Incident", IncidentSchema);
