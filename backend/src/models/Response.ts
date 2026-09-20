import { Schema, model, Document } from "mongoose";
import { ResponseAuthority, Severity } from "../types";

export interface IResponse extends Document {
  responseId: string;
  incidentId: string;
  teamId: string;
  authority: ResponseAuthority;
  status: "dispatched" | "responding" | "resolved";
  priority: Severity;
  dispatchedAt: Date;
  arrivedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ResponseSchema = new Schema<IResponse>(
  {
    responseId: { type: String, required: true, unique: true },
    incidentId: { type: String, required: true, index: true },
    teamId: { type: String, required: true },
    authority: { type: String, enum: ["police", "fire_service", "ambulance", "traffic_police"], required: true },
    status: { type: String, enum: ["dispatched", "responding", "resolved"], default: "dispatched" },
    priority: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
    dispatchedAt: { type: Date, required: true },
    arrivedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Response = model<IResponse>("Response", ResponseSchema);
