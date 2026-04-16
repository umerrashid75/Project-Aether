"""
Numeric threat scoring (0.0-1.0) to ThreatLevel mapping.
"""
from app.models.schemas import ThreatLevel

def calculate_threat_score(raw_score: float) -> ThreatLevel:
    if raw_score <= 0.39:
        return ThreatLevel.LOW
    elif raw_score <= 0.64:
        return ThreatLevel.MEDIUM
    elif raw_score <= 0.84:
        return ThreatLevel.HIGH
    else:
        return ThreatLevel.CRITICAL
