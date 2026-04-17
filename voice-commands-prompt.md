# Voice Command System — Project Aether

## ARCHITECTURE CLARITY (read before writing any code)

The system has three distinct layers. Never mix them:

1. **Anomaly detection** — done entirely by `anomaly_engine.py` using heuristics
   and telemetry logic. Groq is never involved in detection.
2. **SITREP generation** — done by `groq_agent.py` via `POST /api/sitrep/generate`,
   accepts an `anomaly_id`, returns a structured `Sitrep`. Already implemented.
3. **PDF export** — done by `window.print()` with a print stylesheet. Already
   implemented in `SitrepCard.tsx`.

The voice system only **reads** anomaly results and **triggers** existing features.
It never detects anomalies itself.

---

## RULES

- Work strictly one task at a time. State `✓ TASK X COMPLETE` when done.
- Do not modify any existing backend routes, schemas, or `groq_agent.py`.
- Do not install any new packages. Everything uses browser-native Web Speech APIs
  and the existing Groq SDK already on the backend.
- All new frontend files go in `/frontend/src/components/voice/` or
  `/frontend/src/hooks/`. No exceptions.
- The feature must degrade gracefully — if the browser does not support
  `SpeechRecognition`, hide the mic button entirely with zero console errors.
- All new files must pass `npx tsc --noEmit --strict` with zero errors.

---

## VOICE COMMAND FLOW

```
User presses mic (or presses V)
        ↓
SpeechRecognition API → transcript string
        ↓
POST /api/voice/classify → VoiceIntent (Groq, max 80 tokens)
        ↓
   ┌────┴────────────────┬──────────────────┬──────────────┐
query_anomalies   generate_sitrep   download_report   unknown
        ↓                ↓                 ↓               ↓
GET /api/anomalies  POST /api/sitrep   trigger existing  speak error
(already detected   /generate with    PDF export from    message
 by heuristics)     top anomaly_id    SitrepCard
        ↓                ↓
  speak response    speak confirmation
```

---

## TASK 1 — Intent Classification Endpoint

### New file: `/backend/app/api/routes_voice.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.groq_agent import groq_client  # reuse existing client — do not create a new one
import json

router = APIRouter(prefix="/api/voice", tags=["voice"])


class TranscriptRequest(BaseModel):
    transcript: str


class VoiceIntent(BaseModel):
    intent: str           # see values below
    anomaly_type: str | None = None  # "dark_transit"|"gnss_spoof"|"low_flight"|"speed_jump"
    raw_transcript: str
    confidence: float     # 0.0–1.0


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

    response = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": INTENT_SYSTEM_PROMPT},
            {"role": "user", "content": body.transcript}
        ],
        max_tokens=80,       # classification only — never more than this
        temperature=0.1,     # near-deterministic
    )

    raw = response.choices[0].message.content.strip()

    try:
        parsed = json.loads(raw)
        return VoiceIntent(
            intent=parsed["intent"],
            anomaly_type=parsed.get("anomaly_type"),
            raw_transcript=body.transcript,
            confidence=float(parsed.get("confidence", 0.8))
        )
    except (json.JSONDecodeError, KeyError, ValueError):
        # If the model fails to return valid JSON, return unknown gracefully
        return VoiceIntent(
            intent="unknown",
            anomaly_type=None,
            raw_transcript=body.transcript,
            confidence=0.0
        )
```

Register in `main.py` — add alongside existing routers:
```python
from app.api.routes_voice import router as voice_router
app.include_router(voice_router)
```

When done state: `✓ TASK 1 COMPLETE`

---

## TASK 2 — Voice Response Builder (Frontend Utility)

A pure utility — no API calls, no hooks. Takes data already fetched and
returns a string to be spoken. Fast and free.

### New file: `/frontend/src/lib/voiceResponses.ts`

```typescript
import type { Anomaly, Sitrep } from "@/types"

