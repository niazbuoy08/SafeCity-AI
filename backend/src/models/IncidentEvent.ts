import { Schema, model, Document } from "mongoose";
import { IncidentType, Severity } from "../types";

/**
 * Raw per-frame detection events, grouped into a single Incident by incidentService.
 * Kept so the incident detail timeline can show every underlying detection.
 */
export interface IIncidentEvent extends Document {
  incidentId: string;
  cameraId: string;
  type: IncidentType;
  confidence: number;
  severity: Severity;
  frameUrl: string | null;
  detectedObjects: string[];
  detectedAt: Date;
  createdAt: Date;
}

const IncidentEventSchema = new Schema<IIncidentEvent>(
  {
    incidentId: { type: String, required: true, index: true },
    cameraId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["physical_altercation", "road_accident", "fire_smoke", "person_fall", "normal"],
      required: true,
    },
    confidence: { type: Number, required: true },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
    frameUrl: { type: String, default: null },
    detectedObjects: { type: [String], default: [] },
    detectedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const IncidentEvent = model<IIncidentEvent>("IncidentEvent", IncidentEventSchema);
