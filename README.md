# Project God's Eye

*Global OSINT surveillance platform — real-time vessel and aircraft tracking with AI-driven anomaly detection and automated tactical intelligence reporting.*

![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Next.js 14](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)

```
UNCLASSIFIED // OSINT // FOR EDUCATIONAL USE ONLY
```

---



## Overview

Project God's Eye monitors live shipping vessels and aircraft across eight global surveillance zones by ingesting public AIS and ADS-B data feeds in real time. A pure-function heuristic anomaly engine scores each entity on a 0.0–1.0 threat scale across five detection categories — GNSS spoofing, dark transits, low-altitude flights, speed anomalies, and covert rendezvous. When a score crosses the threshold, a Llama 3.3 70B agent running on Groq auto-generates a structured tactical intelligence report (SITREP) with vessel registry lookups and sanctions list checks. The entire system is operable via browser-native voice commands — no external speech API keys required.

---

## Monitored Regions

| Region | Coverage Quality | Key Traffic |
|--------|-----------------|-------------|
| English Channel | Excellent | High-density commercial shipping, cross-Channel ferries |
| North Sea | Very Good | Oil/gas platform supply vessels, bulk carriers |
| Western Mediterranean | Good | Container traffic, cruise ships, fishing fleets |
| Strait of Gibraltar | Very Good | Atlantic–Mediterranean transit chokepoint |
| Bosphorus Strait | Good | Black Sea–Mediterranean tanker traffic |
| US East Coast | Excellent | Port approaches (NY/NJ, Norfolk, Savannah) |
| Los Angeles / Long Beach | Excellent | Trans-Pacific container terminal approaches |
| Strait of Hormuz | Good | Crude oil tanker corridor, naval activity |

---

## Anomaly Detection

### GNSS Spoofing
Triggered when a vessel's reported position jumps to a location inconsistent with its speed and heading over the elapsed time interval. Indicates possible GPS manipulation to mask true location — commonly observed in sanctions evasion and smuggling operations.

### Dark Transits
Triggered when a vessel that was actively broadcasting AIS ceases transmission mid-route without entering port or anchorage. Indicates an intentional AIS blackout, often used to conceal cargo transfers, unauthorized fishing, or entry into restricted waters.

### Low-Altitude Flights
Triggered when a commercial aircraft descends below the safe corridor altitude threshold for its region. Indicates a potential surveillance flight, equipment malfunction, or unauthorized low-level transit over maritime zones.

### Speed Anomalies
Triggered when a vessel exceeds the physical speed limits defined for its class (e.g., a laden VLCC reporting 25+ knots). Indicates possible AIS data spoofing, misclassified vessel type, or manipulated speed-over-ground data.

### Covert Rendezvous
Triggered when a slow, low-flying aircraft operates in close spatial and temporal proximity to a vessel. Indicates a potential at-sea transfer operation, aerial reconnaissance of a specific ship, or coordinated illicit activity.

---

## Architecture

The system is organized into three layers. The **data ingestion layer** pulls live ADS-B aircraft states from OpenSky Network via REST polling and live AIS vessel positions from AISStream via persistent WebSocket connection — the WebSocket reconnects automatically with a new bounding box when the user switches region. The **anomaly engine** is a set of pure functions with zero I/O and zero side effects: it takes entity data in, returns scored anomalies out, and is fully unit-testable in isolation. The **AI layer** passes high-scoring anomalies to a Llama 3.3 70B agent on Groq with tool-calling capabilities (vessel registry lookup, sanctions list check) to produce a structured SITREP, rate-limited to one generation per 10 seconds via an in-memory token bucket.

```
┌─────────────────────────────────────────────────────┐
│                   DATA SOURCES                       │
│  OpenSky Network (ADS-B)    AISStream (AIS/WS)      │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
               ▼                      ▼
┌─────────────────────────────────────────────────────┐
│                  FASTAPI BACKEND                     │
│  Ingestion → Anomaly Engine → Groq Agent → WS Feed  │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│                 NEXT.JS FRONTEND                     │
│     Mapbox Command Center + Incident Feed            │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Framer Motion, SWR |
| Map | Mapbox GL JS, react-map-gl |
| Backend | Python 3.12, FastAPI, Pydantic v2, Uvicorn |
| Database | MongoDB Atlas, Motor (async driver) |
| AI | Groq Cloud, Llama 3.3 70B, Groq SDK |
| Data feeds | OpenSky Network (ADS-B REST), AISStream (AIS WebSocket) |

---

## Getting Started

### Prerequisites

- Python 3.12
- Node.js 20+
- MongoDB Atlas account (free M0 tier)
- Groq Cloud API key (free)
- Mapbox token (free)
- AISStream API key (free)
- OpenSky Network account (free, optional — anonymous works)

### Environment Variables

**Backend** — create `backend/.env`:

```
MONGODB_URI=
MONGODB_DB=aether_db
GROQ_API_KEY=
OPENSKY_USERNAME=
OPENSKY_PASSWORD=
AISSTREAM_API_KEY=
DEMO_MODE=false
```

**Frontend** — create `frontend/.env.local`:

```
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_DEMO_MODE=false
```

### Running in Demo Mode

No API keys required. All features work identically using synthetic OSINT data.

```bash
# Backend
DEMO_MODE=true uvicorn app.main:app --reload

# Frontend
NEXT_PUBLIC_DEMO_MODE=true npm run dev
```

> Demo mode returns synthetic OSINT data. All features work identically. Recommended for first run.

### Running with Live Data

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` to access the command center.

---

## Features at a Glance

| Feature | Description |
|---------|-------------|
| Live vessel + aircraft tracking | Real-time AIS and ADS-B positions rendered on Mapbox GL |
| Anomaly detection engine | Five pure-function heuristic detectors scoring threats 0.0–1.0 |
| AI SITREP generation | Llama 3.3 70B agent produces structured tactical intelligence reports |
| Voice commands | Browser-native speech recognition — no API key needed |
| PDF export | One-click export of the current intelligence report |
| Dynamic region switching | Map flies to any of eight surveillance zones; data feeds reconnect automatically |
| Demo mode | Full-fidelity synthetic data mode for demos and development |
| WebSocket live feed | Fan-out broadcast of anomaly events to all connected clients |
| Threat heat map | Visual density overlay of detected anomalies per region |

---

## Ethical Notice

All data ingested by this system is sourced from public, unclassified OSINT feeds (OpenSky Network and AISStream). This project is built for educational and humanitarian transparency purposes only. It is intended to demonstrate real-time data engineering, anomaly detection, and AI-assisted intelligence reporting techniques. No classified data is used or implied.

---

## License

[MIT](LICENSE)
