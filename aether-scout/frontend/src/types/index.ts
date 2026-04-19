export interface RegionConfig {
  label: string
  bbox: [number, number, number, number]
  center: [number, number]
  zoom: number
  opensky_quality: 'excellent' | 'very_good' | 'good' | 'poor'
  ais_quality: 'excellent' | 'very_good' | 'good' | 'poor'
  description: string
  demo_recommended?: boolean
}

export interface RegionListResponse {
  regions: Record<string, RegionConfig>
  active_region_id: string
}

export interface CoverageResult {
  region_id: string
  aircraft: number
  vessels: number | null
  source: 'live' | 'demo'
}