export function buildAnomalyResponse(anomalies: Anomaly[]): string {
  if (anomalies.length === 0) {
    return (
      "No anomalies detected in the current tracking area. " +
      "All vessels and aircraft are operating within normal parameters."
    )
  }

  const critical = anomalies.filter(a => a.threat_level === "CRITICAL")
  const high     = anomalies.filter(a => a.threat_level === "HIGH")
  const total    = anomalies.length

  const severityParts: string[] = []
  if (critical.length > 0) severityParts.push(`${critical.length} critical`)
  if (high.length > 0)     severityParts.push(`${high.length} high priority`)

  const typeLabels: Record<string, string> = {
    dark_transit: "dark transit",
    gnss_spoof:   "G.N.S.S. spoofing",
    low_flight:   "low altitude flight",
    speed_jump:   "speed anomaly"
  }

  const typeGroups = groupBy(anomalies, a => a.anomaly_type)
  const typeDescription = Object.entries(typeGroups)
    .map(([type, items]) => `${items.length} ${typeLabels[type] ?? type}`)
    .join(", ")

  const top = [...anomalies].sort((a, b) => b.threat_score - a.threat_score)[0]

  let response = `${total} anomal${total === 1 ? "y" : "ies"} detected. `

  if (severityParts.length > 0) {
    response += `${severityParts.join(" and ")} threat${severityParts.length > 1 ? "s" : ""}. `
  }

  response += `Breakdown: ${typeDescription}. `

  if (top) {
    response += `Highest priority: ${typeLabels[top.anomaly_type] ?? top.anomaly_type} `
    response += `on entity ${top.entity_id}, `
    response += `threat score ${Math.round(top.threat_score * 100)} percent. `
  }

  response += `Say "generate sitrep" to create a full intelligence report.`
  return response
}

export function buildSitrepResponse(sitrep: Sitrep): string {
  return (
    `Situation report generated. ${sitrep.headline} ` +
    `Threat level: ${sitrep.threat_level}. ` +
    `Confidence: ${Math.round(sitrep.confidence * 100)} percent. ` +
    `${sitrep.recommended_action} ` +
    `Say "download report" to export this as a PDF.`
  )
}

export function buildVesselsResponse(count: number): string {
  return (
    `Currently tracking ${count} entities in the operational area. ` +
    `Say "are there any anomalies" for a threat assessment.`
  )
}

export function buildErrorResponse(
  reason: "unknown" | "no_anomalies" | "rate_limited" | "offline" | "no_sitrep"
): string {
  const messages: Record<string, string> = {
    unknown:
      "Command not recognized. You can ask: are there any anomalies, " +
      "generate a sitrep, or download the report.",
    no_anomalies:
      "No anomalies are currently detected. There is no report to generate.",
    rate_limited:
      "Sitrep generation is rate limited. Please wait ten seconds and try again.",
    offline:
      "Voice commands are unavailable while the feed is offline.",
    no_sitrep:
      "No sitrep has been generated yet. Say generate a sitrep first, " +
      "then ask to download the report."
  }
  return messages[reason]
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item)
    acc[k] = acc[k] ?? []
    acc[k].push(item)
    return acc
  }, {})
}
```

When done state: `✓ TASK 2 COMPLETE`

---

## TASK 3 — Speech Hook

All browser API interaction lives here. No component ever touches
`window.speechSynthesis` or `SpeechRecognition` directly.

### New file: `/frontend/src/hooks/useSpeech.ts`

```typescript
"use client"

import { useState, useEffect, useRef, useCallback } from "react"

export type ListeningState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error"
  | "unsupported"

interface UseSpeechReturn {
  listeningState: ListeningState
  transcript: string
  isSupported: boolean
  startListening: () => void
  stopListening: () => void
  speak: (text: string, onEnd?: () => void) => void
  cancelSpeech: () => void
  error: string | null
}

