import type { Anomaly, Sitrep } from "../types"

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
    speed_jump:   "speed anomaly",
    rendezvous:   "rendezvous pattern"
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
    `Threat level: ${sitrep.confidence > 0.8 ? "high confidence" : "moderate confidence"}. ` +
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
