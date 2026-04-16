"""
POST /api/sitrep/generate
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import time
from app.models.db import Database
from app.models.schemas import Sitrep, Anomaly
from app.core.groq_agent import generate_sitrep

router = APIRouter()

class SitrepRequest(BaseModel):
    anomaly_id: str

# In-memory Token Bucket for Rate Limiting
class TokenBucket:
    def __init__(self, capacity=1, fill_rate=0.1): # 0.1 tokens per second = 1 per 10s
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

# Global instance
bucket = TokenBucket()

@router.post("/api/sitrep/generate")
async def generate_sitrep_endpoint(request: SitrepRequest):
    if not bucket.consume():
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait 10 seconds between reports.")
        
    if getattr(Database, "db", None) is None:
        raise HTTPException(status_code=503, detail="Database connection not available.")
        
    doc = await Database.db["anomalies"].find_one({"id": request.anomaly_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Anomaly not found.")
        
    anomaly = Anomaly(**doc)
    
    # Run Groq agent async generator
    sitrep = await generate_sitrep(anomaly)
    
    # Save the object to sitreps
    await Database.db["sitreps"].insert_one(sitrep.model_dump())
    
    # Flag parent anomaly as processed
    await Database.db["anomalies"].update_one(
        {"id": request.anomaly_id},
        {"$set": {"sitrep_generated": True}}
    )
    
    return sitrep
