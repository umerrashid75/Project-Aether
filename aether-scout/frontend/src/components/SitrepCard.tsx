"use client";
import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, MapPin, Search, Cpu } from 'lucide-react';
import ThreatBadge from './ThreatBadge';
import { useEntitySelection } from '../contexts/EntitySelectionContext';

export default function SitrepCard({ incident }: { incident: any }) {
  const { selectedEntityId, setSelectedEntityId, setHoveredEntityId } = useEntitySelection();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [visionData, setVisionData] = useState<any>(null);
  const [sitrepData, setSitrepData] = useState<any>(null);
  const isSitrepGenerated = incident.sitrep_generated || sitrepData !== null;
  const isCritical = incident.threat_level === 'CRITICAL';

  const runSatelliteAnalysis = async () => {
    setLoading(true);
    try {
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

  const generateSitrep = async () => {
    setGenerating(true);
    setExpanded(true); // Auto-expand to show loading or result
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/sitrep/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anomaly_id: incident.id })
      });
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      const data = await res.json();
      setSitrepData(data);
    } catch (e) {
      console.error("Sitrep generation failed", e);
      alert("Failed to generate SITREP: " + e);
    } finally {
      setGenerating(false);
    }
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-indigo-200 font-semibold">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const isSelected = selectedEntityId === incident.entity_id;

  return (
    <div 
      className={`bg-slate-800/60 border rounded-md p-3 micro-hover transition-colors duration-200 cursor-pointer ${
        isSelected ? 'border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'border-slate-700/50 hover:border-slate-600'
      }`}
      onMouseEnter={() => setHoveredEntityId(incident.entity_id)}
      onMouseLeave={() => setHoveredEntityId(null)}
      onClick={() => setSelectedEntityId(isSelected ? null : incident.entity_id)}
    >
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
        {!isSitrepGenerated && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              generateSitrep();
            }}
            disabled={generating}
            className="w-full py-1.5 flex items-center justify-center gap-1.5 text-xs bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded transition-colors border border-indigo-500/20 disabled:opacity-50"
          >
            <Cpu size={14} className={generating ? "animate-pulse" : ""} />
            {generating ? 'AETHER-ANALYST WORKING...' : 'GENERATE AI SITREP'}
          </button>
        )}

        <button 
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="w-full py-1.5 flex items-center justify-center gap-1.5 text-xs text-cyan-400 hover:bg-cyan-400/10 rounded transition-colors border border-cyan-400/20"
        >
          <FileText size={14} />
          {isSitrepGenerated ? 'VIEW SITREP / TELEMETRY' : 'VIEW RAW TELEMETRY'}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {isCritical && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              runSatelliteAnalysis();
            }}
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
              {sitrepData ? (
                <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap mt-1 leading-relaxed border-t border-indigo-500/30 pt-2 bg-indigo-950/10 p-2 rounded">
                  <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Cpu size={12} />
                    AETHER-ANALYST REPORT
                  </div>
                  {renderFormattedText(sitrepData.body)}
                </div>
              ) : (
                <>
                  <pre className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap mt-1 overflow-x-auto">
                    {JSON.stringify(incident.details, null, 2)}
                  </pre>
                  {!isSitrepGenerated && (
                    <div className="mt-2 text-center text-xs text-slate-500 italic border-t border-slate-700/50 pt-2">
                      SITREP pending or not requested. Click "Generate AI SITREP" above.
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
