import { Schema, model, Document } from "mongoose";
import { CameraStatus, IncidentType, Severity } from "../types";

export interface ICamera extends Document {
  cameraId: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  status: CameraStatus;
  aiMonitoring: boolean;
  detectionIntervalMs: number;
  lastSeen: Date | null;
  lastFrameUrl: string | null;
  source: "mobile" | "rtsp" | "simulated";
  // Most recent AI classification for this camera, updated on EVERY analyzed
  // frame — including "normal" ones that never become an Incident — so the
  // dashboard can show what the AI is currently seeing, not just confirmed
  // incidents.
  lastDetectionType: IncidentType | null;
  lastDetectionConfidence: number | null;
  lastDetectionSeverity: Severity | null;
  lastDetectionDescription: string | null;
  lastDetectionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CameraSchema = new Schema<ICamera>(
  {
    cameraId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    location: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    status: { type: String, enum: ["online", "offline"], default: "offline" },
    aiMonitoring: { type: Boolean, default: true },
    detectionIntervalMs: { type: Number, default: 1000 },
    lastSeen: { type: Date, default: null },
    lastFrameUrl: { type: String, default: null },
    source: { type: String, enum: ["mobile", "rtsp", "simulated"], default: "mobile" },
    lastDetectionType: {
      type: String,
      enum: ["physical_altercation", "road_accident", "fire_smoke", "person_fall", "normal", null],
      default: null,
    },
    lastDetectionConfidence: { type: Number, default: null },
    lastDetectionSeverity: { type: String, enum: ["low", "medium", "high", "critical", null], default: null },
    lastDetectionDescription: { type: String, default: null },
    lastDetectionAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Camera = model<ICamera>("Camera", CameraSchema);
