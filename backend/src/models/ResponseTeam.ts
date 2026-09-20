import { Schema, model, Document } from "mongoose";
import { ResponseAuthority } from "../types";

export interface IResponseTeam extends Document {
  teamId: string;
  name: string;
  authority: ResponseAuthority;
  status: "available" | "dispatched" | "off_duty";
  baseLocation: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
  updatedAt: Date;
}

const ResponseTeamSchema = new Schema<IResponseTeam>(
  {
    teamId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    authority: { type: String, enum: ["police", "fire_service", "ambulance", "traffic_police"], required: true },
    status: { type: String, enum: ["available", "dispatched", "off_duty"], default: "available" },
    baseLocation: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { timestamps: true }
);

export const ResponseTeam = model<IResponseTeam>("ResponseTeam", ResponseTeamSchema);
