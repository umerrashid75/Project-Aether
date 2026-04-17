"use client"

import { Mic, Volume2, Loader2 } from "lucide-react"
import type { ListeningState } from "../../hooks/useSpeech"

interface VoiceMicButtonProps {
  listeningState: ListeningState
  transcript: string
  onPress: () => void        // startListening or cancelSpeech
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
  // Hide entirely on unsupported browsers — zero console errors
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
          whiteSpace: "nowrap",
          position: "absolute",
          bottom: "60px",
          right: 0
        }}>
          {transcript.length > 60 ? transcript.slice(0, 60) + "…" : transcript}
        </div>
      )}

      {/* Tooltip wrapper */}
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
          id="voice-mic-button"
          onClick={onPress}
          aria-label={STATE_LABELS[listeningState]}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: `1.5px solid ${style.border}`,
            background: style.bg,
            color: style.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            outline: "none",
            flexShrink: 0
          }}
        >
          <Icon
            size={16}
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
