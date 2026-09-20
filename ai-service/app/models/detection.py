from datetime import datetime, timezone
from typing import List, Literal
from pydantic import BaseModel, Field

IncidentType = Literal[
    "physical_altercation",
    "road_accident",
    "fire_smoke",
    "person_fall",
    "normal",
]

Severity = Literal["low", "medium", "high", "critical"]


class DetectionResult(BaseModel):
    incident_type: IncidentType
    confidence: float = Field(..., ge=0.0, le=1.0, description="0-1 confidence score")
    severity: Severity
    description: str
    detected_objects: List[str] = []
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SimulateRequest(BaseModel):
    scenario: Literal["fight", "accident", "fire", "fall"]
    camera_id: str
