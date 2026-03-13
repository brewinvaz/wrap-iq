'use client';

import React, { useMemo } from 'react';
import { useTheme } from '@/lib/theme';

const MAJOR = 120;
const MEDIUM = 24;
const MINOR = 12;
const RULER_SIZE = 20;
const COLOR = '#06b6d4';

export default function RulerOverlay() {
  const { resolvedTheme } = useTheme();

  const horizontalTicks = useMemo(() => {
    const ticks: React.JSX.Element[] = [];
    // Generate enough ticks for a wide viewport (3840px)
    for (let x = 0; x <= 3840; x += MINOR) {
      const isMajor = x % MAJOR === 0;
      const isMedium = !isMajor && x % MEDIUM === 0;
      const y1 = isMajor ? 0 : isMedium ? 10 : 14;
      const strokeWidth = isMajor ? 1 : isMedium ? 0.5 : 0.3;
      ticks.push(
        <line key={x} x1={x} y1={y1} x2={x} y2={RULER_SIZE} stroke={COLOR} strokeWidth={strokeWidth} />
      );
    }
    return ticks;
  }, []);

  const verticalTicks = useMemo(() => {
    const ticks: React.JSX.Element[] = [];
    for (let y = 0; y <= 2160; y += MINOR) {
      const isMajor = y % MAJOR === 0;
      const isMedium = !isMajor && y % MEDIUM === 0;
      const x1 = isMajor ? 0 : isMedium ? 10 : 14;
      const strokeWidth = isMajor ? 1 : isMedium ? 0.5 : 0.3;
      ticks.push(
        <line key={y} x1={x1} y1={y} x2={RULER_SIZE} y2={y} stroke={COLOR} strokeWidth={strokeWidth} />
      );
    }
    return ticks;
  }, []);

  if (resolvedTheme !== 'dark') return null;

  return (
    <>
      {/* Corner square */}
      <div
        className="fixed left-0 top-0 z-[1] pointer-events-none"
        style={{
          width: RULER_SIZE,
          height: RULER_SIZE,
          background: 'rgba(6, 182, 212, 0.04)',
          borderRight: '1px solid rgba(6, 182, 212, 0.08)',
          borderBottom: '1px solid rgba(6, 182, 212, 0.08)',
        }}
      />

      {/* Top ruler */}
      <div
        className="fixed top-0 right-0 z-[1] pointer-events-none"
        style={{ left: RULER_SIZE, height: RULER_SIZE }}
      >
        <svg width="100%" height={RULER_SIZE} style={{ opacity: 0.15 }}>
          {horizontalTicks}
          <line x1="0" y1={RULER_SIZE - 0.5} x2="100%" y2={RULER_SIZE - 0.5} stroke="rgba(6,182,212,0.08)" strokeWidth="1" />
        </svg>
      </div>

      {/* Left ruler */}
      <div
        className="fixed left-0 bottom-0 z-[1] pointer-events-none"
        style={{ top: RULER_SIZE, width: RULER_SIZE }}
      >
        <svg width={RULER_SIZE} height="100%" style={{ opacity: 0.15 }}>
          {verticalTicks}
          <line x1={RULER_SIZE - 0.5} y1="0" x2={RULER_SIZE - 0.5} y2="100%" stroke="rgba(6,182,212,0.08)" strokeWidth="1" />
        </svg>
      </div>
    </>
  );
}
