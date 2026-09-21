import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { buildWeeklyReport, fetchIncidents, fetchResponsesFor, STATUS_LABELS } from "../services/reportService";
import { renderWeeklyReportPdf } from "../services/reportPdf";
import { incidentsToCsv } from "../services/csvService";
import { PUBLIC_INCIDENT_TYPES } from "../services/dangerZoneService";
import { DAY_MS, addDaysToKey, dhakaDateKey, isDateKey, startOfDhakaDay } from "../utils/dhakaTime";

const router = Router();

// Reports contain camera IDs, operator names and exact locations, so unlike
// the public Danger Map they require a signed-in operator or admin.
router.use(requireAuth);

const MAX_EXPORT_DAYS = 366;
const ALL_STATUSES = Object.keys(STATUS_LABELS);

const todayKey = () => dhakaDateKey(new Date());

function parseKey(raw: unknown, fallback: string): string | null {
  if (raw === undefined || raw === "") return fallback;
  return typeof raw === "string" && isDateKey(raw) ? raw : null;
}

function listParam(raw: unknown, allowed: string[]): string[] {
  if (typeof raw !== "string" || !raw) return [];
  const wanted = raw.split(",").map((s) => s.trim());
  return allowed.filter((a) => wanted.includes(a));
}

// GET /api/reports/weekly?end=YYYY-MM-DD   (7 days ending on `end`, Dhaka time; default today)
router.get("/weekly", async (req, res) => {
  const end = parseKey(req.query.end, todayKey());
  if (!end) return res.status(400).json({ error: "end must be a valid date (YYYY-MM-DD)" });
  if (end > todayKey()) return res.status(400).json({ error: "end cannot be in the future" });
  try {
    res.json(await buildWeeklyReport(end));
  } catch (err: any) {
    console.error("[report weekly error]", err.message);
    res.status(500).json({ error: "Could not build the report" });
  }
});

// GET /api/reports/weekly.pdf?end=YYYY-MM-DD
router.get("/weekly.pdf", async (req, res) => {
  const end = parseKey(req.query.end, todayKey());
  if (!end) return res.status(400).json({ error: "end must be a valid date (YYYY-MM-DD)" });
  if (end > todayKey()) return res.status(400).json({ error: "end cannot be in the future" });
  try {
    const report = await buildWeeklyReport(end);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="safecity-weekly-summary-${end}.pdf"`);
    renderWeeklyReportPdf(report, res);
  } catch (err: any) {
    console.error("[report pdf error]", err.message);
    if (!res.headersSent) res.status(500).json({ error: "Could not build the PDF" });
  }
});

// GET /api/reports/incidents.csv?from=&to=&status=a,b&type=a,b   (dates inclusive, Dhaka time)
router.get("/incidents.csv", async (req, res) => {
  const to = parseKey(req.query.to, todayKey());
  const from = parseKey(req.query.from, to ? addDaysToKey(to, -6) : todayKey());
  if (!from || !to) return res.status(400).json({ error: "from/to must be valid dates (YYYY-MM-DD)" });
  if (from > to) return res.status(400).json({ error: "from must not be after to" });
  if (to > todayKey()) return res.status(400).json({ error: "to cannot be in the future" });
  const spanDays = Math.round((startOfDhakaDay(to).getTime() - startOfDhakaDay(from).getTime()) / DAY_MS) + 1;
  if (spanDays > MAX_EXPORT_DAYS) return res.status(400).json({ error: `Range too large (max ${MAX_EXPORT_DAYS} days)` });

  const statuses = listParam(req.query.status, ALL_STATUSES);
  const types = listParam(req.query.type, PUBLIC_INCIDENT_TYPES);

  try {
    const start = startOfDhakaDay(from);
    const endExclusive = new Date(startOfDhakaDay(to).getTime() + DAY_MS);
    const incidents = await fetchIncidents(start, endExclusive, statuses, types);
    const responses = await fetchResponsesFor(incidents.map((i) => i.incidentId));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="safecity-incidents-${from}_to_${to}.csv"`);
    res.send(incidentsToCsv(incidents, responses));
  } catch (err: any) {
    console.error("[report csv error]", err.message);
    res.status(500).json({ error: "Could not build the CSV" });
  }
});

export default router;
