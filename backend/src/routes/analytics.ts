import { Router } from "express";
import { Camera, Incident } from "../models";
import { getSummary, getIncidentsAnalytics, getHotspots } from "../services/analyticsService";

const router = Router();

// GET /api/analytics/summary
router.get("/summary", async (_req, res) => {
  const summary = await getSummary();
  const totalCameras = await Camera.countDocuments();
  const camerasOnline = await Camera.countDocuments({ status: "online" });

  res.json({
    totalCameras,
    camerasOnline,
    ...summary,
  });
});

// GET /api/analytics/incidents
router.get("/incidents", async (_req, res) => {
  const data = await getIncidentsAnalytics();
  res.json(data);
});

// GET /api/analytics/hotspots
router.get("/hotspots", async (_req, res) => {
  const hotspots = await getHotspots();
  res.json(hotspots);
});

// GET /api/analytics/cameras — per-camera activity for the analytics page
router.get("/cameras", async (_req, res) => {
  const activity = await Incident.aggregate([
    { $group: { _id: "$cameraId", incidentCount: { $sum: 1 } } },
    { $sort: { incidentCount: -1 } },
  ]);
  const cameras = await Camera.find();
  const merged = cameras.map((c) => ({
    cameraId: c.cameraId,
    name: c.name,
    location: c.location,
    status: c.status,
    incidentCount: activity.find((a) => a._id === c.cameraId)?.incidentCount ?? 0,
  }));
  res.json(merged);
});

export default router;
