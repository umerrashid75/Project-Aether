"""
YOLOv8 ship detection service for satellite imagery analysis.
"""
import os
import logging
import httpx
import asyncio
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Optional import for ultralytics
YOLO_AVAILABLE = False
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    logger.warning("ultralytics not installed. YOLOv8 detection will be unavailable or use mocks.")

async def detect_ships_in_tile(tile_url: str) -> Dict[str, Any]:
    """
    Downloads a satellite tile and runs ship detection.
    Supports DEMO_MODE for synthetic results.
    """
    demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"
    
    if demo_mode or not YOLO_AVAILABLE:
        # Synthetic high-fidelity ship detection results
        logger.info("Using mock ship detection results (DEMO_MODE or YOLO unavailable)")
        await asyncio.sleep(0.8) # Realistic analysis time
        return {
            "tile_url": tile_url,
            "detections": [
                {"bbox": [142, 87, 38, 22], "confidence": 0.83, "class": "vessel", "estimated_length_m": 180},
                {"bbox": [380, 210, 29, 18], "confidence": 0.71, "class": "vessel", "estimated_length_m": 140},
                {"bbox": [95, 301, 12, 8],  "confidence": 0.52, "class": "small_craft", "estimated_length_m": 40}
            ],
            "ship_count": 3,
            "analysis_time_ms": 847,
            "model": "yolov8n",
            "is_mock": True,
            "note": "DEMO MODE — synthetic detections"
        }

    try:
        # Real YOLOv8 Implementation
        # 1. Download image
        async with httpx.AsyncClient() as client:
            response = await client.get(tile_url)
            if response.status_code != 200:
                raise Exception(f"Failed to download image: {response.status_code}")
            image_content = response.content

        # 2. Save temporarily or process in-memory
        temp_path = "temp_tile.jpg"
        with open(temp_path, "wb") as f:
            f.write(image_content)

        # 3. Load model and run inference
        # Using yolov8n.pt (Nano) for speed/size - downloads on first call
        model = YOLO("yolov8n.pt")
        results = model(temp_path)

        # 4. Filter for class "boat" (COCO index 8)
        detections = []
        for result in results:
            for box in result.boxes:
                if int(box.cls) == 8: # 8 is boat in COCO
                    detections.append({
                        "class": "boat",
                        "confidence": float(box.conf),
                        "bbox": box.xywh[0].tolist() # [x_center, y_center, width, height]
                    })

        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)

        return {
            "source": tile_url,
            "ships_detected": len(detections),
            "detections": detections,
            "is_mock": False
        }

    except Exception as e:
        logger.error(f"Error in YOLO detection: {e}")
        return {
            "error": str(e),
            "ships_detected": 0,
            "detections": []
        }
