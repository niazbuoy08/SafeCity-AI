import bcrypt from "bcryptjs";
import { connectDB } from "../config/db";
import { env } from "../config/env";
import { User, Camera, Incident, ResponseTeam, Response, Location } from "../models";
import mongoose from "mongoose";

const DHAKA_LOCATIONS = [
  { name: "Mohammadpur", latitude: 23.7644, longitude: 90.3596, riskLevel: "medium" },
  { name: "Mirpur", latitude: 23.8223, longitude: 90.3654, riskLevel: "high" },
  { name: "Dhanmondi", latitude: 23.7461, longitude: 90.3742, riskLevel: "low" },
  { name: "Uttara", latitude: 23.8759, longitude: 90.3795, riskLevel: "medium" },
  { name: "Farmgate", latitude: 23.7576, longitude: 90.3894, riskLevel: "high" },
  { name: "Gulshan", latitude: 23.7925, longitude: 90.4078, riskLevel: "low" },
] as const;

const INCIDENT_TYPES = ["physical_altercation", "road_accident", "fire_smoke", "person_fall", "normal"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES: Array<
  "detected" | "under_review" | "verified" | "false_alarm" | "dispatched" | "responding" | "resolved"
> = ["detected", "under_review", "verified", "false_alarm", "dispatched", "responding", "resolved"];

const AUTHORITY_MAP: Record<string, "police" | "fire_service" | "ambulance" | "traffic_police"> = {
  physical_altercation: "police",
  road_accident: "traffic_police",
  fire_smoke: "fire_service",
  person_fall: "ambulance",
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTimeInLastDays(days: number): Date {
  const now = Date.now();
  const past = now - Math.random() * days * 24 * 60 * 60 * 1000;
  return new Date(past);
}

async function seed() {
  await connectDB();
  console.log("[seed] connected. Clearing existing collections...");

  await Promise.all([
    User.deleteMany({}),
    Camera.deleteMany({}),
    Incident.deleteMany({}),
    ResponseTeam.deleteMany({}),
    Response.deleteMany({}),
    Location.deleteMany({}),
  ]);

  // --- Users ---
  const adminHash = await bcrypt.hash(env.seedAdminPassword, 10);
  const operatorHash = await bcrypt.hash(env.seedOperatorPassword, 10);
  await User.create([
    { name: "Admin User", email: env.seedAdminEmail, passwordHash: adminHash, role: "admin" },
    { name: "Operator User", email: env.seedOperatorEmail, passwordHash: operatorHash, role: "operator" },
  ]);
  console.log(`[seed] users created (admin: ${env.seedAdminEmail} / operator: ${env.seedOperatorEmail})`);

  // --- Locations ---
  await Location.create(DHAKA_LOCATIONS.map((l) => ({ ...l, city: "Dhaka" })));
  console.log(`[seed] ${DHAKA_LOCATIONS.length} locations created`);

  // --- Cameras (10 total, CAM 124 is the hero demo camera in Mohammadpur) ---
  const cameraDefs = [
    { cameraId: "CAM-124", name: "Camera 124", location: "Mohammadpur", source: "mobile" as const },
    { cameraId: "CAM-101", name: "Camera 101", location: "Mirpur", source: "simulated" as const },
    { cameraId: "CAM-102", name: "Camera 102", location: "Mirpur", source: "simulated" as const },
    { cameraId: "CAM-103", name: "Camera 103", location: "Dhanmondi", source: "simulated" as const },
    { cameraId: "CAM-104", name: "Camera 104", location: "Dhanmondi", source: "simulated" as const },
    { cameraId: "CAM-105", name: "Camera 105", location: "Uttara", source: "simulated" as const },
    { cameraId: "CAM-106", name: "Camera 106", location: "Uttara", source: "simulated" as const },
    { cameraId: "CAM-107", name: "Camera 107", location: "Farmgate", source: "simulated" as const },
    { cameraId: "CAM-108", name: "Camera 108", location: "Farmgate", source: "simulated" as const },
    { cameraId: "CAM-109", name: "Camera 109", location: "Gulshan", source: "simulated" as const },
  ];

  const cameras = [];
  for (const def of cameraDefs) {
    const loc = DHAKA_LOCATIONS.find((l) => l.name === def.location)!;
    const jitter = () => (Math.random() - 0.5) * 0.01;
    const camera = await Camera.create({
      cameraId: def.cameraId,
      name: def.name,
      location: def.location,
      latitude: loc.latitude + jitter(),
      longitude: loc.longitude + jitter(),
      status: def.cameraId === "CAM-124" ? "offline" : Math.random() > 0.15 ? "online" : "offline",
      aiMonitoring: true,
      detectionIntervalMs: 1000,
      source: def.source,
      lastSeen: new Date(),
    });
    cameras.push(camera);
  }
  console.log(`[seed] ${cameras.length} cameras created`);

  // --- Response teams (5) ---
  const teamDefs = [
    { teamId: "TEAM-POLICE-1", name: "Mohammadpur Police Patrol", authority: "police" as const, base: "Mohammadpur" },
    { teamId: "TEAM-FIRE-1", name: "Dhaka Fire Service Unit 3", authority: "fire_service" as const, base: "Dhanmondi" },
    { teamId: "TEAM-AMB-1", name: "Ambulance Unit Alpha", authority: "ambulance" as const, base: "Farmgate" },
    { teamId: "TEAM-TRAFFIC-1", name: "Traffic Police Mirpur", authority: "traffic_police" as const, base: "Mirpur" },
    { teamId: "TEAM-POLICE-2", name: "Uttara Police Patrol", authority: "police" as const, base: "Uttara" },
  ];
  const teams = [];
  for (const t of teamDefs) {
    const loc = DHAKA_LOCATIONS.find((l) => l.name === t.base)!;
    teams.push(
      await ResponseTeam.create({
        teamId: t.teamId,
        name: t.name,
        authority: t.authority,
        status: "available",
        baseLocation: t.base,
        latitude: loc.latitude,
        longitude: loc.longitude,
      })
    );
  }
  console.log(`[seed] ${teams.length} response teams created`);

  // --- Historical incidents (~20) ---
  let created = 0;
  for (let i = 0; i < 20; i++) {
    const type = pick(INCIDENT_TYPES);
    const loc = pick(DHAKA_LOCATIONS);
    const camera = pick(cameras.filter((c) => c.location === loc.name)) || pick(cameras);
    const detectedAt = randomTimeInLastDays(14);
    const severity = type === "normal" ? "low" : pick(SEVERITIES);
    const confidence = type === "normal" ? 30 + Math.random() * 20 : 60 + Math.random() * 39;

    let status = pick(STATUSES);
    if (type === "normal") status = "resolved";

    const incident = await Incident.create({
      incidentId: `INC-SEED-${1000 + i}`,
      cameraId: camera.cameraId,
      type,
      confidence,
      severity,
      description: descriptionFor(type),
      location: loc.name,
      latitude: loc.latitude + (Math.random() - 0.5) * 0.01,
      longitude: loc.longitude + (Math.random() - 0.5) * 0.01,
      detectedAt,
      firstDetectedAt: detectedAt,
      lastDetectedAt: detectedAt,
      status,
      evidenceFrames: [],
      detectedObjects: type === "normal" ? [] : ["person", "person"],
      verifiedBy: ["verified", "dispatched", "responding", "resolved", "false_alarm"].includes(status)
        ? "Operator User"
        : null,
      verifiedAt: ["verified", "dispatched", "responding", "resolved"].includes(status)
        ? new Date(detectedAt.getTime() + 1000 * (30 + Math.random() * 120))
        : status === "false_alarm"
        ? new Date(detectedAt.getTime() + 1000 * 60)
        : null,
      assignedAuthority:
        type !== "normal" && ["verified", "dispatched", "responding", "resolved"].includes(status)
          ? AUTHORITY_MAP[type]
          : null,
      falseAlarmReason: status === "false_alarm" ? "Reviewed footage — no real threat present" : null,
      resolvedAt: status === "resolved" ? new Date(detectedAt.getTime() + 1000 * 60 * 20) : null,
    });

    if (["dispatched", "responding", "resolved"].includes(status) && type !== "normal") {
      const team = teams.find((t) => t.authority === AUTHORITY_MAP[type]) || pick(teams);
      const dispatchedAt = new Date(incident.verifiedAt!.getTime() + 1000 * 30);
      const response = await Response.create({
        responseId: `RSP-SEED-${1000 + i}`,
        incidentId: incident.incidentId,
        teamId: team.teamId,
        authority: team.authority,
        status: status === "dispatched" ? "dispatched" : status === "responding" ? "responding" : "resolved",
        priority: severity,
        dispatchedAt,
        arrivedAt: status !== "dispatched" ? new Date(dispatchedAt.getTime() + 1000 * 60 * 8) : null,
        resolvedAt: status === "resolved" ? new Date(dispatchedAt.getTime() + 1000 * 60 * 25) : null,
      });
      incident.responseId = response.responseId;
      await incident.save();
    }

    created++;
  }
  console.log(`[seed] ${created} historical incidents created`);

  console.log("[seed] Done. Demo camera CAM-124 is offline until the mobile app connects.");
  await mongoose.disconnect();
}

function descriptionFor(type: string): string {
  switch (type) {
    case "physical_altercation":
      return "Possible physical altercation detected between two or more individuals";
    case "road_accident":
      return "Possible road accident / collision detected";
    case "fire_smoke":
      return "Fire or smoke signature detected in camera frame";
    case "person_fall":
      return "Person fall detected — possible medical emergency";
    default:
      return "Normal activity, no safety concern detected";
  }
}

seed().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
