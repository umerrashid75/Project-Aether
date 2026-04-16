"use client";
import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import SitrepCard from './SitrepCard';
import { Activity, Wifi, WifiOff } from 'lucide-react';

export default function IncidentFeed() {
  // NEXT_PUBLIC_WS_URL should include the full path e.g. ws://127.0.0.1:8000/ws/feed
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000/ws/feed";
  const { incidents, status } = useWebSocket(wsUrl);

  const isConnected = status === 'open';

  return (
    <aside className="w-[380px] glass-panel border-l border-white/5 flex flex-col shadow-2xl z-10 relative">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm tracking-wide text-slate-200">REAL-TIME INCIDENTS</h2>
          {incidents.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">{incidents.length} anomal{incidents.length === 1 ? 'y' : 'ies'} detected</p>
          )}
        </div>
        <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded border transition-all ${
          isConnected
            ? 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
            : 'text-amber-400 bg-amber-400/10 border-amber-400/20 animate-pulse'
        }`}>
          {isConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span>{isConnected ? 'LIVE' : 'CONNECTING...'}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col gap-3">
        {incidents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3 opacity-50">
            <Activity size={32} />
            <p className="text-sm text-center">
              {isConnected ? 'Scout active. Awaiting anomaly detection...' : 'Connecting to intelligence feed...'}
            </p>
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
