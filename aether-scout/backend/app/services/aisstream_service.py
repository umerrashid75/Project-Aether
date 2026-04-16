"""
WebSocket consumer for AIS vessel data from AISStream.io.
"""
import asyncio
import json
import os
import logging
import websockets
from datetime import datetime, timezone
import pymongo

from app.services import demo_fixtures
from app.models.db import Database
from app.models.schemas import VesselState

logger = logging.getLogger(__name__)

async def process_position_report(data: dict):
    """Parses a PositionReport dict and upserts into DB."""
    if data.get("MessageType") != "PositionReport":
        return
        
    metadata = data.get("MetaData", {})
    msg_body = data.get("Message", {}).get("PositionReport", {})
    
    mmsi = str(metadata.get("MMSI") or msg_body.get("UserID"))
    if not mmsi or mmsi == "None":
        return
        
    lat = msg_body.get("Latitude")
    lon = msg_body.get("Longitude")
    
    if lat is None or lon is None or not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        return
        
    # Attempt to parse time, or use now
    time_str = metadata.get("time_utc")
    timestamp = datetime.utcnow()
    if time_str:
        try:
            # AISStream format example: 2026-04-16 12:00:00 UTC
            clean_time_str = time_str.replace(" UTC", "")
            parsed_time = datetime.strptime(clean_time_str, "%Y-%m-%d %H:%M:%S")
            timestamp = parsed_time
        except ValueError:
            pass

    state_obj = VesselState(
        mmsi=mmsi,
        ship_name=metadata.get("ShipName", "").strip() or None,
        ship_type=metadata.get("ShipType"),
        position=(float(lon), float(lat)),
        speed_knots=float(msg_body.get("Sog")) if msg_body.get("Sog") is not None else None,
        course=float(msg_body.get("Cog")) if msg_body.get("Cog") is not None else None,
        timestamp=timestamp
    )
    
    if Database.db is not None:
        await Database.db["vessel_states"].update_one(
            {"mmsi": mmsi},
            {"$set": state_obj.dict()},
            upsert=True
        )

async def stream_vessels():
    """
    Background worker that streams or polls vessel data.
    If in demo mode, generates periodic updates.
    Otherwise, consumes via websocket with exponential backoff on disconnect.
    """
    demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"
    
    if demo_mode:
        while True:
            try:
                mock_messages = demo_fixtures.get_vessels()
                for msg in mock_messages:
                    await process_position_report(msg)
                logger.info("Processed %d synthetic vessel updates (DEMO MODE)", len(mock_messages))
            except Exception as e:
                logger.error(f"Error processing synthetic vessel data: {e}")
            # wait before next demo update
            await asyncio.sleep(10)
    else:
        api_key = os.getenv("AISSTREAM_API_KEY", "")
        if not api_key:
            logger.warning("AISSTREAM_API_KEY is not set. Vessel streaming will not work.")
            return

        reconnect_delays = [1, 2, 4, 8, 16, 30]
        delay_index = 0
        
        subscribe_message = {
            "APIKey": api_key,
            "BoundingBoxes": [[[25.0, 54.0], [28.0, 59.0]]],
            "FilterMessageTypes": ["PositionReport"]
        }

        while True:
            try:
                async with websockets.connect("wss://stream.aisstream.io/v0/stream") as ws:
                    logger.info("Connected to AISStream WebSocket.")
                    await ws.send(json.dumps(subscribe_message))
                    delay_index = 0 # reset on successful connection
                    
                    while True:
                        message = await ws.recv()
                        data = json.loads(message)
                        await process_position_report(data)
                        
            except websockets.exceptions.ConnectionClosed:
                logger.warning("AISStream WebSocket connection closed.")
            except Exception as e:
                logger.error(f"AISStream WebSocket error: {e}")

            delay = reconnect_delays[delay_index]
            logger.info(f"Reconnecting AISStream in {delay} seconds...")
            await asyncio.sleep(delay)
            if delay_index < len(reconnect_delays) - 1:
                delay_index += 1
