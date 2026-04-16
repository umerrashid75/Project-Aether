"""
POST /api/sitrep/generate
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import time
from app.models.db import Database
from app.models.schemas import Sitrep, Anomaly
from app.core.groq_agent import generate_sitrep

router = APIRouter()

class SitrepRequest(BaseModel):
    anomaly_id: str

# In-memory Token Bucket for Rate Limiting
class TokenBucket:
    def __init__(self, capacity=1, fill_rate=0.1): # 0.1 tokens/s = 1 per 10s
        self.capacity = capacity
        self.tokens = capacity
        self.fill_rate = fill_rate
        self.last_refill = time.time()
        
    def consume(self) -> bool:
        now = time.time()
        delta = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + delta * self.fill_rate)
        self.last_refill = now
        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False

bucket = TokenBucket()

# In-memory anomaly store for DEMO_MODE (no DB required)
_demo_anomalies: dict = {}

def register_demo_anomaly(anomaly: Anomaly):
    """Called by the anomaly detection loop to register in-memory for demo mode."""
    _demo_anomalies[anomaly.id] = anomaly

@router.post("/api/sitrep/generate")
async def generate_sitrep_endpoint(request: SitrepRequest):
    if not bucket.consume():
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait 10 seconds between reports.")

    demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"

    anomaly = None

    # Try DB first
    if getattr(Database, "db", None) is not None:
        doc = await Database.db["anomalies"].find_one({"id": request.anomaly_id})
        if doc:
            doc.pop("_id", None)
            anomaly = Anomaly(**doc)

    # Fallback: in-memory demo store
    if anomaly is None and demo_mode:
        anomaly = _demo_anomalies.get(request.anomaly_id)

    if anomaly is None:
        raise HTTPException(status_code=404, detail="Anomaly not found.")

    sitrep = await generate_sitrep(anomaly)

    # Persist to DB if available
    if getattr(Database, "db", None) is not None:
        await Database.db["sitreps"].insert_one(sitrep.dict())  # Pydantic v1
        await Database.db["anomalies"].update_one(
            {"id": request.anomaly_id},
            {"$set": {"sitrep_generated": True}}
        )

    return sitrep
