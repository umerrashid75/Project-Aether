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
    
    # Base aircraft profiles
    profiles = [
        {"icao24": "8960e6", "callsign": "UAE77   ", "country": "United Arab Emirates", "squawk": "2311"},
        {"icao24": "06a213", "callsign": "QTR11   ", "country": "Qatar", "squawk": "1455"},
        {"icao24": "73809e", "callsign": "IRB234  ", "country": "Iran", "squawk": "3341"},
        {"icao24": "400a20", "callsign": "BAW104  ", "country": "United Kingdom", "squawk": "5122"},
        {"icao24": "3c66a8", "callsign": "DLH624  ", "country": "Germany", "squawk": "1143"},
        {"icao24": "7100b2", "callsign": "SVA122  ", "country": "Saudi Arabia", "squawk": "0421"},
        {"icao24": "0d07cc", "callsign": "OMA14   ", "country": "Oman", "squawk": "2214"},
        {"icao24": "aa1c96", "callsign": "AAL10   ", "country": "United States", "squawk": "1122"},
        {"icao24": "4ca83c", "callsign": "RYR802  ", "country": "Ireland", "squawk": "1000"},
        {"icao24": "880521", "callsign": "ETH721  ", "country": "Ethiopia", "squawk": "5500"},
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

def get_vessels() -> list:
    """
    Returns a list of synthetic AISStream PositionReport messages.
    """
    profiles = [
        {"mmsi": "353136000", "name": "FRONT FALCON", "type": 80}, # 80 is Tanker
        {"mmsi": "415053000", "name": "MT NAVIGATOR", "type": 81},
        {"mmsi": "538006764", "name": "SEAWAYS KINETIC", "type": 80},
        {"mmsi": "636015509", "name": "PACIFIC GOLD", "type": 84},
        {"mmsi": "477028100", "name": "HONG KONG STAR", "type": 70}, # Cargo
        {"mmsi": "373735000", "name": "BW TULIP", "type": 80},
        {"mmsi": "211516000", "name": "HMM ALGECIRAS", "type": 70},
        {"mmsi": "258079000", "name": "NORDIC FREEDOM", "type": 80},
        {"mmsi": "422038700", "name": "HORMUZ PRIDE", "type": 80},
        {"mmsi": "235109000", "name": "ROYAL GLORY", "type": 89},
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
