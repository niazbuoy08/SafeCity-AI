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
    # Free-tier Gemini API keys have a small PER-DAY (not per-minute) request
    # quota that is tracked separately per model (e.g. 20/day for
    # gemini-2.5-flash at time of writing). If detections start failing with
    # "RESOURCE_EXHAUSTED" / 429 errors that persist regardless of how slowly
    # you send frames, the daily quota for this model is exhausted — either
    # wait for it to reset, switch to a different model here, or enable
    # billing on the Google Cloud project for a much higher quota.
    gemini_model: str = "gemini-3.1-flash-lite"

    port: int = 8000

    class Config:
        env_file = ".env"


settings = Settings()
