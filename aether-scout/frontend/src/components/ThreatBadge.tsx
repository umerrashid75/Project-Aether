import React from 'react';
import { THREAT_COLORS } from '../lib/threatColors';

export default function ThreatBadge({ level }: { level: keyof typeof THREAT_COLORS }) {
  const color = THREAT_COLORS[level] || '#ffffff';
  return (
    <span 
      className="px-2 py-0.5 text-[10px] rounded font-bold tracking-wider uppercase border"
      style={{
        backgroundColor: `${color}20`,
        color: color,
        borderColor: `${color}40`
      }}
    >
      {level}
    </span>
  );
}
