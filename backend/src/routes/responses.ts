import { Router } from "express";
import { Response, ResponseTeam } from "../models";
import { requireAuth } from "../middleware/auth";
import { dispatchTeam, updateResponseStatus } from "../services/responseService";

const router = Router();

// GET /api/responses
router.get("/", async (_req, res) => {
  const responses = await Response.find().sort({ dispatchedAt: -1 });
  res.json(responses);
});

// GET /api/responses/teams — list response teams (for assignment UI)
router.get("/teams", async (_req, res) => {
  const teams = await ResponseTeam.find().sort({ authority: 1 });
  res.json(teams);
});

// POST /api/responses — dispatch a team to an incident
// Body: { incidentId, authority, teamId? }
router.post("/", requireAuth, async (req, res) => {
  try {
    const { incidentId, authority, teamId } = req.body;
    if (!incidentId || !authority) return res.status(400).json({ error: "incidentId and authority are required" });
    const result = await dispatchTeam({ incidentId, authority, teamId });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/responses/:id — update response status (responding | resolved)
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["responding", "resolved"].includes(status)) {
      return res.status(400).json({ error: "status must be 'responding' or 'resolved'" });
    }
    const result = await updateResponseStatus(req.params.id, status);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
