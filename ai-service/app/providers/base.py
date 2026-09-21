from abc import ABC, abstractmethod
import numpy as np

from app.models.detection import DetectionResult


class DetectionProvider(ABC):
    """
    Common interface every detection backend must implement.

    Swapping AI_PROVIDER between "demo" and "real" (or a future trained model)
    only requires implementing this interface — nothing in main.py or the
    backend needs to change.
    """

    @abstractmethod
    def detect(self, frame: np.ndarray, camera_id: str) -> DetectionResult:
        """Analyze a single BGR image frame and return a structured detection."""
        raise NotImplementedError

    @abstractmethod
    def simulate(self, scenario: str, camera_id: str) -> DetectionResult:
        """Produce a realistic detection for a simulate-endpoint request, with no frame required."""
        raise NotImplementedError
