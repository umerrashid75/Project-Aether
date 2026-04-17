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

/* eslint-disable @typescript-eslint/no-explicit-any */

export function useSpeech(): UseSpeechReturn {
  const [listeningState, setListeningState] = useState<ListeningState>("idle")
  const [transcript, setTranscript]         = useState("")
  const [error, setError]                   = useState<string | null>(null)
  const [isSupported, setIsSupported]       = useState(false)
  const recognitionRef = useRef<any>(null)
  const stateRef = useRef<ListeningState>("idle")

  // Keep ref in sync so callbacks have current state without stale closures
  useEffect(() => { stateRef.current = listeningState }, [listeningState])

  useEffect(() => {
    // Access via window to avoid SSR issues
    const w = window as any
    const SpeechRecognitionAPI = w.SpeechRecognition ?? w.webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      setListeningState("unsupported")
      return
    }

    setIsSupported(true)
    const recognition: any = new SpeechRecognitionAPI()
    recognition.continuous      = false
    recognition.interimResults  = false
    recognition.lang            = "en-US"
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListeningState("listening")
      setTranscript("")
      setError(null)
    }

    recognition.onresult = (event: any) => {
      const result: string = event.results[0]?.[0]?.transcript ?? ""
      setTranscript(result)
      setListeningState("processing")
    }

    recognition.onerror = (event: any) => {
      const messages: Record<string, string> = {
        "not-allowed": "Microphone access denied. Please allow microphone access in your browser.",
        "no-speech":   "No speech detected. Please try again.",
        "network":     "Network error during recognition.",
        "aborted":     "Listening cancelled."
      }
      setError(messages[event.error as string] ?? `Recognition error: ${event.error}`)
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

    // Prefer professional-sounding voices — load async if not yet populated
    const loadAndSpeak = () => {
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
    }

    // Voices may not be loaded on first call
    if (window.speechSynthesis.getVoices().length > 0) {
      loadAndSpeak()
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null
        loadAndSpeak()
      }
    }
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
