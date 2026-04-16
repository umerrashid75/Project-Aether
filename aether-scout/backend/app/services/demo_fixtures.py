"""
Synthetic data fixtures for DEMO_MODE.
"""
from datetime import datetime
import random
from typing import List

def get_aircraft() -> List[dict]:
    """
    Returns a list of realistic aircraft objects formatted as they would be returned from OpenSky.
    In the OpenSky API array format:
    [icao24, callsign, origin_country, time_position, last_contact,
     longitude, latitude, baro_altitude, on_ground, velocity, true_track,
     vertical_rate, sensors, geo_altitude, squawk, spi, position_source]
    """
    now = int(datetime.utcnow().timestamp())
    
    # Mock OpenSky data for English Channel
    profiles = [
        {"icao24": "8960e6", "callsign": "BAW77   ", "country": "United Kingdom", "squawk": "2311"},
        {"icao24": "a3b4c5", "callsign": "EZY123  ", "country": "United Kingdom", "squawk": "2312"},
        {"icao24": "73809e", "callsign": "AFR234  ", "country": "France", "squawk": "3341"},
        {"icao24": "4ca25b", "callsign": "RYR456  ", "country": "Ireland", "squawk": "4451"}
    ]
    
    aircraft_list = []
    
    for p in profiles:
        lng = random.uniform(54.0, 59.0)
        lat = random.uniform(25.0, 28.0)
        # Random altitude mostly at standard cruising (9000 - 11000 m)
        # Occasional low flyer for anomaly testing
        alt = random.uniform(3000, 11000)
        vel = random.uniform(150, 260)
        track = random.uniform(0, 360)
        
        aircraft_list.append([
            p["icao24"],
            p["callsign"],
            p["country"],
            now,            # time_position
            now,            # last_contact
            lng,            # longitude
            lat,            # latitude
            alt,            # baro_altitude
            False,          # on_ground
            vel,            # velocity
            track,          # true_track
            0.0,            # vertical_rate
            None,           # sensors
            alt,            # geo_altitude
            p["squawk"],    # squawk
            False,          # spi
            0               # position_source
        ])
        
    return aircraft_list

def get_vessels() -> list[dict]:
    """
    Returns a list of synthetic AISStream PositionReport messages.
    """
    # Mock AISStream data for English Channel
    profiles = [
        {"mmsi": "235071110", "name": "DOVER SPIRIT", "type": 80}, # Tanker
        {"mmsi": "227445780", "name": "CALAIS EXPRESS", "type": 70}, # Cargo
        {"mmsi": "235012345", "name": "P&O PIONEER", "type": 60}, # Passenger
        {"mmsi": "228067890", "name": "LE HARVE GLORY", "type": 80}
    ]
    
    messages = []
    base_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    
    for p in profiles:
        lng = random.uniform(54.0, 59.0)
        lat = random.uniform(25.0, 28.0)
        sog = random.uniform(8.0, 16.0) # Speed over ground in knots
        cog = random.uniform(0, 360) # Course
        
        msg = {
            "MessageType": "PositionReport",
            "MetaData": {
                "MMSI": int(p["mmsi"]),
                "ShipName": p["name"],
                "time_utc": base_time,
                "ShipType": p["type"]
            },
            "Message": {
                "PositionReport": {
                    "UserID": int(p["mmsi"]),
                    "Latitude": lat,
                    "Longitude": lng,
                    "Sog": sog,
                    "Cog": cog
                }
            }
        }
        messages.append(msg)
        
    return messages
