"use client";
import { useState, useEffect, useRef } from 'react';

export function useWebSocket(url: string) {
  const [incidents, setIncidents] = useState<any[]>([]);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!url) return;
    
    // Connect WebSocket
    const connect = () => {
      ws.current = new WebSocket(url);
      
      ws.current.onmessage = (event) => {
        try {
          const anomaly = JSON.parse(event.data);
          setIncidents((prev) => [anomaly, ...prev].slice(0, 50)); // keep last 50
        } catch(e) {
          console.error("Failed to parse websocket message", e);
        }
      };
      
      ws.current.onclose = () => {
        // Option to reconnect if needed
        setTimeout(connect, 3000);
      };
    };
    
    connect();
    
    return () => {
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
      }
    };
  }, [url]);

  return { incidents };
}
