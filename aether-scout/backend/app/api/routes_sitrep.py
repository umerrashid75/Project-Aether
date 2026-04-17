"""
POST /api/sitrep/generate
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import time
from app.models.db import Database
from app.models.schemas import Sitrep, Anomaly, AircraftState, VesselState
from app.core.groq_agent import generate_sitrep
import pymongo

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

@router.get("/api/sitrep/diagnostic/groq")
async def diagnostic_groq_healthcheck():
    import os
    from groq import AsyncGroq
    api_key = os.getenv("GROQ_API_KEY", "")
    
    if not api_key:
        return {"status": "error", "message": "GROQ_API_KEY not found in environment variables."}
        
    try:
        client = AsyncGroq(api_key=api_key)
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "Respond with exactly the word 'OPERATIONAL'."}],
            max_tokens=10
        )
        msg = response.choices[0].message.content.strip()
        return {"status": "success", "message": "Groq API connected successfully to AETHER-ANALYST.", "model_response": msg}
    except Exception as e:
        return {"status": "error", "message": f"Groq API connection failed: {e}"}

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

    # Context Retrieval: Fetch current and previous states for the entity
    state = None
    prev_state = None
    
    if getattr(Database, "db", None) is not None:
        collection_name = "aircraft_states" if anomaly.entity_type.lower() == "aircraft" else "vessel_states"
        id_field = "icao24" if anomaly.entity_type.lower() == "aircraft" else "mmsi"
        
        # Get last 2 states to provide delta context
        cursor = Database.db[collection_name].find(
            {id_field: anomaly.entity_id}
        ).sort("timestamp", pymongo.DESCENDING).limit(2)
        
        states_docs = [doc async for doc in cursor]
        if states_docs:
            for s in states_docs: s.pop("_id", None)
            
            if len(states_docs) >= 1:
                state_cls = AircraftState if anomaly.entity_type.lower() == "aircraft" else VesselState
                state = state_cls(**states_docs[0])
            if len(states_docs) >= 2:
                prev_state = state_cls(**states_docs[1])

    sitrep = await generate_sitrep(anomaly, state, prev_state)
    
    if sitrep is None:
        # This happens if skipped (e.g. LOW threat)
        return {"id": "skipped", "anomaly_id": anomaly.id, "headline": "No analysis required", "body": "Threat level below SITREP generation threshold."}

    # Persist to DB if available
    if getattr(Database, "db", None) is not None:
        await Database.db["sitreps"].insert_one(sitrep.dict())  # Pydantic v1
        await Database.db["anomalies"].update_one(
            {"id": request.anomaly_id},
            {"$set": {"sitrep_generated": True}}
        )

    return sitrep
