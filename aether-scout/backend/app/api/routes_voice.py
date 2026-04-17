"""
POST /api/voice/classify — Intent classification for voice commands.
Uses Groq LLM (max 80 tokens) to classify a transcript into one of 5 intents.
"""
import os
import json
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from groq import AsyncGroq

router = APIRouter(prefix="/api/voice", tags=["voice"])
logger = logging.getLogger(__name__)


class TranscriptRequest(BaseModel):
    transcript: str


class VoiceIntent(BaseModel):
    intent: str                     # see INTENT_SYSTEM_PROMPT for valid values
    anomaly_type: str | None = None # "dark_transit"|"gnss_spoof"|"low_flight"|"speed_jump"
    raw_transcript: str
    confidence: float               # 0.0–1.0


INTENT_SYSTEM_PROMPT = """
You are an intent classifier for a maritime intelligence dashboard.
Classify the user voice command into exactly one intent.

Return ONLY valid JSON. No markdown. No explanation. No extra keys.

Schema:
{
  "intent": "<intent_value>",
  "anomaly_type": "<dark_transit|gnss_spoof|low_flight|speed_jump or null>",
  "confidence": <float 0.0-1.0>
}

Intent values:
- "query_anomalies"   → user asks about anomalies, alerts, threats, suspicious activity
- "generate_sitrep"   → user asks to generate, create, or write a report or sitrep
- "download_report"   → user asks to download, export, save, or print a report
- "query_vessels"     → user asks how many ships or aircraft are being tracked
- "unknown"           → anything not matching the above

Examples:
"are there any anomalies?" → {"intent":"query_anomalies","anomaly_type":null,"confidence":0.98}
"generate a sitrep" → {"intent":"generate_sitrep","anomaly_type":null,"confidence":0.97}
"generate a report for the gnss anomaly" → {"intent":"generate_sitrep","anomaly_type":"gnss_spoof","confidence":0.93}
"download that report" → {"intent":"download_report","anomaly_type":null,"confidence":0.94}
"how many vessels are tracked?" → {"intent":"query_vessels","anomaly_type":null,"confidence":0.91}
"hello" → {"intent":"unknown","anomaly_type":null,"confidence":0.99}
"""


@router.post("/classify", response_model=VoiceIntent)
async def classify_intent(body: TranscriptRequest):
    if not body.transcript.strip():
        raise HTTPException(status_code=400, detail="Empty transcript")

    if len(body.transcript) > 200:
        raise HTTPException(status_code=400, detail="Transcript too long — max 200 characters")

    api_key = os.getenv("GROQ_API_KEY", "")

    # Graceful degradation in demo mode or no API key
    if not api_key:
        logger.warning("Voice classify: No GROQ_API_KEY — returning unknown intent")
        return VoiceIntent(
            intent="unknown",
            anomaly_type=None,
            raw_transcript=body.transcript,
            confidence=0.0
        )

    try:
        client = AsyncGroq(api_key=api_key)
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": INTENT_SYSTEM_PROMPT},
                {"role": "user",   "content": body.transcript}
            ],
            max_tokens=80,      # classification only — never more than this
            temperature=0.1,    # near-deterministic
        )

        raw = response.choices[0].message.content.strip()
        logger.info(f"Voice classify raw response: {raw}")

        try:
            parsed = json.loads(raw)
            return VoiceIntent(
                intent=parsed["intent"],
                anomaly_type=parsed.get("anomaly_type"),
                raw_transcript=body.transcript,
                confidence=float(parsed.get("confidence", 0.8))
            )
        except (json.JSONDecodeError, KeyError, ValueError) as parse_err:
            logger.error(f"Voice classify: Failed to parse Groq response: {parse_err}")
            return VoiceIntent(
                intent="unknown",
                anomaly_type=None,
                raw_transcript=body.transcript,
                confidence=0.0
            )

    except Exception as e:
        logger.error(f"Voice classify: Groq request failed: {e}")
        return VoiceIntent(
            intent="unknown",
            anomaly_type=None,
            raw_transcript=body.transcript,
            confidence=0.0
        )
