"use client";

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import type { CoverageResult, RegionListResponse } from '../types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useRegion() {
  const [switching, setSwitching] = useState(false);

  const { data, mutate } = useSWR<RegionListResponse>(`${API}/api/region/list`, fetcher, {
    refreshInterval: 0,
  });

  const switchRegion = useCallback(
    async (regionId: string): Promise<boolean> => {
      setSwitching(true);
      try {
        const res = await fetch(`${API}/api/region/set`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ region_id: regionId }),
        });
        if (!res.ok) return false;
        await mutate();
        return true;
      } catch {
        return false;
      } finally {
        setSwitching(false);
      }
    },
    [mutate]
  );

  const checkCoverage = useCallback(async (regionId: string): Promise<CoverageResult | null> => {
    try {
      const res = await fetch(`${API}/api/region/coverage/${regionId}`);
      return res.ok ? ((await res.json()) as CoverageResult) : null;
    } catch {
      return null;
    }
  }, []);

  return {
    regions: data?.regions ?? {},
    activeRegionId: data?.active_region_id ?? 'english_channel',
    activeConfig: data ? data.regions[data.active_region_id] ?? null : null,
    switching,
    switchRegion,
    checkCoverage,
  };
}