export function useSpeech(): UseSpeechReturn {
  const [listeningState, setListeningState] = useState<ListeningState>("idle")
  const [transcript, setTranscript]         = useState("")
  const [error, setError]                   = useState<string | null>(null)
  const [isSupported, setIsSupported]       = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const stateRef = useRef<ListeningState>("idle")

  // Keep ref in sync so callbacks have current state without stale closure
  useEffect(() => { stateRef.current = listeningState }, [listeningState])

  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      setListeningState("unsupported")
      return
    }

    setIsSupported(true)
    const recognition = new SpeechRecognitionAPI()
    recognition.continuous      = false
    recognition.interimResults  = false
    recognition.lang            = "en-US"
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListeningState("listening")
      setTranscript("")
      setError(null)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[0]?.[0]?.transcript ?? ""
      setTranscript(result)
      setListeningState("processing")
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const messages: Record<string, string> = {
        "not-allowed": "Microphone access denied. Please allow microphone access in your browser.",
        "no-speech":   "No speech detected. Please try again.",
        "network":     "Network error during recognition.",
        "aborted":     "Listening cancelled."
      }
      setError(messages[event.error] ?? `Recognition error: ${event.error}`)
      setListeningState("error")
    }

    recognition.onend = () => {
      if (stateRef.current === "listening") setListeningState("idle")
    }

    recognitionRef.current = recognition
    return () => { recognition.abort() }
  }, [])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    if (stateRef.current === "speaking") {
      window.speechSynthesis.cancel()
      setListeningState("idle")
    }
    try {
      recognitionRef.current.start()
    } catch {
      setError("Could not start microphone. Is it already in use?")
      setListeningState("error")
    }
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListeningState("idle")
  }, [])

  const speak = useCallback((text: string, onEnd?: () => void) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)

    // Prefer professional-sounding voices
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v =>
      v.name.includes("Google UK English Male") ||
      v.name.includes("Daniel") ||   // macOS
      v.name.includes("Alex")        // macOS fallback
    )
    if (preferred) utterance.voice = preferred

    utterance.rate   = 0.92
    utterance.pitch  = 0.95
    utterance.volume = 1.0

    utterance.onstart = () => setListeningState("speaking")
    utterance.onend   = () => { setListeningState("idle"); onEnd?.() }
    utterance.onerror = () => setListeningState("idle")

    window.speechSynthesis.speak(utterance)
  }, [])

  const cancelSpeech = useCallback(() => {
    window.speechSynthesis.cancel()
    setListeningState("idle")
  }, [])

  return {
    listeningState,
    transcript,
    isSupported,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    error
  }
}
```

When done state: `✓ TASK 3 COMPLETE`

---

## TASK 4 — Voice Command Orchestrator Hook

Connects the speech hook → intent endpoint → existing features.

### New file: `/frontend/src/hooks/useVoiceCommands.ts`

```typescript
"use client"

import { useCallback, useEffect, useRef } from "react"
import { useSpeech, type ListeningState } from "./useSpeech"
import {
  buildAnomalyResponse,
  buildSitrepResponse,
  buildVesselsResponse,
  buildErrorResponse
} from "@/lib/voiceResponses"
import type { Anomaly, Sitrep } from "@/types"

interface UseVoiceCommandsProps {
  /** The anomaly_id of the currently displayed SITREP (null if none generated yet) */
  currentSitrepId: string | null
  /** Calls POST /api/sitrep/generate — already implemented */
  onGenerateSitrep: (anomalyId: string) => Promise<Sitrep>
  /** Triggers window.print() via the existing PDF export — already implemented */
  onDownloadReport: () => void
  /** Flies map to anomaly and highlights it */
  onHighlightAnomaly: (anomalyId: string) => void
}

interface UseVoiceCommandsReturn {
  listeningState: ListeningState
  isSupported: boolean
  transcript: string
  startListening: () => void
  cancelSpeech: () => void
  error: string | null
}

