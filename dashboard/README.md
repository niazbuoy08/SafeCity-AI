# SafeCity AI — Admin Dashboard

React + TypeScript + Vite + Tailwind CSS control-room web application for
operators: monitor cameras, receive real-time incident alerts, verify
incidents, dispatch response teams, and review analytics.

## Setup

```bash
cd dashboard
npm install
cp .env.example .env     # point at your backend if not on localhost:4000
npm run dev                # http://localhost:5173
```

Log in with a seeded account (created by `backend/npm run seed`):

- Admin — `admin@safecity.ai` / `admin123`
- Operator — `operator@safecity.ai` / `operator123`

## Pages

- **Dashboard** — city-wide stats, live map, recent incidents
- **Live Cameras** — camera grid with last-frame previews; click through to a
  detailed camera view
- **Incidents** — filterable incident table; click through to detail
- **Incident Detail** — evidence, AI description, timeline, operator actions
  (Confirm Incident / False Alarm), response dispatch & tracking
- **Map** — cameras, active incidents, response teams, and risk hotspots on
  one map
- **Response Teams** — team roster + dispatch history
- **Analytics** — incidents by type/location/hour/day, verified vs. false
  alarm, average verification/response time, hotspots, camera activity
- **Reports** — weekly summary for authorities (browse week by week, compare
  with the previous 7 days) with **Download PDF** and **Download CSV**, plus a
  filtered CSV export by date range, status and incident type. Only
  operator-verified incidents are analysed; false alarms are counted but never
  treated as incidents, and time-of-day patterns are only claimed with enough
  data
- **Settings** — account info, per-camera AI monitoring toggle, threshold docs

## Real-time behavior

Connects to the backend's Socket.IO server on load. When the AI service
detects (or the simulate endpoint creates) an incident, a toast alert appears
instantly with camera, location, confidence, and severity, and every open
page listening for that event re-fetches its data — no manual refresh needed.

## Notes

- Evidence frame images are served by the backend at `/uploads/frames/...`
  and resolved via `VITE_API_URL`.
- The map uses OpenStreetMap tiles via Leaflet/react-leaflet — no API key
  required.
