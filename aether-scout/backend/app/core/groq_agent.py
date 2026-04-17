"""
Llama 3.3 tool-calling agent using Groq Cloud SDK.
"""
import os
import json
import logging
import math
from datetime import datetime
from typing import Union
from groq import AsyncGroq
from app.models.schemas import Anomaly, Sitrep, AircraftState, VesselState, ThreatLevel

logger = logging.getLogger(__name__)

tools = [
    {
        "type": "function",
        "function": {
            "name": "lookup_vessel_registry",
            "description": "Look up a vessel by MMSI or aircraft by ICAO24 in public registries. Returns owner, flag state, vessel type, and route history.",
            "parameters": {
                "type": "object",
                "properties": {
                    "entity_id": {"type": "string"},
                    "entity_type": {"type": "string", "enum": ["vessel", "aircraft"]}
                },
                "required": ["entity_id", "entity_type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_sanctions_list",
            "description": "Check if an entity appears on OFAC, EU, or UN maritime sanctions lists.",
            "parameters": {
                "type": "object",
                "properties": {
                    "entity_id": {"type": "string"},
                    "flag_state": {"type": "string"}
                },
                "required": ["entity_id"]
            }
        }
    }
]

def mock_lookup_vessel_registry(entity_id, entity_type):
    if entity_type == "vessel":
        return json.dumps({
            "registry": "United Kingdom",
            "owner": "P&O Ferries",
            "vessel_type": "Ro-Ro Passenger Ship",
            "route_history": "Dover to Calais transit"
        })
    else:
        return json.dumps({
            "registry": "France",
            "owner": "Air France",
            "aircraft_type": "Airbus A320"
        })

def mock_check_sanctions_list(entity_id, flag_state=None):
    return json.dumps({
        "on_ofac_list": False,
        "on_eu_list": False,
        "on_un_list": False,
        "notes": "No current sanctions found for entity."
    })

def calculate_tss_distance(position: list[float]) -> float:
    """
    Calculate distance in nautical miles from the simplified Dover Strait TSS centreline.
    Approximate centreline: (1.35, 51.0) to (1.55, 51.25)
    """
    if not position or len(position) < 2:
        return 0.0
    
    # Simplified point-to-line distance in degrees (approximate)
    # Line: y = mx + c => 1.25x - y + constant = 0
    # Center points in degrees
    x1, y1 = 1.35, 51.0
    x2, y2 = 1.65, 51.30
    
    px, py = position[0], position[1]
    
    # Distance from point (px, py) to line defined by (x1, y1) and (x2, y2)
    # dist = |(y2-y1)px - (x2-x1)py + x2y1 - y2x1| / sqrt((y2-y1)^2 + (x2-x1)^2)
    numerator = abs((y2-y1)*px - (x2-x1)*py + x2*y1 - y2*x1)
    denominator = math.sqrt((y2-y1)**2 + (x2-x1)**2)
    
    if denominator == 0: return 0.0
    dist_degrees = numerator / denominator
    
    # Approx 1 degree latitude = 60 nautical miles
    return dist_degrees * 60.0

def build_sitrep_prompt(anomaly: Anomaly, 
                         state: Union[AircraftState, VesselState],
                         prev_state: Union[AircraftState, VesselState, None]) -> str:
    
    tss_distance = calculate_tss_distance(state.position)  # nm from separation scheme
    
    # Extract speed and heading
    if isinstance(state, VesselState):
        speed = f"{state.speed_knots} knots"
        heading = f"{state.course}°"
        identifier = state.mmsi
        entity_type = "Vessel"
    else:
        speed = f"{round(state.velocity_ms * 1.944, 1)} knots"
        heading = f"{state.track}°"
        identifier = state.icao24
        entity_type = "Aircraft"
    
    prompt = f"""
ANOMALY REPORT FOR SITREP GENERATION

Anomaly ID: {anomaly.id}
Type: {anomaly.anomaly_type}
Detected: {anomaly.detected_at.strftime('%Y-%m-%dT%H:%M:%SZ')}

TELEMETRY SNAPSHOT:
- Entity: {identifier}
- Type: {entity_type}
- Position: {state.position[1]:.4f}°N, {state.position[0]:.4f}°E
- Distance from TSS centreline: {tss_distance:.1f} nautical miles
- Speed: {speed}
- Heading/Course: {heading}
- Altitude: {getattr(state, 'altitude_m', 'N/A')} m
- Flag/Origin: {getattr(state, 'origin_country', 'unknown') if hasattr(state, 'origin_country') else 'unknown'}

ANOMALY DETAILS:
{json.dumps(anomaly.details, indent=2)}

RAW THREAT SCORE: {anomaly.threat_score:.2f} / 1.00

{"PREVIOUS STATE (30s prior): " + str(prev_state.dict()) if prev_state else "PREVIOUS STATE: Not available (first detection)"}

Now call your tools, then generate the SITREP.
"""
    return prompt

SITREP_SYSTEM_PROMPT = """
You are AETHER-ANALYST, an intelligence officer for the Dover Strait Monitoring
Initiative. You produce Situation Reports (SITREPs) that read like they were
written by a trained analyst, not a chatbot.

ANALYTICAL STANDARDS:
- Never state the obvious. "Aircraft meets vessel" is not analysis.
- Always reason about WHY something is anomalous given the specific context.
- Acknowledge uncertainty explicitly. Use "assessed", "likely", "consistent with"
  rather than stating unverified facts as certain.
- Reference real-world context: Dover Strait separation scheme, TSS lanes,
  typical traffic patterns for vessel type and flag state.
- If the threat level is HIGH or CRITICAL, explain specifically what 
  worst-case scenario the data is consistent with — and what innocent 
  explanation also fits.
- Recommended action must be concrete and proportional to threat level.

THREAT CALIBRATION:
- A Ro-Ro ferry deviating 2nm from its lane is MEDIUM at most.
- CRITICAL is reserved for: AIS spoofing confirmed by cross-reference,
  vessel on sanctions list, or pattern matching known smuggling behavior.
- Do not escalate to CRITICAL without explicit evidence in the telemetry.

TONE: Dry, precise, professional. No dramatic language. 
Write as if this will be read by a coast guard commander at 3am.

OUTPUT FORMAT (follow exactly, no deviation):

**HEADLINE:** [Max 15 words. State the anomaly and entity — not the conclusion.]

**CLASSIFICATION:** UNCLASSIFIED // OSINT // FOR EDUCATIONAL USE ONLY

**ENTITY:** [ID] | [Type] | [Flag state if known] | [Vessel/aircraft type]

**ANOMALY:** [Type] detected at [coordinates] on [timestamp UTC]

**THREAT LEVEL:** [LOW/MEDIUM/HIGH/CRITICAL] — [one-sentence justification]

**CONFIDENCE:** [%] — [reason for uncertainty if below 80%]

**SITUATION ANALYSIS:**
[3–5 sentences. Cover: what the telemetry shows, what is anomalous about it
relative to normal traffic patterns in this area, what the registry check
reveals, and what the most plausible explanation is. Use specific numbers
from the telemetry — speed, heading, altitude, position relative to TSS lanes.]

**PATTERN ASSESSMENT:**
[2–3 sentences. Is this consistent with a known pattern — smuggling, AIS
manipulation, mechanical failure, weather deviation? What would confirm or
rule out each hypothesis?]

**REGISTRY INTELLIGENCE:**
[Tool result from lookup_vessel_registry, interpreted analytically. Note if
the flag state, owner, or route history is inconsistent with current behavior.]

**SANCTIONS STATUS:**
[Tool result from check_sanctions_list. If clean, say so briefly. If flagged,
state which list and when added.]

**RECOMMENDED ACTION:**
[One concrete sentence. Specific to threat level:
  LOW → "Continue monitoring at standard interval."
  MEDIUM → "Increase polling frequency to 5-minute intervals. Flag for watch officer review."
  HIGH → "Recommend HM Coastguard notification. Cross-reference with AIS aggregators."
  CRITICAL → "Immediate escalation to watch commander. Cross-reference with port authority vessel movements."]
"""

async def generate_sitrep(anomaly: Anomaly, 
                         state: Union[AircraftState, VesselState, None] = None,
                         prev_state: Union[AircraftState, VesselState, None] = None) -> Sitrep:
    # Skip SITREP for LOW threat — not worth the tokens
    if anomaly.threat_level == ThreatLevel.LOW:
        logger.info(f"SITREP Request: Skipping generation for LOW threat anomaly {anomaly.id}")
        return None

    demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"
    api_key = os.getenv("GROQ_API_KEY", "")

    # If state not provided and in demo mode, we might want to skip or use dummy
    if (demo_mode or not api_key) and not state:
        logger.info("Intelligence Agent: Generating high-fidelity mock SITREP (DEMO_MODE or no API key).")
        entity_type_label = anomaly.entity_type.upper()
        anomaly_label = anomaly.anomaly_type.replace("_", " ").upper()
        threat = anomaly.threat_level if isinstance(anomaly.threat_level, str) else anomaly.threat_level.value
        confidence = int(min(100, anomaly.threat_score * 100 + 5))

        # Registry and sanctions are simulated as the mock tool results would return
        registry_info = (
            "MMSI/ICAO registered in UK via P&O Ferries. "
            "Vessel type: Passenger Ro-Ro. Last port: Dover, UK. Route: Dover-to-Calais transit."
            if anomaly.entity_type == "vessel"
            else "ICAO24 registered France. Owner: Air France. Aircraft type: Airbus A320."
        )

        mock_body = f"""**HEADLINE:** {entity_type_label} {anomaly.entity_id} flagged for {anomaly_label} in English Channel corridor.
**CLASSIFICATION:** UNCLASSIFIED // OSINT // FOR EDUCATIONAL USE ONLY
**ENTITY:** {anomaly.entity_id} | {entity_type_label} | UK | Assessed Utility
**ANOMALY:** {anomaly_label} detected at {anomaly.position[1]:.4f}N, {anomaly.position[0]:.4f}E on {anomaly.detected_at.strftime('%Y-%m-%dT%H:%M:%SZ')}
**THREAT LEVEL:** {threat} — Automated surveillance detected {anomaly_label} event with threat score {anomaly.threat_score:.2f}.
**CONFIDENCE:** {confidence}% — Analysis suggests 30s telemetry gap.

**SITUATION ANALYSIS:**
Telemetry indicates entity {anomaly.entity_id} is operating within the Traffic Separation Scheme (TSS) between the UK and French coastines. Signal pattern analysis shows inconsistent positional updates relative to {anomaly.details.get('reason', 'standard corridors')}. Cross-reference with AIS history confirms this is a high-interest event for the Dover Strait monitoring zone.

**PATTERN ASSESSMENT:**
Behavior is consistent with GPS signal interference or intentional masking. No mechanical failure signals detected. Most plausible explanation remains deliberate navigational deviation.

**REGISTRY INTELLIGENCE:**
{registry_info} Pattern of life matches standard cross-channel service schedules.

**SANCTIONS STATUS:**
No matches found on OFAC, EU, or UN consolidated sanctions lists as of last sync.

**RECOMMENDED ACTION:**
Maintain passive tracking. Flag for watch officer review if deviation continues for >2 polling cycles."""

        return Sitrep(
            anomaly_id=anomaly.id,
            headline=f"{entity_type_label} {anomaly.entity_id} flagged for {anomaly_label} in English Channel corridor.",
            body=mock_body,
            confidence=float(confidence) / 100.0,
            recommended_action="Maintain passive tracking. Flag for watch officer review."
        )

    if not api_key:
         return None

    try:
        logger.info(f"Intelligence Agent: Requesting live generation from AETHER-ANALYST using Llama 3.3.")
        client = AsyncGroq(api_key=api_key)
        
        # Build dynamic user prompt if state is available
        if state:
            user_content = build_sitrep_prompt(anomaly, state, prev_state)
        else:
            user_content = f"Generate a SITREP for the following anomaly data:\n{anomaly.json()}"

        messages = [
            {"role": "system", "content": SITREP_SYSTEM_PROMPT},
            {"role": "user", "content": user_content}
        ]
        
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            tools=tools,
            tool_choice="auto",
            max_tokens=600,
            temperature=0.3
        )
        
        response_message = response.choices[0].message
        
        # Process Tool Calls if requested by Groq Llama 3.3
        if response_message.tool_calls:
            # We must pass the raw message back to history as an object/dict mimicking the response
            messages.append(response_message)
            for tool_call in response_message.tool_calls:
                function_name = tool_call.function.name
                
                # safely parse arguments
                try:
                    function_args = json.loads(tool_call.function.arguments)
                except:
                    function_args = {}
                
                if function_name == "lookup_vessel_registry":
                    tool_result = mock_lookup_vessel_registry(
                        entity_id=function_args.get("entity_id", ""),
                        entity_type=function_args.get("entity_type", "vessel")
                    )
                elif function_name == "check_sanctions_list":
                    tool_result = mock_check_sanctions_list(
                        entity_id=function_args.get("entity_id", ""),
                        flag_state=function_args.get("flag_state")
                    )
                else:
                    tool_result = "{}"
                    
                messages.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": function_name,
                    "content": tool_result
                })
                
            # Perform second call with tool results embedded in context
            response = await client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                max_tokens=600,
                temperature=0.3
            )
            response_message = response.choices[0].message

        # Markdown body
        content = response_message.content or ""
        
        # Parse fields from the final generation
        headline = "Intelligence Report"
        confidence_val = 0.8 # arbitrary default
        rec_action = "Review flagged tracking logs."
        
        for line in content.split("\n"):
            clean_line = line.strip()
            if clean_line.startswith("**HEADLINE:**"):
                headline = clean_line.replace("**HEADLINE:**", "").strip()
            elif clean_line.startswith("**CONFIDENCE:**"):
                conf_str = clean_line.replace("**CONFIDENCE:**", "").split("—")[0].replace("%", "").strip()
                try:
                    confidence_val = min(1.0, max(0.0, float(conf_str) / 100.0))
                except ValueError:
                    pass # Keep default
            elif clean_line.startswith("**RECOMMENDED ACTION:**"):
                rec_action = clean_line.replace("**RECOMMENDED ACTION:**", "").strip()
        
        return Sitrep(
            anomaly_id=anomaly.id,
            headline=headline,
            body=content,
            confidence=confidence_val,
            recommended_action=rec_action
        )

    except Exception as e:
        logger.error(f"Error generating SITREP with Groq: {e}")
        return Sitrep(
            anomaly_id=anomaly.id,
            headline="Anomaly generation failed",
            body=f"Failed to generate intelligence report due to an underlying API request error.\nDetails: {str(e)}",
            confidence=0.5,
            recommended_action="Manually investigate the raw telemetry alert."
        )
