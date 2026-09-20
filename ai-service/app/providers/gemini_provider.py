"""
Gemini detection provider.

Sends the camera frame to Google's Gemini multimodal model and asks it to
classify the scene against SafeCity AI's fixed incident taxonomy. Unlike the
OpenCV heuristic provider, this is genuine scene understanding — it can
reason about context (e.g. two people play-fighting vs. an actual assault)
rather than just thresholding colors and bounding boxes.

Requires GEMINI_API_KEY. On any failure (network error, rate limit, malformed
response) this provider fails *safe*: it logs the error and returns a
low-confidence "normal" result rather than raising, so a flaky API call never
takes down live camera monitoring or fabricates an incident.

Demo Mode (`simulate()`) intentionally does NOT call Gemini — it reuses the
same guaranteed-reliable templates as the other providers, so a live demo
never depends on third-party API availability or latency.
"""

import base64
import json
import random
import re
from datetime import datetime, timezone

import cv2
import numpy as np
import requests

from app.config import settings
from app.models.detection import DetectionResult
from app.providers.base import DetectionProvider
from app.providers.demo_provider import SCENARIO_TEMPLATES

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

VALID_TYPES = {"physical_altercation", "road_accident", "fire_smoke", "person_fall", "normal"}
VALID_SEVERITIES = {"low", "medium", "high", "critical"}

PROMPT = """You are a public-safety event classifier for a city camera monitoring system.
Analyze the image and determine whether it shows one of a fixed set of safety-relevant events.

Do NOT identify, name, or describe any specific individual, face, or identity. Only describe
the event or activity taking place, in general terms.

Classification guide:
- physical_altercation: people fighting, pushing, or striking each other (not playing/hugging)
- road_accident: a vehicle collision, crash debris, or an overturned vehicle
- fire_smoke: visible flames or smoke
- person_fall: a person who has fallen or is lying on the ground in a way suggesting injury
- normal: ordinary activity with no safety-relevant event

Respond with ONLY a single JSON object, no markdown or code fences, in exactly this shape:
{"incident_type": "<one of the five classes above>", "confidence": <number 0-1>, "severity": "<low|medium|high|critical>", "description": "<one short sentence, no names or identities>", "detected_objects": ["<short generic label>", ...]}

If the scene shows no safety concern, or you are uncertain, return "normal" with high confidence.
"""


class GeminiProvider(DetectionProvider):
    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set — required when AI_PROVIDER=gemini")
        self._api_key = settings.gemini_api_key
        self._model = settings.gemini_model
        self._url = GEMINI_ENDPOINT.format(model=self._model)

    def detect(self, frame: np.ndarray, camera_id: str) -> DetectionResult:
        try:
            ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ok:
                raise ValueError("Failed to encode frame as JPEG")
            image_b64 = base64.b64encode(buffer.tobytes()).decode("ascii")

            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": PROMPT},
                            {"inline_data": {"mime_type": "image/jpeg", "data": image_b64}},
                        ]
                    }
                ],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
            }

            response = requests.post(
                self._url,
                params={"key": self._api_key},
                json=payload,
                timeout=15,
            )
            response.raise_for_status()

            text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
            return self._parse(text)

        except Exception as exc:  # noqa: BLE001 - deliberate catch-all for graceful degradation
            print(f"[gemini_provider] detection failed for {camera_id}: {exc}")
            return DetectionResult(
                incident_type="normal",
                confidence=0.5,
                severity="low",
                description="AI service could not reach Gemini; treating frame as normal",
                detected_objects=[],
                timestamp=datetime.now(timezone.utc).isoformat(),
            )

    def simulate(self, scenario: str, camera_id: str) -> DetectionResult:
        # Demo Mode must always work regardless of third-party API availability.
        template = SCENARIO_TEMPLATES[scenario]
        return DetectionResult(
            incident_type=template["incident_type"],
            confidence=round(random.uniform(*template["confidence_range"]), 2),
            severity=template["severity"],
            description=template["description"],
            detected_objects=template["detected_objects"],
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    def _parse(self, text: str) -> DetectionResult:
        cleaned = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
        data = json.loads(cleaned)

        incident_type = data.get("incident_type", "normal")
        if incident_type not in VALID_TYPES:
            incident_type = "normal"

        severity = data.get("severity", "low")
        if severity not in VALID_SEVERITIES:
            severity = "low"

        confidence = float(data.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))

        detected_objects = data.get("detected_objects", [])
        if not isinstance(detected_objects, list):
            detected_objects = []
        detected_objects = [str(o) for o in detected_objects][:10]

        description = str(data.get("description", "")) or "No description provided"

        return DetectionResult(
            incident_type=incident_type,
            confidence=confidence,
            severity=severity,
            description=description,
            detected_objects=detected_objects,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
