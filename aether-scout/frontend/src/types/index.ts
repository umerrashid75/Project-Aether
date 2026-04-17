/**
 * Shared TypeScript types for Project Aether.
 * These mirror the backend Pydantic schemas exactly.
 */

export interface Anomaly {
  id: string
  anomaly_type: string   // "dark_transit" | "gnss_spoof" | "low_flight" | "speed_jump" | "rendezvous"
  entity_id: string
  entity_type: string    // "AIRCRAFT" | "VESSEL"
  position: [number, number]   // [lon, lat]
  threat_score: number   // 0.0–1.0
  threat_level: string   // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  details: Record<string, unknown>
  detected_at: string    // ISO 8601
  sitrep_generated: boolean
}

export interface Sitrep {
  id: string
  anomaly_id: string
  headline: string
  body: string
  confidence: number     // 0.0–1.0
  recommended_action: string
  created_at: string     // ISO 8601
}
