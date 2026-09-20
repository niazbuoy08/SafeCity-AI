import { v4 as uuid } from "uuid";
import { Incident, IncidentEvent, Camera } from "../models";
import { env } from "../config/env";
import { DetectionResult, IncidentType, SOCKET_EVENTS } from "../types";
import { getIO } from "../sockets/io";
import { recordSnapshotForIncident } from "./analyticsService";

interface IngestParams {
  cameraId: string;
  detection: DetectionResult;
  frameUrl: string | null;
}

/**
 * Core incident-grouping logic.
 *
 * Consecutive detections of the SAME incident type from the SAME camera
 * within INCIDENT_GROUPING_WINDOW_SECONDS are folded into a single Incident
 * (updating lastDetectedAt, confidence, and evidence) instead of creating
 * a new row per frame. A new incident is only opened when either:
 *   - no open incident of that type exists for the camera, or
 *   - the previous one has gone quiet longer than the grouping window.
 *
 * Every individual detection is still logged to IncidentEvent so the
 * incident detail timeline can show the full detection history.
 */
export async function ingestDetection(params: IngestParams): Promise<{ incident: any; isNew: boolean } | null> {
  const { cameraId, detection, frameUrl } = params;
  const confidencePct = detection.confidence * 100;

  if (confidencePct < env.confidenceIgnoreBelow) {
    return null; // below threshold: ignore
  }
  if (detection.incident_type === "normal") {
    return null; // nothing to report
  }

  const camera = await Camera.findOne({ cameraId });
  if (!camera) throw new Error(`Unknown camera: ${cameraId}`);

  const now = new Date();
  const windowMs = env.incidentGroupingWindowSeconds * 1000;
  const windowStart = new Date(now.getTime() - windowMs);

  const openStatuses = ["detected", "under_review"];
  const existing = await Incident.findOne({
    cameraId,
    type: detection.incident_type,
    status: { $in: openStatuses },
    lastDetectedAt: { $gte: windowStart },
  }).sort({ lastDetectedAt: -1 });

  if (existing) {
    existing.lastDetectedAt = now;
    existing.confidence = Math.max(existing.confidence, confidencePct);
    existing.severity = detection.severity;
    if (frameUrl) existing.evidenceFrames.push(frameUrl);
    existing.detectedObjects = Array.from(new Set([...existing.detectedObjects, ...detection.detected_objects]));
    await existing.save();

    await IncidentEvent.create({
      incidentId: existing.incidentId,
      cameraId,
      type: detection.incident_type,
      confidence: confidencePct,
      severity: detection.severity,
      frameUrl,
      detectedObjects: detection.detected_objects,
      detectedAt: now,
    });

    getIO().emit(SOCKET_EVENTS.INCIDENT_UPDATED, serializeIncident(existing));
    return { incident: existing, isNew: false };
  }

  const incidentId = `INC-${Date.now().toString(36).toUpperCase()}-${uuid().slice(0, 4)}`;
  const incident = await Incident.create({
    incidentId,
    cameraId,
    type: detection.incident_type,
    confidence: confidencePct,
    severity: detection.severity,
    description: detection.description,
    location: camera.location,
    latitude: camera.latitude,
    longitude: camera.longitude,
    detectedAt: now,
    firstDetectedAt: now,
    lastDetectedAt: now,
    status: "detected",
    evidenceFrames: frameUrl ? [frameUrl] : [],
    detectedObjects: detection.detected_objects,
  });

  await IncidentEvent.create({
    incidentId: incident.incidentId,
    cameraId,
    type: detection.incident_type,
    confidence: confidencePct,
    severity: detection.severity,
    frameUrl,
    detectedObjects: detection.detected_objects,
    detectedAt: now,
  });

  await recordSnapshotForIncident(incident);

  getIO().emit(SOCKET_EVENTS.INCIDENT_DETECTED, serializeIncident(incident));
  getIO().emit(SOCKET_EVENTS.ANALYTICS_UPDATED, { reason: "incident_detected" });

  return { incident, isNew: true };
}

export function serializeIncident(incident: any) {
  const obj = incident.toObject ? incident.toObject() : incident;
  return {
    incidentId: obj.incidentId,
    cameraId: obj.cameraId,
    type: obj.type,
    confidence: obj.confidence,
    severity: obj.severity,
    description: obj.description,
    location: obj.location,
    latitude: obj.latitude,
    longitude: obj.longitude,
    detectedAt: obj.detectedAt,
    firstDetectedAt: obj.firstDetectedAt,
    lastDetectedAt: obj.lastDetectedAt,
    status: obj.status,
    evidenceFrames: obj.evidenceFrames,
    detectedObjects: obj.detectedObjects,
    verifiedBy: obj.verifiedBy,
    verifiedAt: obj.verifiedAt,
    falseAlarmReason: obj.falseAlarmReason,
    assignedAuthority: obj.assignedAuthority,
    responseId: obj.responseId,
    resolvedAt: obj.resolvedAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export const INCIDENT_TO_AUTHORITY: Record<Exclude<IncidentType, "normal">, string> = {
  physical_altercation: "police",
  road_accident: "traffic_police",
  fire_smoke: "fire_service",
  person_fall: "ambulance",
};
