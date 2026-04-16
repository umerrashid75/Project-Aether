"""
Pure heuristic logic for anomaly detection — no I/O.
"""
from app.models.schemas import AircraftState, VesselState, Anomaly, ThreatLevel
import math
from datetime import datetime
from uuid import uuid4
from app.core.threat_scorer import calculate_threat_score

def haversine(lon1, lat1, lon2, lat2):
    """Calculate the great circle distance in kilometers between two points on the earth."""
    lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371
    return c * r

def is_over_land(lon, lat):
    if lat > 26.8: # Iran coast approx
        return True
    if lat < 26.0 and lon < 56.0: # UAE approx
        return True
    if lat < 24.5 and lon > 56.0: # Oman approx
        return True
    return False

def detect_gnss_spoof_aircraft(state: AircraftState, prev: AircraftState) -> Anomaly:
    if not state.position or not prev.position:
        return None
        
    dist_km = haversine(prev.position[0], prev.position[1], state.position[0], state.position[1])
    over_land = is_over_land(state.position[0], state.position[1])
    
    # 50km jump between 30s polls with no velocity justification
    max_possible_dist = (state.velocity_ms or 300) * 30 / 1000.0 * 2
    
    if dist_km > 50 and dist_km > max_possible_dist:
        score = min(0.7 + (dist_km / 500) * 0.2, 0.9)
        return Anomaly(
            anomaly_type="gnss_spoof",
            entity_id=state.icao24,
            entity_type="aircraft",
            position=list(state.position),
            threat_score=score,
            threat_level=calculate_threat_score(score),
            details={"distance_jumped_km": round(dist_km, 2), "reason": "Impossible positional leap"}
        )
        
    if over_land and state.altitude_m and state.altitude_m < 5000:
        return Anomaly(
            anomaly_type="gnss_spoof",
            entity_id=state.icao24,
            entity_type="aircraft",
            position=list(state.position),
            threat_score=0.75,
            threat_level=calculate_threat_score(0.75),
            details={"reason": "Low-altitude position spoofed over restricted landmass"}
        )
        
    return None

def detect_low_flight(state: AircraftState) -> Anomaly:
    if not state.position or not state.altitude_m or not state.velocity_ms:
        return None

    emergency_squawks = {"7700", "7600", "7500"}
    squawk = state.squawk or ""
        
    if state.velocity_ms > 100 and state.altitude_m < 9753:
        if squawk not in emergency_squawks:
            score = 0.5
            return Anomaly(
                anomaly_type="low_flight",
                entity_id=state.icao24,
                entity_type="aircraft",
                position=list(state.position),
                threat_score=score,
                threat_level=calculate_threat_score(score),
                details={"altitude_m": state.altitude_m, "velocity_ms": state.velocity_ms, "squawk": squawk, "reason": "Commercial aircraft below FL320 with no emergency declaration"}
            )
    return None

def detect_dark_transit(vessel_mmsi: str, last_seen: datetime, now: datetime) -> Anomaly:
    diff_secs = (now - last_seen).total_seconds()
    if diff_secs > 15 * 60:
        score = 0.7
        return Anomaly(
            anomaly_type="dark_transit",
            entity_id=vessel_mmsi,
            entity_type="vessel",
            position=[0.0, 0.0], # Replaced downstream with last known coords
            threat_score=score,
            threat_level=calculate_threat_score(score),
            details={"offline_seconds": round(diff_secs), "reason": "Vessel went dark (transmission gap > 15 mins)"}
        )
    return None

def detect_gnss_spoof_vessel(state: VesselState, prev: VesselState) -> Anomaly:
    if not state.position or not prev.position:
        return None
        
    dist_km = haversine(prev.position[0], prev.position[1], state.position[0], state.position[1])
    is_tanker = state.ship_type is not None and (80 <= state.ship_type <= 89)
        
    if is_tanker and state.speed_knots and state.speed_knots > 30:
        score = min(0.65 + ((state.speed_knots - 30) / 20) * 0.2, 0.85)
        return Anomaly(
            anomaly_type="speed_jump",
            entity_id=state.mmsi,
            entity_type="vessel",
            position=list(state.position),
            threat_score=score,
            threat_level=calculate_threat_score(score),
            details={"speed_knots": state.speed_knots, "ship_type": state.ship_type, "reason": "Tanker exceeding physical speed bounds"}
        )
        
    if dist_km > 20:
        score = min(0.70 + (dist_km / 100) * 0.15, 0.85)
        return Anomaly(
            anomaly_type="gnss_spoof",
            entity_id=state.mmsi,
            entity_type="vessel",
            position=list(state.position),
            threat_score=score,
            threat_level=calculate_threat_score(score),
            details={"distance_jumped_km": round(dist_km, 2), "reason": "Impossible vessel position jump"}
        )
        
    return None
