# SafeCity AI

**Turning Cameras into Care**
*Detect danger earlier. Respond faster. Build safer communities.*

SafeCity AI is a prototype AI-assisted public safety monitoring system for
Bangladesh. Existing cameras continuously capture public spaces, but humans
cannot watch every feed every second. SafeCity AI analyzes camera footage in
real time, flags potentially dangerous incidents, and puts them in front of a
human operator to verify before any response is dispatched.

> **Product principle:** SafeCity AI does not claim to prevent crime with
> certainty. AI detects *potential* incidents. Humans verify them. Authorities
> respond. Historical data supports preventive planning. No facial
> recognition. No identity tracking — only event and safety-risk detection.

---

## 1. Project overview

Two user-facing applications, one connected ecosystem:

1. **SafeCity Camera** (`/mobile`) — an Expo/React Native app that turns a
   phone into a simulated CCTV camera (Camera 124, Mohammadpur, Dhaka by
   default). Captures frames roughly once a second and posts them to the
   backend. Designed so a real RTSP/CCTV camera can later post to the exact
   same endpoint without any backend changes.
2. **SafeCity AI Control Room** (`/dashboard`) — a React/Vite/Tailwind admin
   dashboard where operators watch cameras, receive real-time incident
   alerts, verify incidents, dispatch response teams, and review analytics.

Both are backed by:

- **`/backend`** — Node.js/Express/TypeScript/MongoDB/Socket.IO API that
  ingests frames, calls the AI service, groups detections into incidents,
  manages verification/response state, and pushes real-time updates.
- **`/ai-service`** — a separate Python/FastAPI microservice that does all
  computer-vision inference behind a pluggable provider interface: a `demo`
  provider for guaranteed-reliable demos, a `real` OpenCV-heuristic provider
  that actually processes pixels, and a `gemini` provider that sends frames
  to Google's Gemini vision model for genuine scene understanding — see
  `ai-service/README.md`.
- **`/shared`** — canonical TypeScript type definitions kept in sync across
  backend and dashboard.

## 2. Architecture

```
Mobile Camera (Expo)
      │  POST /api/cameras/:id/frame  (JPEG + camera ID, GPS, timestamp)
      ▼
Node.js Backend (Express)
      │  forwards frame
      ▼
AI Detection Service (FastAPI + OpenCV)
      │  DetectionResult { incident_type, confidence, severity, ... }
      ▼
Backend: incident-grouping service
      │  groups consecutive same-type detections from the same camera
      │  within a rolling time window into ONE incident
      ▼
MongoDB  (Cameras, Incidents, IncidentEvents, ResponseTeams, Responses,
          Locations, Users, AnalyticsSnapshots)
      │
      ▼
Socket.IO  →  incident:detected / incident:updated / response:created / ...
      │
      ▼
Admin Dashboard (React)
      │  operator reviews evidence
      ▼
Human Verification  →  Confirm Incident | False Alarm
      │
      ▼
Response Assignment  →  recommended authority → dispatch a response team
      │
      ▼
Incident History + Analytics  (hotspots, trends, verification/response times)
```

The architecture cleanly separates **camera ingestion**, **AI inference**,
**incident management**, **human verification**, **response management**, and
**analytics** — each is its own module/service, so any one of them (most
notably the camera source and the AI model) can be swapped independently.

### Incident type → response authority

| Incident type | Authority |
|---|---|
| Physical altercation | Police |
| Road accident | Traffic Police |
| Fire / smoke | Fire Service |
| Person fall | Ambulance |

### Incident status lifecycle

`detected → under_review → verified → dispatched → responding → resolved`
(or `→ false_alarm` at the verification step)

## 3. Repository structure

```
/mobile        SafeCity Camera — Expo/React Native/TypeScript
/dashboard     Admin dashboard — React/Vite/TypeScript/Tailwind
/backend       API — Node/Express/TypeScript/MongoDB/Socket.IO
/ai-service    Detection microservice — Python/FastAPI/OpenCV
/shared        Canonical shared TypeScript type definitions
docker-compose.yml
```

