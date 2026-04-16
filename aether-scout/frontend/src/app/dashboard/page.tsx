import React from 'react';
import MapView from '../../components/MapView';
import IncidentFeed from '../../components/IncidentFeed';
import DemoModeToggle from '../../components/DemoModeToggle';

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
            <p className="text-xs text-slate-400 uppercase tracking-widest">Hormuz Intelligence Scout</p>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono flex flex-col items-end opacity-60">
          <span>UNCLASSIFIED // OSINT</span>
          <span className="tracking-[0.1em]">EDUCATIONAL USE ONLY</span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative">
          <MapView />
        </div>
        <IncidentFeed />
      </main>
    </div>
  );
}
