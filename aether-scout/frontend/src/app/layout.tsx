import './globals.css'
import './print.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Project Aether | Dover Scout',
  description: 'Autonomous OSINT Intelligence Scout',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://api.tiles.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
