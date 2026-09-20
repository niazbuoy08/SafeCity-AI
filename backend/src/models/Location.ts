import { Schema, model, Document } from "mongoose";

export interface ILocation extends Document {
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  riskLevel: "low" | "medium" | "high";
}

const LocationSchema = new Schema<ILocation>({
  name: { type: String, required: true, unique: true },
  city: { type: String, default: "Dhaka" },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  riskLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
});

export const Location = model<ILocation>("Location", LocationSchema);
