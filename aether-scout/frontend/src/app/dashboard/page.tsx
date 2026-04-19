"use client";
import React, { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import IncidentFeed from '../../components/IncidentFeed';
import DemoModeToggle from '../../components/DemoModeToggle';
import { EntitySelectionProvider } from '../../contexts/EntitySelectionContext';
import { RegionSelector } from '../../components/RegionSelector';
import { useRegion } from '../../hooks/useRegion';
import type { RegionConfig } from '../../types';
import type { MapRef } from 'react-map-gl';

// MapView uses mapbox-gl which requires browser APIs (window/document).
// Dynamic import with ssr:false prevents it from crashing during server rendering.
const MapView = dynamic(() => import('../../components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
      <div className="text-slate-500 text-sm animate-pulse">Loading map...</div>
    </div>
  ),
});

export default function Dashboard() {
  const mapRef = useRef<MapRef | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionLabel, setTransitionLabel] = useState('');
  const [incidentResetSignal, setIncidentResetSignal] = useState(0);
  const { activeConfig } = useRegion();

  async function handleRegionChange(regionId: string, config: RegionConfig) {
    if (!mapRef.current) return;

    setIncidentResetSignal((value) => value + 1);

    setTransitionLabel(config.label.toUpperCase());
    setTransitioning(true);

    const map = mapRef.current;

    map.flyTo({
      zoom: 2.5,
      duration: 800,
      easing: (t: number) => t * (2 - t),
      essential: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 400));
    map.rotateTo(180, {
      duration: 700,
      easing: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    });

    await new Promise((resolve) => setTimeout(resolve, 600));
    map.rotateTo(0, { duration: 0 });

    map.flyTo({
      center: [config.center[1], config.center[0]],
      zoom: config.zoom,
      bearing: 0,
      pitch: 45,
      duration: 1800,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      essential: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 1900));
    map.easeTo({
      pitch: 0,
      duration: 600,
      easing: (t: number) => t * (2 - t),
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    setTransitioning(false);
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans">
      <DemoModeToggle />
      <header className="px-6 py-4 border-b border-white/5 glass-panel z-10 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/50">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide">PROJECT GOD'S EYE</h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest">
              [ {activeConfig?.label?.toUpperCase() ?? 'ENGLISH CHANNEL'} ] INTELLIGENCE SCOUT
            </p>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono flex flex-col items-end opacity-60">
          <span>UNCLASSIFIED // OSINT</span>
          <span className="tracking-[0.1em]">EDUCATIONAL USE ONLY</span>
        </div>
      </header>

      <EntitySelectionProvider>
        <main className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 relative">
            <MapView onMapReady={(map) => { mapRef.current = map; }} />
            <RegionSelector onRegionChange={handleRegionChange} />
            {transitioning && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 20,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(2, 8, 23, 0.0)',
                  animation: 'fadeInOut 3.8s ease forwards',
                }}
              >
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    position: 'relative',
                    marginBottom: '24px',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      border: '1px solid #22d3ee',
                      opacity: 0.4,
                      animation: 'reticleSpin 1.5s linear infinite',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: '16px',
                      borderRadius: '50%',
                      border: '1px dashed #22d3ee',
                      opacity: 0.6,
                      animation: 'reticleSpinReverse 2s linear infinite',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '20px',
                      height: '20px',
                      borderTop: '2px solid #22d3ee',
                      borderLeft: '2px solid #22d3ee',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '20px',
                      height: '20px',
                      borderTop: '2px solid #22d3ee',
                      borderRight: '2px solid #22d3ee',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: '20px',
                      height: '20px',
                      borderBottom: '2px solid #22d3ee',
                      borderLeft: '2px solid #22d3ee',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '20px',
                      height: '20px',
                      borderBottom: '2px solid #22d3ee',
                      borderRight: '2px solid #22d3ee',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '8px',
                      height: '8px',
                      background: '#22d3ee',
                      borderRadius: '50%',
                      boxShadow: '0 0 12px #22d3ee, 0 0 24px rgba(34,211,238,0.4)',
                    }}
                  />
                </div>

                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    letterSpacing: '0.25em',
                    color: '#22d3ee',
                    marginBottom: '6px',
                    opacity: 0.7,
                  }}
                >
                  REORIENTING SURVEILLANCE GRID
                </div>

                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    letterSpacing: '0.15em',
                    color: '#22d3ee',
                    fontWeight: 'bold',
                    textShadow: '0 0 20px rgba(34,211,238,0.6)',
                  }}
                >
                  [ {transitionLabel} ]
                </div>

                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '9px',
                    color: '#334155',
                    marginTop: '8px',
                    letterSpacing: '0.1em',
                  }}
                >
                  ACQUIRING FEED...
                </div>
              </div>
            )}
          </div>
          <IncidentFeed resetSignal={incidentResetSignal} />
        </main>
      </EntitySelectionProvider>
    </div>
  );
}