export function useVoiceCommands({
  currentSitrepId,
  onGenerateSitrep,
  onDownloadReport,
  onHighlightAnomaly
}: UseVoiceCommandsProps): UseVoiceCommandsReturn {
  const {
    listeningState,
    transcript,
    isSupported,
    startListening,
    speak,
    cancelSpeech,
    error
  } = useSpeech()

  // Track whether a dispatch is in flight to prevent double-firing
  const dispatchingRef = useRef(false)

  useEffect(() => {
    if (!transcript || listeningState !== "processing") return
    if (dispatchingRef.current) return
    dispatchingRef.current = true

    async function dispatch() {
      try {
        // Step 1: Classify the transcript
        const intentRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/voice/classify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript })
          }
        )

        if (!intentRes.ok) {
          speak(buildErrorResponse("unknown"))
          return
        }

        const intent = await intentRes.json()

        // Step 2: Dispatch based on intent
        switch (intent.intent) {
          case "query_anomalies": {
            const params = intent.anomaly_type
              ? `?anomaly_type=${intent.anomaly_type}&limit=20`
              : "?limit=20"
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/anomalies${params}`
            )
            const { anomalies }: { anomalies: Anomaly[] } = await res.json()
            const response = buildAnomalyResponse(anomalies)

            speak(response, () => {
              // After speaking, highlight the highest threat anomaly on the map
              const top = [...anomalies].sort(
                (a, b) => b.threat_score - a.threat_score
              )[0]
              if (top) onHighlightAnomaly(top.id)
            })
            break
          }

          case "generate_sitrep": {
            // Fetch anomalies — filter by type if user specified one
            const params = intent.anomaly_type
              ? `?anomaly_type=${intent.anomaly_type}&limit=1&sort=threat_score`
              : "?limit=1&sort=threat_score"
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/anomalies${params}`
            )
            const { anomalies }: { anomalies: Anomaly[] } = await res.json()

            if (!anomalies.length) {
              speak(buildErrorResponse("no_anomalies"))
              break
            }

            const topAnomaly = anomalies[0]!
            speak(
              `Generating situation report for ` +
              `${topAnomaly.anomaly_type.replace(/_/g, " ")} anomaly. Stand by.`
            )

            try {
              // Calls the existing POST /api/sitrep/generate endpoint
              const sitrep = await onGenerateSitrep(topAnomaly.id)
              speak(buildSitrepResponse(sitrep))
            } catch {
              speak(buildErrorResponse("rate_limited"))
            }
            break
          }

          case "download_report": {
            if (!currentSitrepId) {
              speak(buildErrorResponse("no_sitrep"))
              break
            }
            speak("Downloading report now.")
            // Delay so speech starts before print dialog opens
            setTimeout(() => onDownloadReport(), 900)
            break
          }

          case "query_vessels": {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/telemetry/vessels?count=true`
            )
            const { count }: { count: number } = await res.json()
            speak(buildVesselsResponse(count))
            break
          }

          default:
            speak(buildErrorResponse("unknown"))
        }
      } catch {
        speak("System error processing your command. Please try again.")
      } finally {
        dispatchingRef.current = false
      }
    }

    dispatch()
  }, [transcript, listeningState])

  return { listeningState, isSupported, transcript, startListening, cancelSpeech, error }
}
```

When done state: `✓ TASK 4 COMPLETE`

---

## TASK 5 — Mic Button Component

### New file: `/frontend/src/components/voice/VoiceMicButton.tsx`

**States and visual styles:**

| State | Background | Border | Icon | Extra |
|-------|-----------|--------|------|-------|
| `idle` | `rgba(15,23,42,0.9)` | `#334155` | `Mic` #94a3b8 | none |
| `listening` | `rgba(239,68,68,0.15)` | `#ef4444` | `Mic` #ef4444 | pulsing ring |
| `processing` | `rgba(245,158,11,0.15)` | `#f59e0b` | `Loader2` #f59e0b spinning |
| `speaking` | `rgba(34,211,238,0.15)` | `#22d3ee` | `Volume2` #22d3ee | none |
| `error` | `rgba(239,68,68,0.08)` | `#7f1d1d` | `Mic` #ef4444 | none |
| `unsupported` | **do not render the component at all** | — | — | — |

```tsx
"use client"

import { Mic, Volume2, Loader2 } from "lucide-react"

interface VoiceMicButtonProps {
  listeningState: import("@/hooks/useSpeech").ListeningState
  transcript: string
  onPress: () => void      // startListening or cancelSpeech
  error: string | null
}

const STATE_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  idle:        { bg: "rgba(15,23,42,0.9)",    border: "#334155", color: "#94a3b8" },
  listening:   { bg: "rgba(239,68,68,0.15)",  border: "#ef4444", color: "#ef4444" },
  processing:  { bg: "rgba(245,158,11,0.15)", border: "#f59e0b", color: "#f59e0b" },
  speaking:    { bg: "rgba(34,211,238,0.15)", border: "#22d3ee", color: "#22d3ee" },
  error:       { bg: "rgba(239,68,68,0.08)",  border: "#7f1d1d", color: "#ef4444" },
}

const STATE_LABELS: Record<string, string> = {
  idle:       "Voice command (V)",
  listening:  "Listening...",
  processing: "Processing...",
  speaking:   "Speaking — tap to stop",
  error:      "Error — tap to retry",
}

export function VoiceMicButton({
  listeningState,
  transcript,
  onPress,
  error
}: VoiceMicButtonProps) {
  if (listeningState === "unsupported") return null

  const style = STATE_STYLES[listeningState] ?? STATE_STYLES.idle!

  const Icon =
    listeningState === "speaking"   ? Volume2  :
    listeningState === "processing" ? Loader2  : Mic

  // Transcript pill: show during processing and speaking
  const showPill = (listeningState === "processing" || listeningState === "speaking") && transcript

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>

      {/* Transcript pill */}
      {showPill && (
        <div style={{
          background: "rgba(15,23,42,0.9)",
          border: "1px solid #1e293b",
          borderRadius: "14px",
          padding: "4px 10px",
          fontSize: "11px",
          fontFamily: "monospace",
          color: "#94a3b8",
          maxWidth: "200px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}>
          {transcript.length > 60 ? transcript.slice(0, 60) + "…" : transcript}
        </div>
      )}

      {/* Tooltip */}
      <div style={{ position: "relative" }} title={error ?? STATE_LABELS[listeningState]}>

        {/* Pulsing ring — listening state only */}
        {listeningState === "listening" && (
          <span style={{
            position: "absolute",
            inset: "-6px",
            borderRadius: "50%",
            border: "2px solid #ef4444",
            opacity: 0,
            animation: "voicePulse 1.5s ease-out infinite"
          }} />
        )}

        {/* Main button */}
        <button
          onClick={onPress}
          aria-label={STATE_LABELS[listeningState]}
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: `1.5px solid ${style.border}`,
            background: style.bg,
            color: style.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            outline: "none"
          }}
        >
          <Icon
            size={20}
            color={style.color}
            style={
              listeningState === "processing"
                ? { animation: "spin 1s linear infinite" }
                : undefined
            }
          />
        </button>
      </div>

      {/* Keyframe styles injected once */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes voicePulse {
            0%   { transform: scale(1);   opacity: 0.7; }
            100% { transform: scale(1.7); opacity: 0;   }
          }
          @keyframes spin {
            from { transform: rotate(0deg);   }
            to   { transform: rotate(360deg); }
          }
        }
      `}</style>
    </div>
  )
}
```

When done state: `✓ TASK 5 COMPLETE`

---

## TASK 6 — PDF Export (SITREP Download)

The PDF export uses `window.print()` with a print stylesheet.
No new packages required.

### New file: `/frontend/src/lib/sitrepParser.ts`

```typescript
export interface SitrepSection {
  label: string
  body: string
}

