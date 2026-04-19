"use client";
import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import SitrepCard from './SitrepCard';
import { Activity, Wifi, WifiOff } from 'lucide-react';

export default function IncidentFeed({ resetSignal }: { resetSignal?: number }) {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000/ws/feed";
  const { incidents, status } = useWebSocket(wsUrl, resetSignal);

  const isConnected = status === 'open';

  const threatWeight = {
    'CRITICAL': 4,
    'HIGH': 3,
    'MEDIUM': 2,
    'LOW': 1
  };

  const sortedIncidents = [...incidents].sort((a, b) => {
    const weightA = threatWeight[a.threat_level as keyof typeof threatWeight] || 0;
    const weightB = threatWeight[b.threat_level as keyof typeof threatWeight] || 0;
    if (weightA !== weightB) {
      return weightB - weightA;
    }
    return new Date(b.detected_at || 0).getTime() - new Date(a.detected_at || 0).getTime();
  });

  return (
    <aside className="w-[380px] glass-panel border-l border-[#00e5ff]/30 flex flex-col shadow-[0_0_30px_rgba(0,0,0,0.8)] z-10 relative">
      <div className="px-5 py-4 border-b border-[#00e5ff]/20 flex items-center justify-between">
        <div>
          <h2 className="font-mono font-bold text-xs tracking-widest text-[#00e5ff]">[ TACTICAL INCIDENT FEED ]</h2>
          {incidents.length > 0 && (
            <p className="text-[10px] text-cyan-500/70 mt-1 font-mono">{incidents.length} ANOMALIES DETECTED</p>
          )}
        </div>
        <div className={`flex items-center gap-2 font-mono text-[10px] px-2 py-1 rounded-sm border transition-all ${
          isConnected
            ? 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30'
            : 'text-amber-400 bg-amber-400/10 border-amber-400/30 animate-pulse'
        }`}>
          {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{isConnected ? 'UPLINK_OK' : 'CONNECTING...'}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col gap-3">
        {sortedIncidents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-cyan-700 gap-3 opacity-50">
            <Activity size={32} />
            <p className="text-xs font-mono text-center max-w-[200px]">
              {isConnected ? 'SYSTEM ACTIVE. AWAITING THREAT DETECTION...' : 'ESTABLISHING SECURE INTELLIGENCE FEED...'}
            </p>
          </div>
        ) : (
          sortedIncidents.map((incident, idx) => (
            <SitrepCard key={incident.id || idx} incident={incident} />
          ))
        )}
      </div>
    </aside>
  );
}
