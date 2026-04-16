"use client";
import React from 'react';
import Map, { Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Plane, Ship } from 'lucide-react';
import { useTelemetry } from '../hooks/useTelemetry';
import { THREAT_COLORS } from '../lib/threatColors';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export default function MapView() {
  const { aircraft, vessels } = useTelemetry();
  
  const getColor = (level: string) => THREAT_COLORS[level as keyof typeof THREAT_COLORS] || THREAT_COLORS.LOW;

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'pk.dummy_value_replace_me_later') {
    return (
      <div className="absolute inset-0 bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 flex-col gap-4">
        <div className="w-16 h-16 rounded-full border border-slate-700 flex items-center justify-center mb-2 animate-pulse">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
        </div>
        <p className="max-w-sm text-center text-sm font-mono leading-relaxed">Mapbox visualizer offline.<br/><span className="text-amber-500/70">A valid NEXT_PUBLIC_MAPBOX_TOKEN is required.</span></p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-slate-900">
      <Map
        initialViewState={{
          longitude: 56.5,
          latitude: 26.6,
          zoom: 8
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Aircraft Layer */}
        {aircraft && aircraft.map((a: any) => {
          if (!a.position || a.position.length !== 2) return null;
          const color = getColor(a.threat_level || 'LOW');
          return (
            <Marker key={`air-${a.icao24}`} longitude={a.position[0]} latitude={a.position[1]} anchor="center">
              <div 
                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-900/90 border micro-hover cursor-pointer shadow-lg"
                style={{ borderColor: color, color: color, boxShadow: `0 0 10px ${color}30` }}
                title={`Callsign: ${a.callsign} | Alt: ${Math.round(a.altitude_m || 0)}m`}
              >
                <Plane size={15} style={{ transform: `rotate(${a.track || 0}deg)` }} />
              </div>
            </Marker>
          );
        })}
        
        {/* Vessel Layer */}
        {vessels && vessels.map((v: any) => {
          if (!v.position || v.position.length !== 2) return null;
          const color = getColor(v.threat_level || 'LOW');
          return (
            <Marker key={`ves-${v.mmsi}`} longitude={v.position[0]} latitude={v.position[1]} anchor="center">
              <div 
                className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-900/90 border micro-hover cursor-pointer shadow-lg"
                style={{ borderColor: color, color: color, boxShadow: `0 0 10px ${color}30` }}
                title={`Name: ${v.ship_name || v.mmsi} | SOG: ${v.speed_knots || 0}kt`}
              >
                <Ship size={13} style={{ transform: `rotate(${v.course || 0}deg)` }} />
              </div>
            </Marker>
          );
        })}
      </Map>
    </div>
  );
}
