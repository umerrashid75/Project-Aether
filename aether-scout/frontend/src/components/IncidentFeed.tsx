"use client";
import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import SitrepCard from './SitrepCard';
import { Activity } from 'lucide-react';

export default function IncidentFeed() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/feed";
  const { incidents } = useWebSocket(wsUrl);

  return (
    <aside className="w-[380px] glass-panel border-l border-white/5 flex flex-col shadow-2xl z-10 relative">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="font-semibold text-sm tracking-wide text-slate-200">REAL-TIME INCIDENTS</h2>
        <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded border border-cyan-400/20">
          <Activity size={14} className="animate-pulse" />
          <span>LIVE</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col gap-3">
        {incidents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3 opacity-50">
            <Activity size={32} />
            <p className="text-sm">Awaiting telemetry...</p>
          </div>
        ) : (
          incidents.map((incident, idx) => (
            <SitrepCard key={incident.id || idx} incident={incident} />
          ))
        )}
      </div>
    </aside>
  );
}
