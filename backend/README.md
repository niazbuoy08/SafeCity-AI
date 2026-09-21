# SafeCity AI — Backend

Node.js + Express + TypeScript + MongoDB + Socket.IO service that ties the whole
SafeCity AI system together: camera ingestion, incident management, human
verification, response dispatch, and analytics.

## Responsibilities

- Accepts camera frames (from the mobile app today, an RTSP adapter later) via
  `POST /api/cameras/:id/frame`.
- Forwards each frame to the separate **AI Detection Service** for analysis —
  it never runs detection logic itself.
- Groups consecutive detections of the same type from the same camera into a
  single Incident (`INCIDENT_GROUPING_WINDOW_SECONDS`), instead of creating
  one incident per frame.
- Persists Cameras, Incidents, IncidentEvents, ResponseTeams, Responses,
  Locations, Users, and Analytics snapshots in MongoDB.
- Broadcasts real-time events over Socket.IO so the dashboard updates instantly.
- Exposes REST APIs for the dashboard: verification, response dispatch,
  analytics aggregation.

## Setup

```bash
cd backend
npm install
cp .env.example .env      # edit MONGO_URI / AI_SERVICE_URL if needed
npm run seed               # creates demo cameras, incidents, teams, users
npm run dev                 # starts on http://localhost:4000
```

Requires a running MongoDB instance (`docker run -p 27017:27017 mongo:7` works)
and the AI service running at `AI_SERVICE_URL` (see `../ai-service/README.md`).

## Environment variables

See `.env.example`. Key ones:

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `AI_SERVICE_URL` | Base URL of the Python AI Detection Service |
| `AI_PROVIDER` | `demo` or `real` — informational; the AI service itself is what actually switches providers |
| `INCIDENT_GROUPING_WINDOW_SECONDS` | Time window for de-duplicating consecutive detections into one incident |
| `CONFIDENCE_IGNORE_BELOW` / `CONFIDENCE_HIGH_ABOVE` | Confidence thresholds (percent) |
| `JWT_SECRET` | Signing secret for dashboard auth tokens |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Seeded admin login |
| `SEED_OPERATOR_EMAIL` / `SEED_OPERATOR_PASSWORD` | Seeded operator login |

## Key API groups

- `POST/GET/PATCH /api/cameras` — camera registry & heartbeat
- `POST /api/cameras/:id/frame` — frame ingestion (mobile camera → AI → incident)
- `POST /api/cameras/:id/simulate` — incident simulation for testing/demos (API only; not in the mobile app)
- `GET/POST/PATCH /api/incidents` — incident list, detail, verify, status, dispatch
- `GET/POST/PATCH /api/responses` — response team dispatch tracking
- `GET /api/analytics/*` — summary, incident breakdowns, hotspots
- `GET /api/public/danger-zones?days=30&types=fire_smoke,road_accident&hours=17-22`
  — **unauthenticated**, feeds the mobile app's Danger Map. Returns only
  operator-verified incidents, clustered into zones (750 m radius) plus
  severity-weighted heat points, and a `timeOfDay` block (hourly counts and a
  peak window — only when ≥ 5 incidents support it). `types` filters incident
  types; `hours` is a Dhaka-time window that wraps midnight (`22-5`). Never
  exposes camera IDs, incident IDs, or evidence frames
- `GET /api/reports/weekly?end=YYYY-MM-DD` — **login required**. Weekly summary
  (7 days ending on `end`, Dhaka time) with previous-week comparison and
  auto-written key observations
- `GET /api/reports/weekly.pdf?end=YYYY-MM-DD` — the same summary as an A4 PDF
  for authorities (KPIs, charts, top areas, response times, verified incident
  log). Bengali place names render via the bundled Hind Siliguri font
  (`assets/fonts`, SIL OFL)
- `GET /api/reports/incidents.csv?from=&to=&status=&type=` — CSV export
  (UTF-8 with BOM so Excel shows Bengali; text cells that could run as
  spreadsheet formulas are neutralised)

## Architecture note

The backend is intentionally camera-source-agnostic: `POST /api/cameras/:id/frame`
just needs a JPEG (base64) and metadata. Swapping the mobile app for a real
RTSP/CCTV camera later means writing a small adapter that posts frames to this
same endpoint — no backend changes required.
