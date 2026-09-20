import { Router } from "express";
import { Incident, IncidentEvent } from "../models";
import { SOCKET_EVENTS, INCIDENT_TO_AUTHORITY, IncidentType } from "../types";
import { getIO } from "../sockets/io";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { recordVerificationOutcome } from "../services/analyticsService";
import { dispatchTeam } from "../services/responseService";

const router = Router();

// GET /api/incidents?status=&type=&cameraId=&limit=
router.get("/", async (req, res) => {
  const { status, type, cameraId, limit } = req.query;
  const filter: any = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (cameraId) filter.cameraId = cameraId;

  const incidents = await Incident.find(filter)
    .sort({ detectedAt: -1 })
    .limit(limit ? Number(limit) : 100);

  res.json(incidents);
});

// GET /api/incidents/:id
router.get("/:id", async (req, res) => {
  const incident = await Incident.findOne({ incidentId: req.params.id });
  if (!incident) return res.status(404).json({ error: "Incident not found" });

  const events = await IncidentEvent.find({ incidentId: incident.incidentId }).sort({ detectedAt: 1 });

  res.json({ incident, events });
});

// POST /api/incidents — manual creation (rarely used; incidents are normally created by ingestDetection)
router.post("/", requireAuth, async (req, res) => {
  const incident = await Incident.create(req.body);
  getIO().emit(SOCKET_EVENTS.INCIDENT_DETECTED, incident.toObject());
  res.status(201).json(incident);
});

// PATCH /api/incidents/:id/verify — operator confirms or marks false alarm
// Body: { action: "confirm" | "false_alarm", reason?: string }
router.patch("/:id/verify", requireAuth, async (req: AuthedRequest, res) => {
  const { action, reason } = req.body;
  if (!["confirm", "false_alarm"].includes(action)) {
    return res.status(400).json({ error: "action must be 'confirm' or 'false_alarm'" });
  }

  const incident = await Incident.findOne({ incidentId: req.params.id });
  if (!incident) return res.status(404).json({ error: "Incident not found" });

  incident.verifiedBy = req.user?.name || req.user?.email || "operator";
  incident.verifiedAt = new Date();

  if (action === "confirm") {
    incident.status = "verified";
    incident.assignedAuthority =
      incident.type === "normal" ? null : INCIDENT_TO_AUTHORITY[incident.type as Exclude<IncidentType, "normal">];
    await incident.save();
    await recordVerificationOutcome("verified", incident.verifiedAt);
    getIO().emit(SOCKET_EVENTS.INCIDENT_VERIFIED, incident.toObject());
  } else {
    incident.status = "false_alarm";
    incident.falseAlarmReason = reason || null;
    await incident.save();
    await recordVerificationOutcome("false_alarm", incident.verifiedAt);
    getIO().emit(SOCKET_EVENTS.INCIDENT_FALSE_ALARM, incident.toObject());
  }

  getIO().emit(SOCKET_EVENTS.ANALYTICS_UPDATED, { reason: "verification" });
  res.json(incident);
});

// PATCH /api/incidents/:id/status — generic status transition (used for dispatch/resolve flows)
router.patch("/:id/status", requireAuth, async (req, res) => {
  const { status } = req.body;
  const validStatuses = [
    "detected",
    "under_review",
    "verified",
    "false_alarm",
    "dispatched",
    "responding",
    "resolved",
  ];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const incident = await Incident.findOneAndUpdate(
    { incidentId: req.params.id },
    { status, ...(status === "resolved" ? { resolvedAt: new Date() } : {}) },
    { new: true }
  );
  if (!incident) return res.status(404).json({ error: "Incident not found" });

  getIO().emit(SOCKET_EVENTS.INCIDENT_UPDATED, incident.toObject());
  res.json(incident);
});

// PATCH /api/incidents/:id/dispatch — assign a response team (see also /api/responses)
router.patch("/:id/dispatch", requireAuth, async (req, res) => {
  try {
    const { teamId } = req.body;
    const incident = await Incident.findOne({ incidentId: req.params.id });
    if (!incident) return res.status(404).json({ error: "Incident not found" });
    if (!incident.assignedAuthority) return res.status(400).json({ error: "Incident has no assigned authority yet" });

    const result = await dispatchTeam({
      incidentId: incident.incidentId,
      authority: incident.assignedAuthority,
      teamId,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
