"""
GET /api/anomalies
Supports optional query params: anomaly_type, limit, sort
"""
from fastapi import APIRouter, Query
from typing import Optional
from app.models.db import Database

router = APIRouter()


@router.get("/api/anomalies")
async def get_anomalies(
    anomaly_type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    sort: Optional[str] = Query(None),   # "threat_score" → descending by score
):
    # Import here to avoid circular imports
    from app.api.routes_sitrep import _demo_anomalies
    import os

    query: dict = {}
    if anomaly_type:
        query["anomaly_type"] = anomaly_type

    results = []

    # Try DB first
    if getattr(Database, "db", None) is not None:
        import pymongo
        sort_field = "threat_score" if sort == "threat_score" else "detected_at"
        cursor = Database.db["anomalies"].find(query, {"_id": 0}) \
            .sort(sort_field, pymongo.DESCENDING) \
            .limit(limit)
        async for doc in cursor:
            results.append(doc)
    else:
        # Fallback: in-memory demo store
        demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"
        if demo_mode:
            all_anomalies = list(_demo_anomalies.values())
            if anomaly_type:
                all_anomalies = [a for a in all_anomalies if a.anomaly_type == anomaly_type]
            if sort == "threat_score":
                all_anomalies.sort(key=lambda a: a.threat_score, reverse=True)
            else:
                all_anomalies.sort(key=lambda a: a.detected_at, reverse=True)
            results = [a.dict() for a in all_anomalies[:limit]]

    # Convert datetime objects to ISO strings for JSON serialisation
    for doc in results:
        if "detected_at" in doc and hasattr(doc["detected_at"], "isoformat"):
            doc["detected_at"] = doc["detected_at"].isoformat()

    return {"anomalies": results}
