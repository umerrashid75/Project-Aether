"""
GET /api/telemetry/aircraft
GET /api/telemetry/vessels
"""
from fastapi import APIRouter
from app.models.db import Database

router = APIRouter()

@router.get("/api/telemetry/aircraft")
async def get_aircraft():
    if Database.db is None: return []
    cursor = Database.db["aircraft_states"].find({}, {"_id": 0})
    return [doc async for doc in cursor]

@router.get("/api/telemetry/vessels")
async def get_vessels():
    if Database.db is None: return []
    cursor = Database.db["vessel_states"].find({}, {"_id": 0})
    return [doc async for doc in cursor]
