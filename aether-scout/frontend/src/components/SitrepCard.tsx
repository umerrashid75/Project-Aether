"use client";
import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, MapPin, Search } from 'lucide-react';
import ThreatBadge from './ThreatBadge';

export default function SitrepCard({ incident }: { incident: any }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visionData, setVisionData] = useState<any>(null);
  const isSitrepGenerated = incident.sitrep_generated;
  const isCritical = incident.threat_level === 'CRITICAL';

  const runSatelliteAnalysis = async () => {
    setLoading(true);
    try {
      // In a real scenario, this URL would be fetched from Sentinel Hub for this specific GPS coordinate.
      // For now, we use a placeholder that the server will mock if DEMO_MODE=true.
      const dummyUrl = "https://example.com/tiles/sentinel2_latest.jpg";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      const res = await fetch(`${apiUrl}/api/vision/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tile_url: dummyUrl })
      });
      const data = await res.json();
      setVisionData(data);
    } catch (e) {
      console.error("Vision detection failed", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-md p-3 micro-hover">
      <div className="flex justify-between items-start mb-2">
        <ThreatBadge level={incident.threat_level as any} />
        <span className="text-[10px] text-slate-500 font-mono">
          {new Date(incident.detected_at).toLocaleTimeString()}
        </span>
      </div>
      
      <h3 className="text-sm font-semibold text-slate-200 mb-1">
        {incident.anomaly_type.toUpperCase().replace("_", " ")}
      </h3>
      
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
        <MapPin size={12} />
        <span className="font-mono">{incident.entity_id} ({incident.entity_type})</span>
      </div>

      <div className="flex flex-col gap-2">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="w-full py-1.5 flex items-center justify-center gap-1.5 text-xs text-cyan-400 hover:bg-cyan-400/10 rounded transition-colors border border-cyan-400/20"
        >
          <FileText size={14} />
          {isSitrepGenerated ? 'VIEW SITREP' : 'VIEW RAW TELEMETRY'}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {isCritical && (
          <button 
            onClick={runSatelliteAnalysis}
            disabled={loading}
            className="w-full py-1.5 flex items-center justify-center gap-1.5 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded transition-colors border border-red-500/20 disabled:opacity-50"
          >
            <Search size={14} className={loading ? "animate-spin" : ""} />
            {loading ? 'ANALYZING TILE...' : 'SATELLITE SHIP DETECTION'}
          </button>
        )}
      </div>

      {(expanded || visionData) && (
        <div className="mt-3 p-2 bg-slate-900/80 rounded border border-slate-800">
          {visionData && (
            <div className="mb-3 pb-3 border-b border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">AI Vision Result</span>
                <span className="text-[10px] text-slate-500 font-mono">{visionData.ships_detected} ships found</span>
              </div>
              <div className="p-2 bg-slate-800/50 rounded text-[10px] font-mono text-slate-300">
                {visionData.detections.map((d: any, i: number) => (
                  <div key={i} className="flex justify-between border-b border-white/5 last:border-0 py-1">
                    <span>Target {i+1}</span>
                    <span className="text-cyan-400">{(d.confidence * 100).toFixed(1)}% conf</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {expanded && (
            <>
              <pre className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap mt-1">
                {JSON.stringify(incident.details, null, 2)}
              </pre>
              {!isSitrepGenerated && (
                 <div className="mt-2 text-center text-xs text-slate-500 italic">
                   SITREP pending or not requested.
                 </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
