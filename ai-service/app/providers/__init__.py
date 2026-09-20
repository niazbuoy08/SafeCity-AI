from app.config import settings
from app.providers.base import DetectionProvider
from app.providers.demo_provider import DemoProvider
from app.providers.real_provider import RealCVProvider
from app.providers.gemini_provider import GeminiProvider


def get_provider() -> DetectionProvider:
    if settings.ai_provider == "real":
        return RealCVProvider()
    if settings.ai_provider == "gemini":
        return GeminiProvider()
    return DemoProvider()


provider = get_provider()
