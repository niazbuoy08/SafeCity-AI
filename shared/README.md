# Shared Types

`types/index.ts` is the canonical contract for core domain shapes (Camera,
Incident, DetectionResult, status enums, Socket.IO event names) used across
the backend, dashboard, and mobile app.

Each project keeps its own local copy under its own `src/types` (they're
independent npm/Expo/pip projects with separate build pipelines), but all
three **must** stay in sync with the shapes defined here. If you change an
enum or add a field, update it here first, then propagate the change to:

- `backend/src/types/index.ts`
- `dashboard/src/types/index.ts`
- (the AI service has its own Pydantic models in `ai-service/app/models/detection.py`,
  which mirror `DetectionResult`)