Every component has its own `README.md` with details specific to it.

## 4. Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB 7 (local install or Docker)
- Expo CLI (`npx expo`, no global install needed) + Expo Go app on an Android
  phone, or an Android emulator
- Docker + Docker Compose (optional, for the `backend` + `ai-service` +
  `mongo` + `dashboard` stack)

## 5. Environment variables

Each component has an `.env.example` — copy to `.env` and adjust:

- `backend/.env.example` → `backend/.env`
- `ai-service/.env.example` → `ai-service/.env`
- `dashboard/.env.example` → `dashboard/.env`
- Mobile app settings are configured at runtime from within the app (Settings
  screen) and persisted on-device — see `mobile/README.md`.

Notable variables:

| Variable | Where | Purpose |
|---|---|---|
| `MONGO_URI` | backend | MongoDB connection string |
| `AI_SERVICE_URL` | backend | URL of the FastAPI detection service |
| `AI_PROVIDER` | ai-service | `demo`, `real`, or `gemini` — selects the detection provider |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | ai-service | Required only when `AI_PROVIDER=gemini` |
| `INCIDENT_GROUPING_WINDOW_SECONDS` | backend | De-duplication window for consecutive detections |
| `CONFIDENCE_IGNORE_BELOW` / `CONFIDENCE_HIGH_ABOVE` | backend, ai-service | Confidence thresholds (percent) |
| `JWT_SECRET` | backend | Dashboard auth token signing secret |
| `VITE_API_URL` / `VITE_SOCKET_URL` | dashboard | Backend base URL |

**Never commit real `.env` files or secrets** — only the `.example` files are
checked in.

## 6. Running everything locally

### Option A — manual (recommended while developing)

**1. MongoDB**
```bash
docker run -d --name safecity-mongo -p 27017:27017 mongo:7
```

**2. AI Detection Service**
```bash
cd ai-service
python -m venv .venv && .venv\Scripts\activate     # Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

**3. Backend**
```bash
cd backend
npm install
cp .env.example .env
npm run seed      # 10 cameras, 20 historical incidents, 5 response teams, 6 Dhaka locations, 2 users
npm run dev        # http://localhost:4000
```

**4. Dashboard**
```bash
cd dashboard
npm install
cp .env.example .env
npm run dev         # http://localhost:5173
```
Log in with `admin@safecity.ai` / `admin123` (or `operator@safecity.ai` / `operator123`).

**5. Mobile app**
```bash
cd mobile
npm install
npx expo start
```
Scan the QR code with Expo Go on an Android phone (same Wi-Fi network as your
computer). Open the app's ⚙ Settings and set **Backend URL** to
`http://<your-computer's-LAN-IP>:4000`, then **Test Connection** → **Save**.

### Option B — Docker Compose (backend + ai-service + mongo + dashboard)

```bash
docker compose up --build
```

This brings up MongoDB, the AI service (`demo` provider), the backend, and
the dashboard (served on port 5173). Run the seed script once against the
containerized backend:

```bash
docker compose exec backend npm run seed
```

The mobile app still runs via Expo on your machine/phone (Expo apps aren't
containerized) — point its Backend URL at your machine's LAN IP on port 4000.

## 7. Using Demo Mode

Live AI detection is intentionally conservative (it mostly reports "normal"
to avoid alert fatigue) and — since this is a prototype without a trained
deep-learning model — isn't guaranteed to recognize a staged fight or fall on
camera during a live demo. **Demo Mode** exists to make the full workflow
reliably demonstrable regardless:

1. In the SafeCity Camera app, scroll to the red **Demo Scenario** panel.
2. Tap **Simulate Fight** / **Simulate Accident** / **Simulate Fire** /
   **Simulate Person Fall**.
3. This calls the real backend (`POST /api/cameras/:id/simulate`), which asks
   the AI service for a realistic high-confidence detection for that
   scenario, then runs it through the *exact same* incident-creation,
   grouping, and Socket.IO pipeline as a live detection would.
4. The incident appears on the dashboard exactly as a real detection would —
   nothing about the verification/response/analytics flow is faked.

