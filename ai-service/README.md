# SafeCity AI — Detection Service

Standalone Python + FastAPI + OpenCV microservice responsible for **all**
computer-vision inference in SafeCity AI. The backend never embeds detection
logic — it always calls this service, which means the model here can be
replaced or upgraded without touching any other part of the system.

## Supported incident classes

`physical_altercation`, `road_accident`, `fire_smoke`, `person_fall`, `normal`

No facial recognition. No identity tracking. The service only reasons about
events and safety risks, never about who is in the frame.

## Providers

`AI_PROVIDER` env var selects the active detector — all three implement the
same `DetectionProvider` interface (`app/providers/base.py`):

- **`demo`** (default) — deterministic, dependency-free provider. Reports
  "normal" for the overwhelming majority of ordinary frames, occasionally
  surfaces a low/medium-confidence "potential incident" from real pixel
  statistics, and — crucially — the `/api/simulate` endpoint (called by the
  backend's `/api/cameras/:id/simulate`) always returns a realistic,
  high-confidence detection for the requested scenario. This guarantees the full workflow
  (alert → verify → dispatch → analytics) can be demonstrated reliably.
- **`real`** — a lightweight OpenCV pipeline using classic, practical CV
  techniques: HOG+SVM pedestrian detection, HSV color thresholding for
  fire/smoke, and bounding-box proximity/aspect-ratio heuristics for
  altercations and falls. It's not a trained deep model (so it runs anywhere
  with no GPU or downloads), but it genuinely processes the incoming frame
  rather than faking a result.
- **`gemini`** — sends the frame to Google's Gemini vision model
  (`gemini-2.5-flash` by default) for genuine multimodal scene understanding,
  using the same prompt/response contract described in `gemini_provider.py`.
  This reasons about context (e.g. people play-fighting vs. an actual
  assault) rather than just thresholding colors and bounding boxes like
  `real` does. Requires `GEMINI_API_KEY` — get one at
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey). On any
  API failure (network, rate limit, malformed response) it fails *safe*,
  logging the error and returning a low-confidence "normal" result rather
  than crashing frame ingestion. `/api/simulate` never calls
  Gemini — it reuses the same guaranteed templates as `demo`/`real`, so a
  demo never depends on third-party API latency or availability.
  Because it's a real network call per frame, expect ~1–3s latency per
  detection — increase the mobile app's detection interval if you're running
  continuous live monitoring against this provider.

Swap any provider's `detect()` for a different model later (e.g. a trained
YOLO/action-recognition network) without touching the backend or dashboard —
they only ever see the `DetectionResult` JSON shape.

## Setup

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
cp .env.example .env           # set AI_PROVIDER=demo | real | gemini
uvicorn app.main:app --reload --port 8000
```

If using `AI_PROVIDER=gemini`, also set `GEMINI_API_KEY` (and optionally
`GEMINI_MODEL`, default `gemini-2.5-flash`) in `.env`.

Service runs at `http://localhost:8000`. Interactive API docs at
`http://localhost:8000/docs`.

## API

- `POST /api/detect` (multipart: `file`, `camera_id`) → `DetectionResult`
- `POST /api/simulate` (JSON: `scenario`, `camera_id`) → `DetectionResult`
- `GET /api/config` → active provider + thresholds
- `GET /health` → liveness check

### DetectionResult shape

```json
{
  "incident_type": "physical_altercation",
  "confidence": 0.91,
  "severity": "high",
  "description": "Possible physical altercation detected",
  "detected_objects": ["person", "person"],
  "timestamp": "2026-09-20T10:42:01.000Z"
}
```

## Confidence thresholds

Configurable via `CONFIDENCE_IGNORE_BELOW` / `CONFIDENCE_HIGH_ABOVE` in
`.env` (percent, 0–100). The backend independently enforces
`CONFIDENCE_IGNORE_BELOW` before creating an incident.

## Docker

```bash
docker build -t safecity-ai-service .
docker run -p 8000:8000 -e AI_PROVIDER=demo safecity-ai-service
```
