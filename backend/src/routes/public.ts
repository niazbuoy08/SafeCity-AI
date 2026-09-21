import { Router } from "express";
import { getDangerZones, parseHourWindow, parseTypes } from "../services/dangerZoneService";

const router = Router();

// GET /api/public/danger-zones?days=30&types=fire_smoke,road_accident&hours=18-22
//   days   1-365 (default 30)
//   types  comma list of incident types (default: all)
//   hours  Dhaka-time window "from-to", e.g. 18-22 or 22-5 (wraps midnight)
// Unauthenticated on purpose: this feeds the public-facing Danger Map in the
// mobile app. It only ever returns sanitized, operator-verified data — see
// dangerZoneService.ts for exactly what is (and isn't) exposed.
router.get("/danger-zones", async (req, res) => {
  try {
    const requested = Number.parseInt(String(req.query.days ?? "30"), 10);
    const days = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 365) : 30;
    res.json(
      await getDangerZones({
        days,
        types: parseTypes(req.query.types),
        hours: parseHourWindow(req.query.hours),
      })
    );
  } catch (err: any) {
    console.error("[public danger-zones error]", err.message);
    res.status(500).json({ error: "Could not load danger zones" });
  }
});

export default router;
