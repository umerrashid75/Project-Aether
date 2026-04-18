"use client";
import React from 'react';
import dynamic from 'next/dynamic';
import IncidentFeed from '../../components/IncidentFeed';
import DemoModeToggle from '../../components/DemoModeToggle';
import { EntitySelectionProvider } from '../../contexts/EntitySelectionContext';

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
  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans">
      <DemoModeToggle />
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
        <div className="text-[10px] text-slate-500 font-mono flex flex-col items-end opacity-60">
          <span>UNCLASSIFIED // OSINT</span>
          <span className="tracking-[0.1em]">EDUCATIONAL USE ONLY</span>
        </div>
      </header>

      <EntitySelectionProvider>
        <main className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 relative">
            <MapView />
          </div>
          <IncidentFeed />
        </main>
      </EntitySelectionProvider>

      {/* Hidden print target — populated by SitrepCard.handleExport() */}
      <div id="sitrep-print-target" style={{ display: 'none' }} />
    </div>
  );
}
