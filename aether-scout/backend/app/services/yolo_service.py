"""
YOLOv8 ship detection service for satellite imagery analysis.
Imagery Agent — triggered only for CRITICAL anomalies.
"""

import os
import logging
import httpx
import asyncio
import time
import tempfile
import importlib
import importlib.util
from typing import Dict, Any

logger = logging.getLogger(__name__)


def _is_ultralytics_available() -> bool:
    """Check package availability without importing heavy runtime deps."""
    try:
        return importlib.util.find_spec("ultralytics") is not None
    except Exception:
        return False


async def detect_ships_in_tile(tile_url: str) -> Dict[str, Any]:
    """
    Downloads a satellite tile and runs ship detection.
    Supports DEMO_MODE for synthetic results.
    """
    demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"
    yolo_enabled = os.getenv("ENABLE_YOLO", "true").lower() == "true"
    yolo_available = _is_ultralytics_available()

    if demo_mode or not yolo_enabled or not yolo_available:
        # Synthetic high-fidelity ship detection results
        if demo_mode:
            fallback_reason = "DEMO_MODE enabled"
        elif not yolo_enabled:
            fallback_reason = "ENABLE_YOLO disabled"
        else:
            fallback_reason = "YOLO unavailable"

        logger.info(f"Using mock ship detection results ({fallback_reason})")
        await asyncio.sleep(0.8)  # Realistic analysis time
        return {
            "source": tile_url,
            "detections": [
                {
                    "bbox": [142, 87, 38, 22],
                    "confidence": 0.83,
                    "class": "vessel",
                    "estimated_length_m": 180,
                },
                {
                    "bbox": [380, 210, 29, 18],
                    "confidence": 0.71,
                    "class": "vessel",
                    "estimated_length_m": 140,
                },
                {
                    "bbox": [95, 301, 12, 8],
                    "confidence": 0.52,
                    "class": "small_craft",
                    "estimated_length_m": 40,
                },
            ],
            "ships_detected": 3,
            "analysis_time_ms": 847,
            "model": "yolov8n",
            "is_mock": True,
            "note": f"Synthetic detections ({fallback_reason})",
        }

    temp_path = None
    started_at = time.perf_counter()
    try:
        # Real YOLOv8 Implementation
        # 1. Download image
        async with httpx.AsyncClient() as client:
            response = await client.get(tile_url)
            if response.status_code != 200:
                raise Exception(f"Failed to download image: {response.status_code}")
            image_content = response.content

        # 2. Save temporarily
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            temp_path = temp_file.name
            temp_file.write(image_content)

        # 3. Lazy import — keeps ultralytics strictly isolated in this agent
        ultralytics_module = importlib.import_module("ultralytics")
        YOLO = getattr(ultralytics_module, "YOLO")

        # 4. Load model and run inference (yolov8n.pt downloads on first run)
        model = YOLO("yolov8n.pt")
        results = model(temp_path)

        # 5. Filter for class "boat" (COCO index 8)
        detections = []
        for result in results:
            for box in result.boxes:
                if int(box.cls) == 8:  # 8 is boat in COCO
                    detections.append(
                        {
                            "class": "boat",
                            "confidence": float(box.conf),
                            "bbox": box.xywh[
                                0
                            ].tolist(),  # [x_center, y_center, width, height]
                        }
                    )

        analysis_time_ms = int((time.perf_counter() - started_at) * 1000)

        return {
            "source": tile_url,
            "ships_detected": len(detections),
            "detections": detections,
            "analysis_time_ms": analysis_time_ms,
            "model": "yolov8n",
            "is_mock": False,
        }

    except Exception as e:
        logger.error(f"Error in YOLO detection: {e}")
        await asyncio.sleep(0.2)
        return {
            "source": tile_url,
            "ships_detected": 0,
            "detections": [],
            "analysis_time_ms": int((time.perf_counter() - started_at) * 1000),
            "model": "yolov8n",
            "is_mock": True,
            "note": "YOLO failed, returned empty fallback",
            "fallback_reason": str(e),
        }
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
