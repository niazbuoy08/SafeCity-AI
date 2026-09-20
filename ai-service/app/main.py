from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import detect

app = FastAPI(
    title="SafeCity AI - Detection Service",
    description=(
        "Standalone computer-vision microservice for SafeCity AI. "
        "Detects public-safety events (physical altercations, road accidents, "
        "fire/smoke, person falls) from camera frames. Does NOT perform facial "
        "recognition or identity tracking of any kind."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(detect.router, prefix="/api", tags=["detection"])


@app.get("/")
async def root():
    return {
        "service": "safecity-ai-detection-service",
        "status": "ok",
        "provider": settings.ai_provider,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