Switching `AI_PROVIDER` in `ai-service/.env` between `real` (OpenCV
heuristics) and `gemini` (Google Gemini vision model, genuine scene
understanding — requires `GEMINI_API_KEY`) changes how *live* frames are
analyzed — see `ai-service/README.md`. Demo Mode behaves identically across
all three providers.

## 8. Running the full demonstration

1. Open the SafeCity Camera app. Default camera is **CAM-124**, Mohammadpur,
   Dhaka.
2. (Optional) Adjust camera settings, then confirm the Backend URL is
   reachable via **Test Connection**.
3. Tap **Start Monitoring** — the phone camera activates, frames begin
   posting to the backend roughly once a second, and status pills show
   Connected / AI Monitoring Active.
4. Open the admin dashboard (already logged in) on the **Dashboard** page —
   you'll see Camera 124 come online on the map and in the stats.
5. Trigger an incident: act out a scenario in front of the camera, or (for a
   guaranteed result) tap **Simulate Fight** in Demo Mode.
6. Within moments, a **NEW INCIDENT** toast appears on the dashboard with
   type, camera, location, time, confidence, and severity.
7. Click the toast (or the incident in the list) to open **Incident Detail**
   — evidence frame(s), AI description, and detection timeline.
8. Click **CONFIRM INCIDENT** — status becomes **Verified**, and the
   recommended response authority (e.g. **Police** for a physical
   altercation) is shown.
9. Click **Confirm Assignment & Dispatch** — a response team is assigned,
   status becomes **Dispatched**, and the Response Teams page shows the
   active dispatch.
10. Advance the response (**Mark Responding On-Scene** → **Mark Resolved**)
    to show the full incident lifecycle.
11. Open **Analytics** — the new incident is reflected in incidents-by-type,
    by-hour, verified-vs-false-alarm, and average response time.
12. Open **Map** — see the incident location and hotspot rings update
    alongside camera and response-team markers.

## 9. Demo data

`backend/npm run seed` creates:

- 10 cameras across Mohammadpur, Mirpur, Dhanmondi, Uttara, Farmgate, Gulshan
  (Camera 124 in Mohammadpur starts offline until the mobile app connects)
- ~20 historical incidents across all incident types and statuses
- 5 simulated response teams (police ×2, fire service, ambulance, traffic
  police)
- 6 Dhaka-area demo locations
- An admin and an operator user account

Re-run the seed script any time to reset demo data (it clears and
re-populates the relevant collections). Seeded incidents/responses are
identifiable by their `INC-SEED-*` / `RSP-SEED-*` IDs — anything created
through live detection, Demo Mode, or the dashboard has a timestamp-based ID
instead (e.g. `INC-MU9MEQSS-eede`).

If you'd rather start with an empty incident/response history and only see
things you actually trigger (without deleting cameras, teams, users, or
locations), run:

```bash
npm run clear-incidents
```

## 10. Security & privacy notes

- No facial recognition, no identity tracking — the AI only classifies
  events (`physical_altercation`, `road_accident`, `fire_smoke`,
  `person_fall`, `normal`).
- Dashboard access requires authentication (JWT) with role-based access
  (`admin`, `operator`).
- Secrets (JWT secret, DB URI, seed credentials) are read from environment
  variables — never hardcoded — and `.env` files are gitignored.
- Camera frame ingestion has no authentication in this prototype (mirroring
  how a real CCTV/RTSP feed would push into an ingestion gateway); add an
  API-key or mTLS layer before any production deployment.

## 11. Replacing the mobile camera with a real CCTV/RTSP feed later

The backend's camera ingestion contract is deliberately source-agnostic:
`POST /api/cameras/:id/frame` just needs `{ imageBase64, timestamp, latitude,
longitude, location, frameId }`. To integrate a real camera later, write a
small adapter service that pulls frames from an RTSP stream (e.g. with
OpenCV's `cv2.VideoCapture`) and POSTs them to this same endpoint at whatever
interval you choose — no changes to the backend, AI service, or dashboard are
required.
