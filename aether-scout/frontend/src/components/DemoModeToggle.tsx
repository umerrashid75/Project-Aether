"use client";
import React from 'react';

export default function DemoModeToggle() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null;
  return (
    <div className="bg-amber-500/90 backdrop-blur-md text-amber-950 text-center py-1.5 font-bold text-xs uppercase tracking-widest shadow-lg z-50">
      DEMO MODE — Synthetic OSINT Data Active
    </div>
  );
}
