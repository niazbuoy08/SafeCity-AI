import { Router } from "express";
import { Camera } from "../models";
import { SOCKET_EVENTS } from "../types";
import { getIO } from "../sockets/io";
import { saveFrame } from "../services/frameStorage";
import { analyzeFrame, simulateDetection } from "../services/aiClient";
import { ingestDetection, serializeIncident } from "../services/incidentService";

const router = Router();

// POST /api/cameras — register a new camera (mobile app self-registers, or admin creates one)
router.post("/", async (req, res) => {
  try {
    const { cameraId, name, location, latitude, longitude, detectionIntervalMs, source } = req.body;
    if (!cameraId || !name || !location) {
      return res.status(400).json({ error: "cameraId, name and location are required" });
    }

    const camera = await Camera.findOneAndUpdate(
      { cameraId },
      {
        cameraId,
        name,
        location,
        latitude: latitude ?? 23.7644,
        longitude: longitude ?? 90.3596,
        detectionIntervalMs: detectionIntervalMs ?? 1000,
        source: source ?? "mobile",
        status: "online",
        lastSeen: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    getIO().emit(SOCKET_EVENTS.CAMERA_ONLINE, camera.toObject());
    res.status(201).json(camera);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cameras
router.get("/", async (_req, res) => {
  const cameras = await Camera.find().sort({ cameraId: 1 });
  res.json(cameras);
});

// GET /api/cameras/:id
router.get("/:id", async (req, res) => {
  const camera = await Camera.findOne({ cameraId: req.params.id });
  if (!camera) return res.status(404).json({ error: "Camera not found" });
  res.json(camera);
});

// PATCH /api/cameras/:id
router.patch("/:id", async (req, res) => {
  const camera = await Camera.findOneAndUpdate({ cameraId: req.params.id }, req.body, { new: true });
  if (!camera) return res.status(404).json({ error: "Camera not found" });
  getIO().emit(SOCKET_EVENTS.CAMERA_ONLINE, camera.toObject());
  res.json(camera);
});

// POST /api/cameras/:id/frame — ingest a frame from the mobile camera (or future RTSP adapter)
router.post("/:id/frame", async (req, res) => {
  try {
    const cameraId = req.params.id;
    const { imageBase64, timestamp, latitude, longitude, location, frameId } = req.body;

    if (!imageBase64) return res.status(400).json({ error: "imageBase64 is required" });

    let camera = await Camera.findOne({ cameraId });
    if (!camera) {
      camera = await Camera.create({
        cameraId,
        name: `Camera ${cameraId}`,
        location: location || "Unknown",
        latitude: latitude ?? 23.7644,
        longitude: longitude ?? 90.3596,
        status: "online",
      });
    }

    const frameUrl = saveFrame(cameraId, imageBase64);

    let detection = null;
    let incidentResult = null;
    if (camera.aiMonitoring) {
      detection = await analyzeFrame({ imageBase64, cameraId });
      incidentResult = await ingestDetection({ cameraId, detection, frameUrl });
    }

    camera.status = "online";
    camera.lastSeen = new Date();
    camera.lastFrameUrl = frameUrl;
    if (latitude) camera.latitude = latitude;
    if (longitude) camera.longitude = longitude;
    if (location) camera.location = location;
    if (detection) {
      camera.lastDetectionType = detection.incident_type;
      camera.lastDetectionConfidence = Math.round(detection.confidence * 100);
      camera.lastDetectionSeverity = detection.severity;
      camera.lastDetectionDescription = detection.description;
      camera.lastDetectionAt = new Date();
    }
    await camera.save();

    getIO().emit(SOCKET_EVENTS.CAMERA_FRAME, {
      cameraId,
      frameUrl,
      timestamp: timestamp || new Date().toISOString(),
      frameId,
    });

    res.json({
      received: true,
      frameUrl,
      detection,
      incident: incidentResult ? serializeIncident(incidentResult.incident) : null,
      isNewIncident: incidentResult?.isNew ?? false,
    });
  } catch (err: any) {
    console.error("[frame ingest error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cameras/:id/simulate — Demo Mode: guarantee a working incident for the presentation
// Body: { scenario: "fight" | "accident" | "fire" | "fall" }
router.post("/:id/simulate", async (req, res) => {
  try {
    const cameraId = req.params.id;
    const { scenario } = req.body;
    if (!["fight", "accident", "fire", "fall"].includes(scenario)) {
      return res.status(400).json({ error: "scenario must be one of: fight, accident, fire, fall" });
    }

    const camera = await Camera.findOne({ cameraId });
    if (!camera) return res.status(404).json({ error: "Camera not found" });

    const detection = await simulateDetection({ scenario, cameraId });
    const frameUrl = camera.lastFrameUrl || null;

    camera.status = "online";
    camera.lastSeen = new Date();
    camera.lastDetectionType = detection.incident_type;
    camera.lastDetectionConfidence = Math.round(detection.confidence * 100);
    camera.lastDetectionSeverity = detection.severity;
    camera.lastDetectionDescription = `${detection.description} (Demo Mode)`;
    camera.lastDetectionAt = new Date();
    await camera.save();

    const incidentResult = await ingestDetection({ cameraId, detection, frameUrl });

    res.json({
      received: true,
      simulated: true,
      detection,
      incident: incidentResult ? serializeIncident(incidentResult.incident) : null,
      isNewIncident: incidentResult?.isNew ?? false,
    });
  } catch (err: any) {
    console.error("[simulate error]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
