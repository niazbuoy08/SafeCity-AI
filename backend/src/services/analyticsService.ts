import { AnalyticsSnapshot, Incident, Response } from "../models";

function todayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function recordSnapshotForIncident(incident: any) {
  const date = todayKey(new Date(incident.detectedAt));
  const update: any = {
    $inc: { totalIncidents: 1, [`byType.${incident.type}`]: 1 },
  };
  await AnalyticsSnapshot.updateOne({ date }, update, { upsert: true });
}

export async function recordVerificationOutcome(status: "verified" | "false_alarm", date: Date) {
  const key = todayKey(date);
  const field = status === "verified" ? "verifiedIncidents" : "falseAlarms";
  await AnalyticsSnapshot.updateOne({ date: key }, { $inc: { [field]: 1 } }, { upsert: true });
}

export async function getSummary() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalIncidentsToday,
    awaitingVerification,
    verifiedTotal,
    activeResponses,
    criticalIncidents,
    allIncidentsCount,
  ] = await Promise.all([
    Incident.countDocuments({ detectedAt: { $gte: startOfToday } }),
    Incident.countDocuments({ status: { $in: ["detected", "under_review"] } }),
    Incident.countDocuments({ status: { $in: ["verified", "dispatched", "responding", "resolved"] } }),
    Response.countDocuments({ status: { $in: ["dispatched", "responding"] } }),
    Incident.countDocuments({ severity: "critical", status: { $ne: "false_alarm" } }),
    Incident.countDocuments({}),
  ]);

  return {
    incidentsToday: totalIncidentsToday,
    incidentsAwaitingVerification: awaitingVerification,
    verifiedIncidents: verifiedTotal,
    activeResponses,
    criticalIncidents,
    allIncidentsCount,
  };
}

export async function getIncidentsAnalytics() {
  const byType = await Incident.aggregate([
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const byLocation = await Incident.aggregate([
    { $group: { _id: "$location", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const byHour = await Incident.aggregate([
    { $group: { _id: { $hour: "$detectedAt" }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const byDay = await Incident.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$detectedAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const verifiedVsFalse = await Incident.aggregate([
    { $match: { status: { $in: ["verified", "false_alarm", "dispatched", "responding", "resolved"] } } },
    {
      $group: {
        _id: { $cond: [{ $eq: ["$status", "false_alarm"] }, "false_alarm", "verified"] },
        count: { $sum: 1 },
      },
    },
  ]);

  const verificationTimes = await Incident.aggregate([
    { $match: { verifiedAt: { $ne: null } } },
    {
      $project: {
        seconds: { $divide: [{ $subtract: ["$verifiedAt", "$firstDetectedAt"] }, 1000] },
      },
    },
    { $group: { _id: null, avgSeconds: { $avg: "$seconds" } } },
  ]);

  const responseTimes = await Response.aggregate([
    { $match: { arrivedAt: { $ne: null } } },
    {
      $project: {
        seconds: { $divide: [{ $subtract: ["$arrivedAt", "$dispatchedAt"] }, 1000] },
      },
    },
    { $group: { _id: null, avgSeconds: { $avg: "$seconds" } } },
  ]);

  return {
    byType,
    byLocation,
    byHour,
    byDay,
    verifiedVsFalse,
    avgVerificationSeconds: verificationTimes[0]?.avgSeconds ?? null,
    avgResponseSeconds: responseTimes[0]?.avgSeconds ?? null,
  };
}

export async function getHotspots() {
  const hotspots = await Incident.aggregate([
    { $match: { status: { $ne: "false_alarm" } } },
    {
      $group: {
        _id: { location: "$location", latitude: "$latitude", longitude: "$longitude" },
        count: { $sum: 1 },
        types: { $addToSet: "$type" },
        criticalCount: {
          $sum: { $cond: [{ $in: ["$severity", ["high", "critical"]] }, 1, 0] },
        },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return hotspots.map((h) => ({
    location: h._id.location,
    latitude: h._id.latitude,
    longitude: h._id.longitude,
    incidentCount: h.count,
    criticalCount: h.criticalCount,
    types: h.types,
    riskLevel: h.count >= 5 ? "high" : h.count >= 2 ? "medium" : "low",
  }));
}
