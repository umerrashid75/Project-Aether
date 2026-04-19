"use client";

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Radio, Search } from 'lucide-react';
import { useRegion } from '../hooks/useRegion';
import type { CoverageResult, RegionConfig } from '../types';

const QUALITY_COLOR: Record<string, string> = {
  excellent: '#22d3ee',
  very_good: '#22d3ee',
  good: '#f59e0b',
  poor: '#ef4444',
};

const QUALITY_DOT: Record<string, string> = {
  excellent: '●',
  very_good: '◕',
  good: '◑',
  poor: '○',
};

const QUALITY_ORDER: Record<string, number> = {
  excellent: 0,
  very_good: 1,
  good: 2,
  poor: 3,
};

function RegionCard({
  config,
  isActive,
  coverage,
  coverageLoading,
  onSelect,
  onHover,
}: {
  config: RegionConfig;
  isActive: boolean;
  coverage: CoverageResult | null;
  coverageLoading: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const borderColor = isActive ? (QUALITY_COLOR[config.opensky_quality] ?? '#22d3ee') : '#1e293b';

  return (
    <div
      onClick={onSelect}
      onMouseEnter={onHover}
      style={{
        padding: '10px 12px',
        marginBottom: '4px',
        border: `1px solid ${borderColor}`,
        borderRadius: '4px',
        background: isActive ? 'rgba(34,211,238,0.06)' : 'transparent',
        cursor: isActive ? 'default' : 'pointer',
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
    >
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: '11px',
          letterSpacing: '0.08em',
          color: isActive ? (QUALITY_COLOR[config.opensky_quality] ?? '#22d3ee') : '#e2e8f0',
          fontWeight: isActive ? 'bold' : 'normal',
          marginBottom: '3px',
        }}
      >
        {isActive ? `[ ${config.label.toUpperCase()} ]` : config.label.toUpperCase()}
      </div>

      <div
        style={{
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#64748b',
          marginBottom: '6px',
        }}
      >
        {config.description}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '9px',
            color: QUALITY_COLOR[config.opensky_quality] ?? '#64748b',
          }}
        >
          {QUALITY_DOT[config.opensky_quality]} ADS-B
        </span>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '9px',
            color: QUALITY_COLOR[config.ais_quality] ?? '#64748b',
          }}
        >
          {QUALITY_DOT[config.ais_quality]} AIS
        </span>

        {coverageLoading && (
          <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#334155', marginLeft: 'auto' }}>
            CHECKING...
          </span>
        )}
        {coverage && !coverageLoading && (
          <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#94a3b8', marginLeft: 'auto' }}>
            {coverage.aircraft}✈
            {coverage.vessels !== null ? ` ${coverage.vessels}⚓` : ''}
          </span>
        )}

        {config.demo_recommended && (
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '9px',
              color: '#f59e0b',
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <AlertTriangle size={9} /> DEMO
          </span>
        )}
      </div>
    </div>
  );
}

interface RegionSelectorProps {
  onRegionChange: (regionId: string, config: RegionConfig) => void;
}

export function RegionSelector({ onRegionChange }: RegionSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [coverageCache, setCoverageCache] = useState<Record<string, CoverageResult>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  const { regions, activeRegionId, switching, switchRegion, checkCoverage } = useRegion();

  const filtered = Object.keys(regions).filter((id) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const region = regions[id];
    if (!region) return false;
    return region.label.toLowerCase().includes(q) || region.description.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a === activeRegionId) return -1;
    if (b === activeRegionId) return 1;
    return (
      (QUALITY_ORDER[regions[a]?.opensky_quality ?? 'poor'] ?? 3) -
      (QUALITY_ORDER[regions[b]?.opensky_quality ?? 'poor'] ?? 3)
    );
  });

  async function handleHover(regionId: string) {
    if (coverageCache[regionId]) return;
    setLoadingId(regionId);
    const result = await checkCoverage(regionId);
    if (result) {
      setCoverageCache((prev) => ({ ...prev, [regionId]: result }));
    }
    setLoadingId(null);
  }

  async function handleSelect(regionId: string) {
    if (regionId === activeRegionId || switching) return;
    const success = await switchRegion(regionId);
    if (success) {
      const config = regions[regionId];
      if (config) {
        onRegionChange(regionId, config);
        setExpanded(false);
      }
    }
  }

  useEffect(() => {
    if (expanded) {
      window.setTimeout(() => searchRef.current?.focus(), 150);
    } else {
      setSearch('');
    }
  }, [expanded]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        display: 'flex',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: expanded ? '280px' : '0px',
          overflow: 'hidden',
          transition: 'width 0.25s ease',
          background: 'rgba(2, 8, 23, 0.97)',
          borderRight: expanded ? '1px solid #1e293b' : 'none',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: expanded ? 'all' : 'none',
        }}
      >
        {expanded && (
          <>
            <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid #1e293b' }}>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  letterSpacing: '0.15em',
                  color: '#22d3ee',
                  marginBottom: '10px',
                }}
              >
                [ MONITORING REGION ]
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '9px',
                  color: '#64748b',
                  letterSpacing: '0.08em',
                  marginBottom: '3px',
                }}
              >
                ACTIVE
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#22d3ee',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Radio size={11} color="#22d3ee" />
                {regions[activeRegionId]?.label.toUpperCase() ?? '-'}
              </div>
            </div>

            <div style={{ padding: '10px 14px', borderBottom: '1px solid #0f172a' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '4px',
                  padding: '6px 10px',
                }}
              >
                <Search size={12} color="#334155" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search regions..."
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#e2e8f0',
                    width: '100%',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px 14px',
                scrollbarWidth: 'thin',
                scrollbarColor: '#1e293b transparent',
              }}
            >
              {!search && (
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '9px',
                    letterSpacing: '0.12em',
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  AVAILABLE REGIONS
                </div>
              )}
              {sorted.length === 0 && (
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: '#334155',
                    textAlign: 'center',
                    paddingTop: '20px',
                  }}
                >
                  NO REGIONS MATCH
                </div>
              )}
              {sorted.map((regionId) => {
                const config = regions[regionId];
                if (!config) return null;
                return (
                  <RegionCard
                    key={regionId}
                    config={config}
                    isActive={regionId === activeRegionId}
                    coverage={coverageCache[regionId] ?? null}
                    coverageLoading={loadingId === regionId}
                    onSelect={() => handleSelect(regionId)}
                    onHover={() => handleHover(regionId)}
                  />
                );
              })}
            </div>

            <div
              style={{
                padding: '8px 14px',
                borderTop: '1px solid #0f172a',
                fontFamily: 'monospace',
                fontSize: '8px',
                color: '#1e293b',
                letterSpacing: '0.05em',
              }}
            >
              COVERAGE BASED ON OPENSKY + AISSTREAM DENSITY
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => setExpanded((value) => !value)}
        title={expanded ? 'Close region selector' : 'Select monitoring region'}
        style={{
          width: '40px',
          height: '56px',
          alignSelf: 'center',
          marginTop: '80px',
          background: 'rgba(2, 8, 23, 0.95)',
          border: '1px solid #1e293b',
          borderLeft: 'none',
          borderRadius: '0 4px 4px 0',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          pointerEvents: 'all',
        }}
      >
        {expanded ? <ChevronLeft size={14} color="#22d3ee" /> : <ChevronRight size={14} color="#22d3ee" />}
        {!expanded && (
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '8px',
              color: '#334155',
              writingMode: 'vertical-rl',
              letterSpacing: '0.1em',
            }}
          >
            REGION
          </span>
        )}
      </button>
    </div>
  );
}
