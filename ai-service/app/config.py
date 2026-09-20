from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Runtime configuration for the AI Detection Service.

    AI_PROVIDER selects which detector implementation handles /api/detect:
      - "demo": deterministic, dependency-free provider used for reliable demos.
      - "real": lightweight OpenCV heuristic provider (color/edge/motion based).
      - "gemini": sends the frame to Google's Gemini vision model for genuine
        multimodal scene understanding. Requires GEMINI_API_KEY.
    All three implement the same DetectionProvider interface, so the rest of
    the system (backend, dashboard) behaves identically regardless of which
    is active.
    """

    ai_provider: str = "demo"

    confidence_ignore_below: float = 60.0  # percent
    confidence_high_above: float = 80.0  # percent

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    port: int = 8000

    class Config:
        env_file = ".env"


settings = Settings()