/**
 * Parses a SITREP markdown body into labeled sections.
 * Splits on **LABEL:** patterns produced by the Groq agent.
 */
export function parseSitrepSections(body: string): SitrepSection[] {
  const sections: SitrepSection[] = []
  // Match **LABEL:** at the start of a line
  const regex = /\*\*([A-Z ]+):\*\*/g
  const matches = [...body.matchAll(regex)]

  matches.forEach((match, i) => {
    const label = match[1]?.trim() ?? ""
    const start = (match.index ?? 0) + match[0].length
    const end   = matches[i + 1]?.index ?? body.length
    const content = body.slice(start, end).trim()
    if (label && content) sections.push({ label, body: content })
  })

  return sections
}
```

### New file: `/frontend/src/app/print.css`

Import this in `layout.tsx`: `import "@/app/print.css"`

```css
@media print {
  /* Hide everything except the print target */
  body > * {
    display: none !important;
  }
  #sitrep-print-target {
    display: block !important;
  }

  #sitrep-print-target {
    font-family: "Courier New", monospace;
    font-size: 11pt;
    color: #000;
    background: #fff;
    padding: 2cm;
    max-width: 18cm;
    margin: 0 auto;
    line-height: 1.6;
  }

  .print-header {
    border-bottom: 2px solid #000;
    padding-bottom: 12pt;
    margin-bottom: 16pt;
  }

  .print-project-name {
    font-size: 9pt;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #666;
  }

  .print-headline {
    font-size: 15pt;
    font-weight: bold;
    margin: 6pt 0 4pt;
  }

  .print-classification {
    font-size: 8pt;
    letter-spacing: 0.08em;
    color: #444;
  }

  .print-section-label {
    font-weight: bold;
    font-size: 9pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-top: 12pt;
    border-bottom: 1px solid #ccc;
    padding-bottom: 2pt;
  }

  .print-section-body {
    margin-top: 4pt;
    font-size: 10pt;
    white-space: pre-wrap;
  }

  .print-footer {
    margin-top: 24pt;
    padding-top: 8pt;
    border-top: 1px solid #ccc;
    font-size: 8pt;
    color: #666;
    display: flex;
    justify-content: space-between;
  }
}
```

### Changes to `SitrepCard.tsx`

Add a hidden print target div and an export button to the expanded card:

```tsx
import { FileDown } from "lucide-react"
import { parseSitrepSections } from "@/lib/sitrepParser"

// Inside the expanded SitrepCard:

function handleExport() {
  // Populate the hidden print target, then print
  const target = document.getElementById("sitrep-print-target")
  if (!target) return

  const sections = parseSitrepSections(sitrep.body)

  target.innerHTML = `
    <div class="print-header">
      <div class="print-project-name">Project Aether — Dover Strait Edition</div>
      <div class="print-headline">${sitrep.headline}</div>
      <div class="print-classification">
        UNCLASSIFIED // OSINT // FOR EDUCATIONAL USE ONLY
      </div>
    </div>
    ${sections.map(s => `
      <div class="print-section-label">${s.label}</div>
      <div class="print-section-body">${s.body}</div>
    `).join("")}
    <div class="print-footer">
      <span>Generated by AETHER-ANALYST</span>
      <span>Exported: ${new Date().toUTCString()}</span>
    </div>
  `

  window.print()
}

