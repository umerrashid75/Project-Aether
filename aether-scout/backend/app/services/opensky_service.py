"""
Polls OpenSky REST for ADS-B aircraft data.
"""
import httpx
import os
import logging
import asyncio
from datetime import datetime, timezone
import pymongo
from app.services import demo_fixtures
from app.models.db import Database
from app.models.schemas import AircraftState

logger = logging.getLogger(__name__)

async def poll_aircraft():
    """
    Background worker that polls aircraft data every 30 seconds.
    """
    while True:
        try:
            demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"
            states_array = []
            
            if demo_mode:
                states_array = demo_fixtures.get_aircraft()
                logger.info("Polled OpenSky (DEMO MODE) - got %d aircraft", len(states_array))
            else:
                user = os.getenv("OPENSKY_USERNAME")
                pwd = os.getenv("OPENSKY_PASSWORD")
                auth = (user, pwd) if user and pwd else None
                
                params = {
                    "lamin": 25.0,
                    "lomin": 54.0,
                    "lamax": 28.0,
                    "lomax": 59.0
                }
                
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        "https://opensky-network.org/api/states/all",
                        params=params,
                        auth=auth,
                        timeout=15.0
                    )
                    if response.status_code == 200:
                        data = response.json()
                        states_array = data.get("states", []) or []
                        logger.info("Polled OpenSky - got %d aircraft from API", len(states_array))
                    else:
                        logger.error("OpenSky API error: %d %s", response.status_code, response.text)

            # Process and upset into MongoDB by icao24
            if Database.db is not None and states_array:
                ops = []
                for s in states_array:
                    if not s or len(s) < 17:
                        continue
                        
                    # Column map
                    icao24, callsign, country, time_pos, last_contact, lon, lat, \
                    baro_alt, on_ground, vel, track, v_rate, sensors, geo_alt, squawk, spi, pos_src = s
                    
                    state_obj = AircraftState(
                        icao24=icao24,
                        callsign=callsign.strip() if callsign else None,
                        origin_country=country,
                        position=(float(lon), float(lat)) if lon is not None and lat is not None else None,
                        altitude_m=float(baro_alt) if baro_alt is not None else None,
                        velocity_ms=float(vel) if vel is not None else None,
                        timestamp=datetime.utcfromtimestamp(time_pos) if time_pos else datetime.utcnow()
                    )
                    
                    # Add to bulk upsert operations
                    ops.append(
                        pymongo.UpdateOne(
                            {"icao24": icao24},
                            {"$set": state_obj.dict()},
                            upsert=True
                        )
                    )
                
                if ops:
                    result = await Database.db["aircraft_states"].bulk_write(ops)
                    logger.debug("Upserted %d aircraft states", result.upserted_count + result.modified_count)

        except Exception as e:
            logger.error("Error polling OpenSky: %s", e)
            
        await asyncio.sleep(30)
