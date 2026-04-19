"use client";
import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket(url: string, resetSignal?: number) {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const ws = useRef<WebSocket | null>(null);
  const retryDelay = useRef(1000);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!url || typeof window === 'undefined') return;

    try {
      ws.current = new WebSocket(url);
      setStatus('connecting');

      ws.current.onopen = () => {
        setStatus('open');
        retryDelay.current = 1000; // reset backoff on success
        console.log('[Aether] WebSocket connected to', url);
      };

      ws.current.onmessage = (event) => {
        try {
          const anomaly = JSON.parse(event.data);
          setIncidents((prev) => [anomaly, ...prev].slice(0, 50));
        } catch (e) {
          console.error('[Aether] Failed to parse WS message', e);
        }
      };

      ws.current.onerror = (err) => {
        console.error('[Aether] WebSocket error:', err);
      };

      ws.current.onclose = () => {
        setStatus('closed');
        const delay = Math.min(retryDelay.current, 30000);
        console.log(`[Aether] WebSocket closed. Retrying in ${delay}ms...`);
        retryTimer.current = setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 2, 30000);
          connect();
        }, delay);
      };
    } catch (e) {
      console.error('[Aether] Failed to create WebSocket:', e);
    }
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (ws.current) {
        ws.current.onclose = null; // prevent retry on intentional close
        ws.current.close();
      }
    };
  }, [connect]);

  useEffect(() => {
    setIncidents([]);
  }, [resetSignal]);

  return { incidents, status };
}