// Export button (add to bottom of expanded card):
<button
  onClick={handleExport}
  style={{
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "12px",
    padding: "6px 12px",
    background: "transparent",
    border: "1px solid #334155",
    borderRadius: "6px",
    color: "#94a3b8",
    fontSize: "12px",
    fontFamily: "monospace",
    cursor: "pointer",
    letterSpacing: "0.05em"
  }}
>
  <FileDown size={14} />
  EXPORT PDF
</button>
```

### Add hidden print target to `dashboard/page.tsx`

Add this div anywhere inside the page layout — it is invisible in the browser:

```tsx
<div id="sitrep-print-target" style={{ display: "none" }} />
```

When done state: `✓ TASK 6 COMPLETE`

---

## TASK 7 — Wire Everything Into the Dashboard

### Changes to `dashboard/page.tsx`

```tsx
import { useVoiceCommands } from "@/hooks/useVoiceCommands"
import { VoiceMicButton }   from "@/components/voice/VoiceMicButton"

// Inside the component — add alongside existing state:
const [currentSitrepId, setCurrentSitrepId] = useState<string | null>(null)

// When a sitrep is generated, store its id:
async function handleGenerateSitrep(anomalyId: string): Promise<Sitrep> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sitrep/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anomaly_id: anomalyId })
  })
  const sitrep: Sitrep = await res.json()
  setCurrentSitrepId(sitrep.id)   // track for download_report voice command
  return sitrep
}

function handleDownloadReport() {
  // Triggers window.print() — SitrepCard must have populated #sitrep-print-target first
  window.print()
}

const { listeningState, isSupported, transcript, startListening, cancelSpeech, error } =
  useVoiceCommands({
    currentSitrepId,
    onGenerateSitrep: handleGenerateSitrep,
    onDownloadReport: handleDownloadReport,
    onHighlightAnomaly: (id) => mapRef.current?.flyToAnomaly(id) // existing map method
  })

// Add V to existing useKeyboardShortcuts call:
useKeyboardShortcuts({
  // ... existing handlers unchanged ...
  onVoice: startListening
})

// In the bottom-right button stack (below ? button), add:
<VoiceMicButton
  listeningState={listeningState}
  transcript={transcript}
  onPress={listeningState === "speaking" ? cancelSpeech : startListening}
  error={error}
/>

// Add V to the keyboard shortcuts help table:
// { key: "V", action: "Activate voice command" }
```

When done state: `✓ TASK 7 COMPLETE`

---

## BROWSER COMPATIBILITY

| Browser | SpeechRecognition | SpeechSynthesis |
|---------|------------------|-----------------|
| Chrome 33+ | ✓ Full support | ✓ |
| Edge 79+ | ✓ Full support | ✓ |
| Firefox | ✗ Not supported | ✓ |
| Safari 14.1+ | △ Flag required | ✓ |

Firefox users see no mic button. All other dashboard features remain fully
available. No console errors on unsupported browsers.

---

## FINAL CHECKLIST

- [ ] `POST /api/voice/classify` returns correct intent for all 5 intent types
- [ ] Groq is called only for intent classification and sitrep generation — never for anomaly detection
- [ ] `POST /api/sitrep/generate` receives an `anomaly_id`, not an `entity_id`
- [ ] "Are there any anomalies?" → speaks count + top threat → highlights on map
- [ ] "Generate a sitrep" → fetches top anomaly → calls existing endpoint → speaks headline
- [ ] "Generate a report for the gnss anomaly" → filters by `gnss_spoof` type correctly
- [ ] "Download the report" with no sitrep generated → speaks "generate a sitrep first"
- [ ] "Download the report" with sitrep present → triggers PDF export after 900ms delay
- [ ] PDF export renders clean monospace output with all SITREP sections parsed correctly
- [ ] Mic button hidden on Firefox with zero console errors
- [ ] Listening state shows pulsing red ring
- [ ] Tapping mic while speaking cancels speech immediately
- [ ] `V` keyboard shortcut triggers listening
- [ ] `DEMO_MODE=true` — all voice features work with synthetic data
- [ ] `npx tsc --noEmit --strict` exits with code 0 on all new files
