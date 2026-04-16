"""
POST /api/vision/detect
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.yolo_service import detect_ships_in_tile

router = APIRouter()

class VisionRequest(BaseModel):
    tile_url: str

@router.post("/api/vision/detect")
async def detect_vision(request: VisionRequest):
    if not request.tile_url:
        raise HTTPException(status_code=400, detail="Missing tile_url")
    
    results = await detect_ships_in_tile(request.tile_url)
    
    if "error" in results:
        raise HTTPException(status_code=500, detail=results["error"])
        
    return results
