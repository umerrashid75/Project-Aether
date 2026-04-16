"""
FastAPI application factory and main entry point.
"""
import os
import logging
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pymongo

from app.models.db import Database
from app.models.schemas import AircraftState, VesselState
from app.services.opensky_service import poll_aircraft
from app.services.aisstream_service import stream_vessels
from app.api import routes_ws, routes_sitrep, routes_telemetry, routes_vision

# Routers included after app instantiation below
from app.core.anomaly_engine import (
    detect_gnss_spoof_aircraft,
    detect_low_flight,
    detect_dark_transit,
    detect_gnss_spoof_vessel
)
from dotenv import load_dotenv

load_dotenv()

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def anomaly_detection_loop():
    """Background task evaluating rules every 60s."""
    prev_aircraft_states = {}
    prev_vessel_states = {}
    
    # Track recently emitted anomalies to prevent duplicates (15 minute cooldown)
    emitted_anomalies = {}

    while True:
        try:
            await asyncio.sleep(60)
            if Database.db is None:
                continue

            now = datetime.utcnow()
            new_anomalies = []
            
            # Fetch aircraft
            aircraft_cursor = Database.db["aircraft_states"].find({})
            current_aircraft_states = {}
            async for doc in aircraft_cursor:
                # remove mongo _id
                doc.pop("_id", None)
                try:
                    state = AircraftState(**doc)
                    current_aircraft_states[state.icao24] = state
                    
                    prev = prev_aircraft_states.get(state.icao24)
                    if prev:
                        anom = detect_gnss_spoof_aircraft(state, prev)
                        if anom: new_anomalies.append(anom)
                        
                    anom_low = detect_low_flight(state)
                    if anom_low: new_anomalies.append(anom_low)
                except Exception as e:
                    pass

            prev_aircraft_states = current_aircraft_states
            
            # Fetch vessels
            vessel_cursor = Database.db["vessel_states"].find({})
            current_vessel_states = {}
            async for doc in vessel_cursor:
                doc.pop("_id", None)
                try:
                    state = VesselState(**doc)
                    current_vessel_states[state.mmsi] = state
                    
                    prev = prev_vessel_states.get(state.mmsi)
                    if prev:
                        anom = detect_gnss_spoof_vessel(state, prev)
                        if anom: new_anomalies.append(anom)
                except Exception as e:
                    pass

            # Detect dark transits 
            for mmsi, state in prev_vessel_states.items():
                anom = detect_dark_transit(mmsi, state.timestamp, now)
                if anom:
                    anom.position = state.position # tag position of last known
                    new_anomalies.append(anom)

            prev_vessel_states = current_vessel_states
            
            # Filter new anomalies against emitted_anomalies to prevent duplicates
            filtered_anomalies = []
            for anom in new_anomalies:
                key = (anom.entity_id, anom.anomaly_type)
                last_emitted = emitted_anomalies.get(key, 0)
                if now.timestamp() - last_emitted > 900: # 15 minutes
                    filtered_anomalies.append(anom)
                    emitted_anomalies[key] = now.timestamp()
            
            # Clean up old emitted tracking to prevent memory leak
            emitted_anomalies = {k: v for k, v in emitted_anomalies.items() if now.timestamp() - v <= 900}
            
            if filtered_anomalies:
                ops = [pymongo.InsertOne(a.dict()) for a in filtered_anomalies]
                await Database.db["anomalies"].bulk_write(ops)
                
                # Broadcast fan-out
                for anom in filtered_anomalies:
                    await routes_ws.manager.broadcast(anom.json())
                    
                logger.info(f"Detected and published {len(filtered_anomalies)} new anomalies.")

        except Exception as e:
            logger.error(f"Error in anomaly detection loop: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to DB
    logger.info("Starting up Project Aether API...")
    try:
        await Database.connect()
    except Exception as e:
        logger.error(f"Startup DB connection failed: {e}")
        
    tasks = []
    demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"
    if Database.client is not None or demo_mode:
        logger.info("Starting Multiagent background services (Surveillance + Sentinel)...")
        tasks.append(asyncio.create_task(poll_aircraft()))
        tasks.append(asyncio.create_task(stream_vessels()))
        tasks.append(asyncio.create_task(anomaly_detection_loop()))
    else:
        logger.warning("No DB connection and DEMO_MODE=false — skipping background tasks.")
    
    yield
    
    # Shutdown: cancel background tasks and disconnect from DB
    for task in tasks:
        task.cancel()
    await Database.disconnect()

app = FastAPI(title="Project Aether API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_ws.router)
app.include_router(routes_sitrep.router)
app.include_router(routes_telemetry.router)
app.include_router(routes_vision.router)

@app.get("/health")
async def health_check():
    demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"
    db_status = "connected" if Database.client is not None else "disconnected"
    return {"status": "ok", "demo_mode": demo_mode, "database": db_status}
