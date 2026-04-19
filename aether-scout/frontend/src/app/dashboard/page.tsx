"use client";
import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import IncidentFeed from '../../components/IncidentFeed';
import DemoModeToggle from '../../components/DemoModeToggle';
import { EntitySelectionProvider } from '../../contexts/EntitySelectionContext';
import { RegionSelector } from '../../components/RegionSelector';
import { useRegion } from '../../hooks/useRegion';
import { useTelemetry } from '../../hooks/useTelemetry';
import type { RegionConfig } from '../../types';
import type { MapRef } from 'react-map-gl';

const REGION_TRANSITION_THEME: Record<string, { primary: string; secondary: string; online: string; glow: string; panel: string }> = {
  english_channel: { primary: '#67e8f9', secondary: '#22d3ee', online: '#bbf7d0', glow: 'rgba(14,116,144,0.45)', panel: 'rgba(2, 10, 24, 0.9)' },
  north_sea: { primary: '#93c5fd', secondary: '#38bdf8', online: '#dbeafe', glow: 'rgba(30,64,175,0.45)', panel: 'rgba(2, 12, 30, 0.92)' },
  mediterranean_west: { primary: '#fdba74', secondary: '#fb923c', online: '#fef3c7', glow: 'rgba(194,65,12,0.4)', panel: 'rgba(28, 9, 4, 0.9)' },
  us_east_coast: { primary: '#a5f3fc', secondary: '#06b6d4', online: '#dcfce7', glow: 'rgba(8,145,178,0.4)', panel: 'rgba(2, 12, 26, 0.92)' },
  gibraltar: { primary: '#fca5a5', secondary: '#f97316', online: '#fee2e2', glow: 'rgba(194,65,12,0.42)', panel: 'rgba(30, 10, 6, 0.9)' },
  bosphorus: { primary: '#c4b5fd', secondary: '#818cf8', online: '#e9d5ff', glow: 'rgba(79,70,229,0.42)', panel: 'rgba(12, 10, 36, 0.9)' },
  us_west_coast: { primary: '#86efac', secondary: '#10b981', online: '#dcfce7', glow: 'rgba(5,150,105,0.42)', panel: 'rgba(3, 20, 16, 0.9)' },
  strait_of_hormuz: { primary: '#fca5a5', secondary: '#ef4444', online: '#fee2e2', glow: 'rgba(185,28,28,0.45)', panel: 'rgba(30, 7, 10, 0.92)' },
};

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
  const mapRef = useRef<MapRef | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionLabel, setTransitionLabel] = useState('');
  const [transitionStage, setTransitionStage] = useState('Repositioning orbital camera');
  const [transitionProgress, setTransitionProgress] = useState(6);
  const [transitionOnline, setTransitionOnline] = useState(false);
  const [transitionTheme, setTransitionTheme] = useState(REGION_TRANSITION_THEME.english_channel);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [incidentResetSignal, setIncidentResetSignal] = useState(0);
  const { activeConfig } = useRegion();
  const { aircraft, vessels } = useTelemetry();

  useEffect(() => {
    const saved = window.localStorage.getItem('aether-transition-sound');
    if (saved === null) return;
    setSoundEnabled(saved === 'on');
  }, []);

  function toggleSound() {
    setSoundEnabled((value) => {
      const next = !value;
      window.localStorage.setItem('aether-transition-sound', next ? 'on' : 'off');
      return next;
    });
  }

  function playTransitionCue(kind: 'start' | 'online') {
    if (!soundEnabled) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();

    const tones =
      kind === 'start'
        ? [
            { freq: 320, at: 0, duration: 0.09 },
            { freq: 420, at: 0.11, duration: 0.09 },
            { freq: 560, at: 0.23, duration: 0.11 },
          ]
        : [
            { freq: 540, at: 0, duration: 0.08 },
            { freq: 760, at: 0.1, duration: 0.08 },
            { freq: 980, at: 0.2, duration: 0.12 },
          ];

    const now = context.currentTime;
    for (const tone of tones) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(tone.freq, now + tone.at);
      gain.gain.setValueAtTime(0.0001, now + tone.at);
      gain.gain.exponentialRampToValueAtTime(0.05, now + tone.at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.at + tone.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + tone.at);
      oscillator.stop(now + tone.at + tone.duration);
    }

    const total = tones[tones.length - 1].at + tones[tones.length - 1].duration + 0.08;
    window.setTimeout(() => {
      context.close().catch(() => undefined);
    }, Math.ceil(total * 1000));
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForMapEvent(map: MapRef, event: 'moveend' | 'rotateend', timeoutMs: number) {
    const mapbox = map.getMap();
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      mapbox.once(event, finish);
      setTimeout(finish, timeoutMs);
    });
  }

  async function handleRegionChange(regionId: string, config: RegionConfig) {
    if (!mapRef.current) return;

    setIncidentResetSignal((value) => value + 1);

    setTransitionLabel(config.label.toUpperCase());
    setTransitionStage('Repositioning orbital camera');
    setTransitionProgress(6);
    setTransitionTheme(REGION_TRANSITION_THEME[regionId] ?? REGION_TRANSITION_THEME.english_channel);
    setTransitionOnline(false);
    setTransitioning(true);
    playTransitionCue('start');

    const map = mapRef.current;

    map.flyTo({
      zoom: 2.5,
      duration: 800,
      easing: (t: number) => t * (2 - t),
      essential: true,
    });

    await Promise.race([waitForMapEvent(map, 'moveend', 1200), sleep(850)]);
    setTransitionProgress(30);
    setTransitionStage('Vector frame rotation in progress');

    map.rotateTo(180, {
      duration: 700,
      easing: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    });

    await Promise.race([waitForMapEvent(map, 'rotateend', 1000), sleep(700)]);
    setTransitionProgress(52);
    setTransitionStage('Acquiring regional telemetry feeds');
    map.rotateTo(0, { duration: 0 });

    map.flyTo({
      center: [config.center[1], config.center[0]],
      zoom: config.zoom,
      bearing: 0,
      pitch: 45,
      duration: 1800,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      essential: true,
    });

    await Promise.race([waitForMapEvent(map, 'moveend', 2300), sleep(1900)]);
    setTransitionProgress(76);
    setTransitionStage('Normalizing radar sweep parameters');

    map.easeTo({
      pitch: 0,
      duration: 600,
      easing: (t: number) => t * (2 - t),
    });

    await Promise.race([waitForMapEvent(map, 'moveend', 1000), sleep(700)]);
    setTransitionProgress(93);
    setTransitionStage('Locking tactical viewport');

    await sleep(240);
    setTransitionProgress(100);
    setTransitionOnline(true);
    setTransitionStage('Region online. Intelligence stream stabilized');
    playTransitionCue('online');
    await sleep(320);
    setTransitioning(false);
    setTransitionOnline(false);
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans">
      <DemoModeToggle />
      <header className="px-6 py-4 border-b border-white/5 glass-panel z-10 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/50">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide">PROJECT GOD'S EYE</h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest">
              [ {activeConfig?.label?.toUpperCase() ?? 'ENGLISH CHANNEL'} ] INTELLIGENCE SCOUT
            </p>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono flex flex-col items-end opacity-60">
          <span>UNCLASSIFIED // OSINT</span>
          <span className="tracking-[0.1em]">EDUCATIONAL USE ONLY</span>
        </div>
        <button
          onClick={toggleSound}
          className="region-sound-toggle"
          title={soundEnabled ? 'Disable transition sounds' : 'Enable transition sounds'}
          aria-label={soundEnabled ? 'Disable transition sounds' : 'Enable transition sounds'}
        >
          {soundEnabled ? 'SFX ON' : 'SFX OFF'}
        </button>
      </header>

      <EntitySelectionProvider>
        <main className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 relative">
            <MapView onMapReady={(map) => { mapRef.current = map; }} />
            <RegionSelector onRegionChange={handleRegionChange} />
            {transitioning && (
              <div
                className="region-transition-overlay"
                style={{
                  ['--rt-primary' as string]: transitionTheme.primary,
                  ['--rt-secondary' as string]: transitionTheme.secondary,
                  ['--rt-online' as string]: transitionTheme.online,
                  ['--rt-glow' as string]: transitionTheme.glow,
                  ['--rt-panel' as string]: transitionTheme.panel,
                }}
              >
                <div className="region-transition-vignette" />
                <div className="region-transition-grid" />
                <div className="region-transition-sweep" />

                <div className="region-transition-panel">
                  <div className="region-transition-ring">
                    <div className="ring ring-outer" />
                    <div className="ring ring-inner" />
                    <div className="ring-center" />
                  </div>

                  <div className="region-transition-title">REGION TRANSITION ACTIVE</div>
                  <div className="region-transition-target">[ {transitionLabel} ]</div>
                  <div className="region-transition-stage">{transitionStage}</div>

                  <div className="region-transition-counters">
                    <div className="counter-block">
                      <span className="counter-label">AIR TRAFFIC</span>
                      <span className="counter-value">{aircraft.length}</span>
                    </div>
                    <div className="counter-block">
                      <span className="counter-label">SEA TRAFFIC</span>
                      <span className="counter-value">{vessels.length}</span>
                    </div>
                  </div>

                  <div className="region-transition-progress-shell" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={transitionProgress}>
                    <div className="region-transition-progress-fill" style={{ width: `${transitionProgress}%` }} />
                  </div>
                  <div className="region-transition-progress-caption">{transitionProgress}% COMPLETE</div>

                  {transitionOnline && <div className="region-transition-online">REGION ONLINE</div>}
                </div>
              </div>
            )}
          </div>
          <IncidentFeed resetSignal={incidentResetSignal} />
        </main>
      </EntitySelectionProvider>
    </div>
  );
}
