export interface SitrepSection {
  label: string
  body: string
}

/**
 * Parses a SITREP markdown body into labeled sections.
 * Splits on **LABEL:** patterns produced by the Groq agent (AETHER-ANALYST).
 */
export function parseSitrepSections(body: string): SitrepSection[] {
  const sections: SitrepSection[] = []
  // Match **LABEL:** at the start of a line
  const regex = /\*\*([A-Z ]+):\*\*/g
  const matches = Array.from(body.matchAll(regex))

  matches.forEach((match, i) => {
    const label = match[1]?.trim() ?? ""
    const start = (match.index ?? 0) + match[0].length
    const end   = matches[i + 1]?.index ?? body.length
    const content = body.slice(start, end).trim()
    if (label && content) sections.push({ label, body: content })
  })

  return sections
}
