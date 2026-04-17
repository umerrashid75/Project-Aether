"use client"

import { useCallback, useEffect, useRef } from "react"
import { useSpeech, type ListeningState } from "./useSpeech"
import {
  buildAnomalyResponse,
  buildSitrepResponse,
  buildVesselsResponse,
  buildErrorResponse
} from "../lib/voiceResponses"
import type { Anomaly, Sitrep } from "../types"

interface UseVoiceCommandsProps {
  /** The anomaly_id of the currently displayed SITREP (null if none generated yet) */
  currentSitrepId: string | null
  /** Calls POST /api/sitrep/generate — already implemented */
  onGenerateSitrep: (anomalyId: string) => Promise<Sitrep>
  /** Triggers window.print() via the existing PDF export — already implemented */
  onDownloadReport: () => void
  /** Highlights the given anomaly entity in the incident feed */
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

  // Track whether a dispatch is already in-flight to prevent double-firing
  const dispatchingRef = useRef(false)

  // Stable references for callbacks to avoid stale closures in the effect
  const onGenerateSitrepRef   = useRef(onGenerateSitrep)
  const onDownloadReportRef   = useRef(onDownloadReport)
  const onHighlightAnomalyRef = useRef(onHighlightAnomaly)
  const currentSitrepIdRef    = useRef(currentSitrepId)

  useEffect(() => { onGenerateSitrepRef.current   = onGenerateSitrep   }, [onGenerateSitrep])
  useEffect(() => { onDownloadReportRef.current   = onDownloadReport   }, [onDownloadReport])
  useEffect(() => { onHighlightAnomalyRef.current = onHighlightAnomaly }, [onHighlightAnomaly])
  useEffect(() => { currentSitrepIdRef.current    = currentSitrepId    }, [currentSitrepId])

  const dispatch = useCallback(async (transcriptText: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

    try {
      // Step 1: Classify the transcript
      const intentRes = await fetch(`${apiBase}/api/voice/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText })
      })

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
          const res = await fetch(`${apiBase}/api/anomalies${params}`)
          const { anomalies }: { anomalies: Anomaly[] } = await res.json()
          const response = buildAnomalyResponse(anomalies)

          speak(response, () => {
            // After speaking, highlight the highest threat anomaly in the feed
            const top = [...anomalies].sort(
              (a, b) => b.threat_score - a.threat_score
            )[0]
            if (top) onHighlightAnomalyRef.current(top.entity_id)
          })
          break
        }

        case "generate_sitrep": {
          // Fetch the highest-priority anomaly (filtered by type if specified)
          const params = intent.anomaly_type
            ? `?anomaly_type=${intent.anomaly_type}&limit=1&sort=threat_score`
            : "?limit=1&sort=threat_score"
          const res = await fetch(`${apiBase}/api/anomalies${params}`)
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
            const sitrep = await onGenerateSitrepRef.current(topAnomaly.id)
            speak(buildSitrepResponse(sitrep))
          } catch {
            speak(buildErrorResponse("rate_limited"))
          }
          break
        }

        case "download_report": {
          if (!currentSitrepIdRef.current) {
            speak(buildErrorResponse("no_sitrep"))
            break
          }
          speak("Downloading report now.")
          // Delay so speech starts before the print dialog opens
          setTimeout(() => onDownloadReportRef.current(), 900)
          break
        }

        case "query_vessels": {
          const res = await fetch(`${apiBase}/api/telemetry/vessels?count=true`)
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
  }, [speak])

  useEffect(() => {
    if (!transcript || listeningState !== "processing") return
    if (dispatchingRef.current) return
    dispatchingRef.current = true
    dispatch(transcript)
  }, [transcript, listeningState, dispatch])

  return { listeningState, isSupported, transcript, startListening, cancelSpeech, error }
}
