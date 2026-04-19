import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.active_region import active_region
from app.core.regions import get_all_regions, get_region

router = APIRouter(prefix="/api/region", tags=["region"])


class SetRegionRequest(BaseModel):
    region_id: str


@router.get("/list")
async def list_regions():
    return {
        "regions": get_all_regions(),
        "active_region_id": active_region.region_id,
    }


@router.get("/active")
async def get_active():
    return {
        "region_id": active_region.region_id,
        "config": active_region.config,
    }


@router.post("/set")
async def set_region(body: SetRegionRequest):
    if not get_region(body.region_id):
        raise HTTPException(
            status_code=404,
            detail=f"Unknown region '{body.region_id}'. Valid: {list(get_all_regions().keys())}",
        )
    config = await active_region.set_region(body.region_id)
    return {
        "success": True,
        "region_id": body.region_id,
        "config": config,
    }


@router.get("/coverage/{region_id}")
async def live_coverage(region_id: str):
    config = get_region(region_id)
    if not config:
        raise HTTPException(status_code=404, detail="Region not found")

    if os.getenv("DEMO_MODE", "false").lower() == "true":
        counts = {
            "excellent": {"aircraft": 18, "vessels": 45},
            "very_good": {"aircraft": 12, "vessels": 30},
            "good": {"aircraft": 6, "vessels": 15},
            "poor": {"aircraft": 1, "vessels": 2},
        }
        quality = config["opensky_quality"]
        return {
            "region_id": region_id,
            **counts.get(quality, {"aircraft": 0, "vessels": 0}),
            "source": "demo",
        }

    bbox = config["bbox"]
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://opensky-network.org/api/states/all",
                params={
                    "lamin": bbox[0],
                    "lomin": bbox[1],
                    "lamax": bbox[2],
                    "lomax": bbox[3],
                },
            )
            data = resp.json()
            count = len(data.get("states") or [])
    except Exception:
        count = 0

    return {
        "region_id": region_id,
        "aircraft": count,
        "vessels": None,
        "source": "live",
    }
