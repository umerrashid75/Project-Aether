"use client";
import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import IncidentFeed from '../../components/IncidentFeed';
import DemoModeToggle from '../../components/DemoModeToggle';
import { EntitySelectionProvider, useEntitySelection } from '../../contexts/EntitySelectionContext';
import { useVoiceCommands } from '../../hooks/useVoiceCommands';
import { VoiceMicButton } from '../../components/voice/VoiceMicButton';
import type { Sitrep } from '../../types';

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

// Inner component — needs to be inside EntitySelectionProvider to use context
function DashboardInner() {
  const { setSelectedEntityId } = useEntitySelection();
  const [currentSitrepId, setCurrentSitrepId] = useState<string | null>(null);

  const handleGenerateSitrep = useCallback(async (anomalyId: string): Promise<Sitrep> => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${apiUrl}/api/sitrep/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anomaly_id: anomalyId })
    });
    if (!res.ok) throw new Error(await res.text());
    const sitrep: Sitrep = await res.json();
    setCurrentSitrepId(sitrep.id);
    return sitrep;
  }, []);

  const handleDownloadReport = useCallback(() => {
    window.print();
  }, []);

  // Highlight entity in feed/map via EntitySelectionContext
  const handleHighlightAnomaly = useCallback((entityId: string) => {
    setSelectedEntityId(entityId);
  }, [setSelectedEntityId]);

  const { listeningState, isSupported, transcript, startListening, cancelSpeech, error } =
    useVoiceCommands({
      currentSitrepId,
      onGenerateSitrep: handleGenerateSitrep,
      onDownloadReport: handleDownloadReport,
      onHighlightAnomaly: handleHighlightAnomaly,
    });

  // V keyboard shortcut → activate voice
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Skip if focus is in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        if (listeningState === 'speaking') {
          cancelSpeech();
        } else if (listeningState === 'idle' || listeningState === 'error') {
          startListening();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listeningState, startListening, cancelSpeech]);

  return (
    <>
      <header className="px-6 py-4 border-b border-white/5 glass-panel z-10 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/50">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide">PROJECT AETHER</h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest">Dover Intelligence Scout</p>
          </div>
        </div>

        {/* Right side: classification text + voice button */}
        <div className="flex items-center gap-4">
          <div className="text-[10px] text-slate-500 font-mono flex flex-col items-end opacity-60">
            <span>UNCLASSIFIED // OSINT</span>
            <span className="tracking-[0.1em]">EDUCATIONAL USE ONLY</span>
          </div>
          {/* Mic button — hidden on Firefox (isSupported=false → unsupported state) */}
          {isSupported && (
            <div style={{ position: 'relative' }}>
              <VoiceMicButton
                listeningState={listeningState}
                transcript={transcript}
                onPress={listeningState === 'speaking' ? cancelSpeech : startListening}
                error={error}
              />
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative">
          <MapView />
        </div>
        <IncidentFeed />
      </main>

      {/* Hidden print target — populated by SitrepCard.handleExport() */}
      <div id="sitrep-print-target" style={{ display: 'none' }} />
    </>
  );
}

export default function Dashboard() {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans">
      <DemoModeToggle />
      <EntitySelectionProvider>
        <DashboardInner />
      </EntitySelectionProvider>
    </div>
  );
}
