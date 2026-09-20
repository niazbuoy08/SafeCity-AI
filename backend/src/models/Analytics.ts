import { Schema, model, Document } from "mongoose";

/**
 * Lightweight event log used to power analytics aggregations
 * (incidents by hour/day/type/location, verification & response timings).
 * Most analytics endpoints aggregate directly from Incident/Response,
 * this collection additionally records point-in-time snapshots for trend charts.
 */
export interface IAnalyticsSnapshot extends Document {
  date: string; // YYYY-MM-DD
  totalIncidents: number;
  verifiedIncidents: number;
  falseAlarms: number;
  byType: Record<string, number>;
  createdAt: Date;
}

const AnalyticsSnapshotSchema = new Schema<IAnalyticsSnapshot>(
  {
    date: { type: String, required: true, unique: true },
    totalIncidents: { type: Number, default: 0 },
    verifiedIncidents: { type: Number, default: 0 },
    falseAlarms: { type: Number, default: 0 },
    byType: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AnalyticsSnapshot = model<IAnalyticsSnapshot>("AnalyticsSnapshot", AnalyticsSnapshotSchema);
