"""
Llama 3.3 tool-calling agent using Groq Cloud SDK.
"""
import os
import json
import logging
from groq import AsyncGroq
from app.models.schemas import Anomaly, Sitrep

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
            "registry": "Panama",
            "owner": "Meridian Shipping LLC",
            "vessel_type": "Tanker",
            "route_history": "Gulf-to-India transit"
        })
    else:
        return json.dumps({
            "registry": "United Arab Emirates",
            "owner": "Emirates Leasing",
            "aircraft_type": "Boeing 777"
        })

def mock_check_sanctions_list(entity_id, flag_state=None):
    return json.dumps({
        "on_ofac_list": False,
        "on_eu_list": False,
        "on_un_list": False,
        "notes": "No current sanctions found for entity."
    })

SYSTEM_PROMPT = """You are AETHER-ANALYST, an intelligence officer producing professional Situation Reports (SITREPs) for the Strait of Hormuz Monitoring Initiative.

Write in a factual, objective, third-person voice. No speculation beyond what the telemetry data supports. No alarmist language. Structure every SITREP exactly as follows, with no extra prefixes or suffixes:

**HEADLINE:** [One sentence, max 20 words]
**CLASSIFICATION:** UNCLASSIFIED // OSINT // FOR EDUCATIONAL USE ONLY
**ENTITY:** [ID and type]
**ANOMALY TYPE:** [type]
**THREAT LEVEL:** [LOW/MEDIUM/HIGH/CRITICAL]
**CONFIDENCE:** [0–100%]
**SUMMARY:** [2–3 sentences describing what the data shows]
**REGISTRY CHECK:** [Result of lookup_vessel_registry tool call]
**SANCTIONS STATUS:** [Result of check_sanctions_list tool call]
**RECOMMENDED ACTION:** [One sentence — monitoring, flagging, or escalation]
"""

async def generate_sitrep(anomaly: Anomaly) -> Sitrep:
    demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"
    api_key = os.getenv("GROQ_API_KEY", "")

    if demo_mode or not api_key:
        logger.info("Using fallback mock SITREP (DEMO_MODE or missing API Key).")
        return Sitrep(
            anomaly_id=anomaly.id,
            headline=f"Automated Anomaly Detected: {anomaly.anomaly_type.upper()}",
            body=f"This is a mock SITREP for anomaly {anomaly.id}.\nRun in production mode with a Groq API key to generate an AI intelligence breakdown.",
            confidence=0.85,
            recommended_action="Continue standard monitoring."
        )

    try:
        client = AsyncGroq(api_key=api_key)
        
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Generate a SITREP for the following anomaly data:\n{anomaly.json()}"}
        ]
        
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            tools=tools,
            tool_choice="auto",
            max_tokens=800
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
                max_tokens=800
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
                conf_str = clean_line.replace("**CONFIDENCE:**", "").replace("%", "").strip()
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
