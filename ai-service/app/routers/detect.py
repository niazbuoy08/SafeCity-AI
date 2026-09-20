import numpy as np
import cv2
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.models.detection import DetectionResult, SimulateRequest
from app.providers import provider
from app.config import settings

router = APIRouter()


@router.post("/detect", response_model=DetectionResult)
async def detect(file: UploadFile = File(...), camera_id: str = Form(...)) -> DetectionResult:
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file upload")

    array = np.frombuffer(contents, dtype=np.uint8)
    frame = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    result = provider.detect(frame, camera_id)
    return result


@router.post("/simulate", response_model=DetectionResult)
async def simulate(payload: SimulateRequest) -> DetectionResult:
    return provider.simulate(payload.scenario, payload.camera_id)


@router.get("/config")
async def config():
    return {
        "provider": settings.ai_provider,
        "confidence_ignore_below": settings.confidence_ignore_below,
        "confidence_high_above": settings.confidence_high_above,
        "supported_classes": [
            "physical_altercation",
            "road_accident",
            "fire_smoke",
            "person_fall",
            "normal",
        ],
    }
