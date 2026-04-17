"use client";
import React from 'react';
import Map, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTelemetry } from '../hooks/useTelemetry';
import { useEntitySelection } from '../contexts/EntitySelectionContext';
import { THREAT_COLORS } from '../lib/threatColors';
import { motion, AnimatePresence } from 'framer-motion';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

const AircraftIcon = ({ color, rotate }: { color: string, rotate: number }) => (
  <div style={{ transform: `rotate(${rotate}deg)`, width: '24px', height: '40px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg viewBox="0 0 24 24" width="16" height="16" style={{ position: 'absolute', top: '4px' }}>
      <path d="M12 2 L22 22 L12 18 L2 22 Z" fill={color} />
      <path d="M12 2 L22 22 L12 18 L2 22 Z" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.5" />
    </svg>
    <svg viewBox="0 0 2 24" width="2" height="24" style={{ position: 'absolute', top: '18px', zIndex: -1 }}>
      <line x1="1" y1="0" x2="1" y2="24" stroke={color} strokeWidth="1" strokeDasharray="2, 2" opacity="0.6" />
    </svg>
  </div>
);

const VesselIcon = ({ color, isMoving, rotate }: { color: string, isMoving: boolean, rotate: number }) => (
  <div style={{ transform: `rotate(${rotate}deg)`, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg viewBox="0 0 24 24" width="14" height="14">
      {isMoving ? (
        <polygon points="12 2, 24 22, 0 22" fill="none" stroke={color} strokeWidth="3" />
      ) : (
        <rect x="4" y="4" width="16" height="16" fill="none" stroke={color} strokeWidth="3" />
      )}
    </svg>
  </div>
);

export default function MapView() {
  const { aircraft, vessels } = useTelemetry();
  const { selectedEntityId, setSelectedEntityId, hoveredEntityId } = useEntitySelection();
  
  const getColor = (level: string) => THREAT_COLORS[level as keyof typeof THREAT_COLORS] || THREAT_COLORS.LOW;

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'pk.dummy_value_replace_me_later') {
    return (
      <div className="absolute inset-0 bg-obsidian border border-slate-800 flex items-center justify-center text-slate-500 flex-col gap-4">
        <div className="w-16 h-16 rounded-full border border-cyan-700 flex items-center justify-center mb-2 animate-pulse">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
        </div>
        <p className="max-w-sm text-center text-sm font-mono leading-relaxed">Mapbox visualizer offline.<br/><span className="text-amber-500/70">A valid NEXT_PUBLIC_MAPBOX_TOKEN is required.</span></p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-slate-900 border-r border-[#00e5ff] overflow-hidden">
      <Map
        initialViewState={{
          longitude: 1.5,
          latitude: 51.0,
          zoom: 8
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%', filter: 'grayscale(0.6) brightness(0.6) contrast(1.2)' }}
      >
        {/* Radar Overlays */}
        <div className="absolute inset-0 radar-grid z-0" />
        <div className="scanline z-0" />

        {/* Aircraft Layer */}
        {aircraft && aircraft.map((a: any) => {
          if (!a.position || a.position.length !== 2) return null;
          const threatLevel = a.threat_level || 'LOW';
          // Aircraft keep Cyan base
          const color = getColor(threatLevel);
          const isSelected = String(selectedEntityId) === String(a.icao24);
          const isHovered = String(hoveredEntityId) === String(a.icao24);
          const zIndex = isHovered || isSelected ? 50 : 1;
          const displayTrack = a.track || 0;
          
          return (
            <React.Fragment key={`air-${a.icao24}`}>
              <Marker longitude={a.position[0]} latitude={a.position[1]} anchor="center" style={{ zIndex }}>
                <div 
                  className={`relative flex items-center justify-center p-1 cursor-pointer transition-all duration-200 ${isSelected || isHovered ? 'targeting-bracket text-[#00e5ff]' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEntityId(a.icao24);
                  }}
                >
                  <AircraftIcon color={isSelected ? '#fff' : color} rotate={displayTrack} />
                </div>
              </Marker>

              <AnimatePresence>
                {isSelected && (
                  <Popup
                    longitude={a.position[0]}
                    latitude={a.position[1]}
                    anchor="bottom"
                    offset={25}
                    onClose={() => setSelectedEntityId(null)}
                    closeButton={false}
                    className="!z-[100] custom-popup"
                    maxWidth="240px"
                    style={{ zIndex: 1000, background: 'transparent' }}
                  >
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="glass-panel text-xs rounded-none shadow-[0_0_20px_rgba(0,0,0,0.9)] p-3 relative overflow-hidden pointer-events-auto"
                    >
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-[#00e5ff] shadow-[0_0_10px_#00e5ff]"></div>
                      <div className="flex justify-between items-center border-b border-[#00e5ff]/20 pb-1.5 mb-2.5 leading-none">
                        <span className="font-mono font-bold text-[#00e5ff] tracking-widest text-[9px] uppercase">
                          [ AIRCRAFT_UNIT ]
                        </span>
                        <span className="font-mono text-[#00e5ff] text-[9px] font-bold">
                          {a.icao24}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-[60px_1fr] gap-y-1.5 font-mono items-baseline">
                        <span className="tech-label text-[9px]">CALLSIGN</span>
                        <span className="tech-value text-right truncate pl-2">{a.callsign?.trim() || "N/A"}</span>
                        
                        {a.departure && (
                          <>
                            <span className="tech-label text-[9px] font-bold text-pink-400/80">ORIGIN</span>
                            <span className="text-pink-400 font-bold text-right text-[9px] leading-tight pl-2">{a.departure}</span>
                          </>
                        )}
                        
                        {a.destination && (
                          <>
                            <span className="tech-label text-[9px] font-bold text-pink-400/80">DESTIN</span>
                            <span className="text-pink-400 font-bold text-right text-[9px] leading-tight pl-2">{a.destination}</span>
                          </>
                        )}
                        
                        <span className="tech-label text-[9px]">ALTITUDE</span>
                        <span className="tech-value text-right pl-2">{Math.round(a.altitude_m || 0).toLocaleString()} M</span>
                        
                        <span className="tech-label text-[9px]">VELOCITY</span>
                        <span className="tech-value text-right pl-2">{Math.round(a.velocity_ms || 0)} M/S</span>
                        
                        <span className="tech-label text-[9px]">COUNTRY</span>
                        <span className="tech-value text-right truncate pl-2">{a.origin_country || "UNK"}</span>
                      </div>
                    </motion.div>
                  </Popup>
                )}
              </AnimatePresence>
            </React.Fragment>
          );
        })}
        
        {/* Vessel Layer */}
        {vessels && vessels.map((v: any) => {
          if (!v.position || v.position.length !== 2) return null;
          const threatLevel = v.threat_level || 'LOW';
          // Vessels use Teal/Emerald theme for differentiation
          const getVesselColor = (lvl: string) => {
            if (lvl === 'CRITICAL') return '#ef4444'; // Keep red for critical
            if (lvl === 'HIGH') return '#f97316';     // Keep orange for high
            return '#10b981'; // Emerald for Low/Medium
          };
          const color = getVesselColor(threatLevel);
          const isSelected = String(selectedEntityId) === String(v.mmsi);
          const isHovered = String(hoveredEntityId) === String(v.mmsi);
          const zIndex = isHovered || isSelected ? 50 : 1;
          const isMoving = (v.speed_knots || 0) > 0.5;

          return (
            <React.Fragment key={`ves-${v.mmsi}`}>
              <Marker longitude={v.position[0]} latitude={v.position[1]} anchor="center" style={{ zIndex }}>
                <div 
                  className={`relative flex items-center justify-center p-1 cursor-pointer transition-all duration-200 ${isSelected || isHovered ? 'targeting-bracket text-[#10b981]' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEntityId(v.mmsi);
                  }}
                >
                  <VesselIcon color={isSelected ? '#fff' : color} isMoving={isMoving} rotate={v.course || 0} />
                </div>
              </Marker>

              <AnimatePresence>
                {isSelected && (
                  <Popup
                    longitude={v.position[0]}
                    latitude={v.position[1]}
                    anchor="bottom"
                    offset={20}
                    onClose={() => setSelectedEntityId(null)}
                    closeButton={false}
                    className="!z-[100] custom-popup"
                    maxWidth="240px"
                    style={{ zIndex: 1000, background: 'transparent' }}
                  >
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="glass-panel text-xs rounded-none shadow-[0_0_20px_rgba(0,0,0,0.9)] p-3 relative overflow-hidden pointer-events-auto"
                    >
                      <div className="absolute top-0 left-0 w-[2px] h-full bg-[#10b981] shadow-[0_0_10px_#10b981]"></div>
                      <div className="flex justify-between items-center border-b border-[#10b981]/20 pb-1.5 mb-2.5 leading-none">
                        <span className="font-mono font-bold text-[#10b981] tracking-widest text-[9px] uppercase">
                          [ MARITIME_UNIT ]
                        </span>
                        <span className="font-mono text-[#10b981] text-[9px] font-bold">
                          {v.mmsi}
                        </span>
                      </div>

                      <div className="grid grid-cols-[60px_1fr] gap-y-1.5 font-mono items-baseline">
                        <span className="tech-label text-[9px]">IDENT</span>
                        <span className="tech-value text-right truncate pl-2">{v.ship_name?.trim() || "UNK"}</span>
                        
                        {v.departure && (
                          <>
                            <span className="tech-label text-[9px] font-bold text-teal-400/80">ORIGIN</span>
                            <span className="text-teal-400 font-bold text-right text-[9px] leading-tight pl-2">{v.departure}</span>
                          </>
                        )}
                        
                        {v.destination && (
                          <>
                            <span className="tech-label text-[9px] font-bold text-teal-400/80">DESTIN</span>
                            <span className="text-teal-400 font-bold text-right text-[9px] leading-tight pl-2">{v.destination}</span>
                          </>
                        )}
                        
                        <span className="tech-label text-[9px]">SPEED</span>
                        <span className="tech-value text-right pl-2">{v.speed_knots || 0} KTS</span>
                        
                        <span className="tech-label text-[9px]">COURSE</span>
                        <span className="tech-value text-right pl-2">{v.course || 0}°</span>
                      </div>
                    </motion.div>
                  </Popup>
                )}
              </AnimatePresence>
            </React.Fragment>
          );
        })}
      </Map>
    </div>
  );
}
