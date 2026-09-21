"""
Demo detection provider.

Guarantees the end-to-end SafeCity AI workflow can always be demonstrated,
even if a live camera feed doesn't happen to contain a real incident at
presentation time, or a "real" CV/ML provider is unavailable.

- detect(): analyzes real pixel statistics (brightness/motion-ish variance)
  just enough to occasionally raise a low-confidence "potential incident"
  from ordinary camera frames, but overwhelmingly reports "normal" — this
  keeps the live-monitoring UI honest and non-spammy.
- simulate(): called by the backend's /api/cameras/:id/simulate endpoint. It
  returns a high-confidence, realistic detection for the requested scenario
  every time, so the operator dashboard workflow (alert,
  verify, dispatch, analytics) can be reliably shown end-to-end.
"""

import random
from datetime import datetime, timezone

import numpy as np

from app.models.detection import DetectionResult
from app.providers.base import DetectionProvider

SCENARIO_TEMPLATES = {
    "fight": {
        "incident_type": "physical_altercation",
        "confidence_range": (0.86, 0.97),
        "severity": "high",
        "description": "Possible physical altercation detected between two or more individuals",
        "detected_objects": ["person", "person"],
    },
    "accident": {
        "incident_type": "road_accident",
        "confidence_range": (0.82, 0.95),
        "severity": "critical",
        "description": "Possible road accident / vehicle collision detected",
        "detected_objects": ["person", "vehicle"],
    },
    "fire": {
        "incident_type": "fire_smoke",
        "confidence_range": (0.88, 0.99),
        "severity": "critical",
        "description": "Fire or smoke signature detected in camera frame",
        "detected_objects": ["fire", "smoke"],
    },
    "fall": {
        "incident_type": "person_fall",
        "confidence_range": (0.80, 0.93),
        "severity": "high",
        "description": "Person fall detected — possible medical emergency",
        "detected_objects": ["person"],
    },
}


class DemoProvider(DetectionProvider):
    def detect(self, frame: np.ndarray, camera_id: str) -> DetectionResult:
        # Use real (harmless) pixel statistics so behavior isn't pure randomness,
        # while still being overwhelmingly "normal" for ordinary footage.
        brightness = float(np.mean(frame))
        variance = float(np.var(frame))
        roll = random.random()

        # ~4% of frames surface a low/medium confidence potential incident,
        # nudged by scene variance so a busier scene is slightly more likely to trigger.
        trigger_chance = 0.03 + min(variance / 50000, 0.03)

        if roll < trigger_chance:
            scenario_key = random.choice(list(SCENARIO_TEMPLATES.keys()))
            template = SCENARIO_TEMPLATES[scenario_key]
            confidence = round(random.uniform(0.60, 0.80), 2)  # potential, not high-confidence
            return DetectionResult(
                incident_type=template["incident_type"],
                confidence=confidence,
                severity="medium",
                description=template["description"],
                detected_objects=template["detected_objects"],
                timestamp=datetime.now(timezone.utc).isoformat(),
            )

        return DetectionResult(
            incident_type="normal",
            confidence=round(min(0.99, 0.9 + brightness / 2550), 2),
            severity="low",
            description="No safety-relevant activity detected",
            detected_objects=[],
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    def simulate(self, scenario: str, camera_id: str) -> DetectionResult:
        template = SCENARIO_TEMPLATES[scenario]
        return DetectionResult(
            incident_type=template["incident_type"],
            confidence=round(random.uniform(*template["confidence_range"]), 2),
            severity=template["severity"],
            description=template["description"],
            detected_objects=template["detected_objects"],
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
