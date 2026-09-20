import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { Incident, IncidentEvent, Response, ResponseTeam, AnalyticsSnapshot } from "../models";

/**
 * Wipes all incident/response activity while leaving cameras, response team
 * rosters, locations, and users intact — for resetting to a "clean" dashboard
 * (only genuinely triggered incidents going forward) without re-running the
 * full seed script.
 */
async function clearIncidents() {
  await connectDB();

  const [incidents, events, responses, snapshots] = await Promise.all([
    Incident.deleteMany({}),
    IncidentEvent.deleteMany({}),
    Response.deleteMany({}),
    AnalyticsSnapshot.deleteMany({}),
  ]);

  const teams = await ResponseTeam.updateMany({}, { status: "available" });

  console.log(
    `[clear-incidents] removed ${incidents.deletedCount} incidents, ${events.deletedCount} events, ` +
      `${responses.deletedCount} responses, ${snapshots.deletedCount} analytics snapshots. ` +
      `Reset ${teams.modifiedCount} response teams to available.`
  );

  await mongoose.disconnect();
}

clearIncidents().catch((err) => {
  console.error("[clear-incidents] failed", err);
  process.exit(1);
});
