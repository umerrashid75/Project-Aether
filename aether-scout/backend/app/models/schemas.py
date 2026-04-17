from pydantic import BaseModel, Field
from typing import Optional, Literal, List, Dict, Any
from datetime import datetime
from enum import Enum
from uuid import uuid4

class AircraftState(BaseModel):
    icao24: str
    callsign: Optional[str] = None
    origin_country: str
    position: Optional[List[float]] = None # [lon, lat]
    altitude_m: Optional[float] = None
    velocity_ms: Optional[float] = None
    track: Optional[float] = None       # heading in degrees (for map rotation)
    squawk: Optional[str] = None        # transponder code (7700/7600/7500 = emergency)
    departure: Optional[str] = None     # departure ICAO
    destination: Optional[str] = None   # destination ICAO
    timestamp: datetime
    source: str = "opensky"

class VesselState(BaseModel):
    mmsi: str
    ship_name: Optional[str] = None
    ship_type: Optional[int] = None
    position: List[float] # [lon, lat]
    speed_knots: Optional[float] = None
    course: Optional[float] = None
    departure: Optional[str] = None
    destination: Optional[str] = None
    timestamp: datetime
    source: str = "aisstream"

class ThreatLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class Anomaly(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    anomaly_type: str 
    entity_id: str
    entity_type: str # "AIRCRAFT" | "VESSEL"
    position: List[float]
    threat_score: float
    threat_level: str
    details: Dict[str, Any]
    detected_at: datetime = Field(default_factory=datetime.utcnow)
    sitrep_generated: bool = False

class Sitrep(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    anomaly_id: str
    headline: str
    body: str
    confidence: float
    recommended_action: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
