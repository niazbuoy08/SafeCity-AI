"""
Real (OpenCV-based) detection provider.

This is a lightweight, dependency-free computer-vision pipeline — not a trained
deep model — chosen so the prototype runs anywhere without GPU/model downloads.
It uses classic, well-established OpenCV building blocks:

  - HOG + SVM pedestrian detector (cv2.HOGDescriptor) for person detection
  - HSV color-space thresholding for fire/smoke signature detection
  - Bounding-box proximity/overlap and aspect-ratio heuristics for
    altercation and fall detection
  - Edge-density heuristics as a rough "unusual scene disruption" proxy for
    road accidents

These heuristics are intentionally simple and transparent — swap this file's
`detect()` implementation for a real trained model (YOLO, a fine-tuned
action-recognition network, etc.) later without touching any other service.
"""

import random
from datetime import datetime, timezone

import cv2
import numpy as np

from app.models.detection import DetectionResult
from app.providers.base import DetectionProvider
from app.providers.demo_provider import SCENARIO_TEMPLATES


class RealCVProvider(DetectionProvider):
    def __init__(self) -> None:
        self._hog = cv2.HOGDescriptor()
        self._hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

    def detect(self, frame: np.ndarray, camera_id: str) -> DetectionResult:
        people_boxes = self._detect_people(frame)
        fire_ratio = self._fire_smoke_ratio(frame)
        edge_density = self._edge_density(frame)

        candidates = []

        if fire_ratio > 0.05:
            confidence = min(0.55 + fire_ratio * 3.0, 0.98)
            candidates.append(("fire_smoke", confidence))

        if len(people_boxes) >= 2:
            proximity_score = self._proximity_score(people_boxes)
            if proximity_score > 0.3:
                confidence = min(0.5 + proximity_score * 0.5, 0.97)
                candidates.append(("physical_altercation", confidence))

        for (x, y, w, h) in people_boxes:
            aspect = w / max(h, 1)
            if aspect > 1.3:  # wider than tall -> possibly a fallen person
                confidence = min(0.45 + (aspect - 1.3) * 0.4, 0.95)
                candidates.append(("person_fall", confidence))
                break

        if edge_density > 0.22 and len(people_boxes) == 0:
            confidence = min(0.35 + edge_density * 0.8, 0.85)
            candidates.append(("road_accident", confidence))

        if not candidates:
            return DetectionResult(
                incident_type="normal",
                confidence=round(random.uniform(0.85, 0.99), 2),
                severity="low",
                description="No safety-relevant activity detected",
                detected_objects=["person"] * len(people_boxes),
                timestamp=datetime.now(timezone.utc).isoformat(),
            )

        incident_type, confidence = max(candidates, key=lambda c: c[1])
        severity = self._severity_for(confidence)

        return DetectionResult(
            incident_type=incident_type,
            confidence=round(confidence, 2),
            severity=severity,
            description=self._description_for(incident_type),
            detected_objects=["person"] * max(len(people_boxes), 1 if incident_type != "normal" else 0),
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    def simulate(self, scenario: str, camera_id: str) -> DetectionResult:
        # Demo Mode must be guaranteed to work even on the "real" provider,
        # so simulation reuses the same realistic templates as the demo provider.
        template = SCENARIO_TEMPLATES[scenario]
        return DetectionResult(
            incident_type=template["incident_type"],
            confidence=round(random.uniform(*template["confidence_range"]), 2),
            severity=template["severity"],
            description=template["description"],
            detected_objects=template["detected_objects"],
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    # --- internal CV helpers -------------------------------------------------

    def _detect_people(self, frame: np.ndarray):
        small = cv2.resize(frame, (min(640, frame.shape[1]), min(480, frame.shape[0])))
        boxes, _ = self._hog.detectMultiScale(small, winStride=(8, 8), padding=(8, 8), scale=1.05)
        return boxes

    def _fire_smoke_ratio(self, frame: np.ndarray) -> float:
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        lower = np.array([0, 80, 150])
        upper = np.array([35, 255, 255])
        mask = cv2.inRange(hsv, lower, upper)
        return float(np.count_nonzero(mask)) / float(mask.size)

    def _edge_density(self, frame: np.ndarray) -> float:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 100, 200)
        return float(np.count_nonzero(edges)) / float(edges.size)

    def _proximity_score(self, boxes) -> float:
        centers = [(x + w / 2, y + h / 2) for (x, y, w, h) in boxes]
        avg_size = float(np.mean([w for (_, _, w, _) in boxes]))
        min_dist = None
        for i in range(len(centers)):
            for j in range(i + 1, len(centers)):
                dx = centers[i][0] - centers[j][0]
                dy = centers[i][1] - centers[j][1]
                dist = (dx**2 + dy**2) ** 0.5
                if min_dist is None or dist < min_dist:
                    min_dist = dist
        if min_dist is None or avg_size == 0:
            return 0.0
        ratio = min_dist / avg_size
        return max(0.0, min(1.0, 1.5 - ratio / 2))

    def _severity_for(self, confidence: float) -> str:
        if confidence >= 0.85:
            return "critical"
        if confidence >= 0.75:
            return "high"
        if confidence >= 0.6:
            return "medium"
        return "low"

    def _description_for(self, incident_type: str) -> str:
        return {
            "physical_altercation": "Possible physical altercation detected between two or more individuals",
            "road_accident": "Unusual scene disruption consistent with a possible road accident",
            "fire_smoke": "Fire or smoke color signature detected in camera frame",
            "person_fall": "Person fall detected — possible medical emergency",
        }.get(incident_type, "Unclassified activity detected")
