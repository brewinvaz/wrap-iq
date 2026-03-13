'use client';

import React, { useMemo } from 'react';
import { useTheme } from '@/lib/theme';

const MAJOR = 120;
const MEDIUM = 24;
const MINOR = 12;
const RULER_SIZE = 20;

export default function RulerOverlay() {
  const { resolvedTheme } = useTheme();

  const isLight = resolvedTheme === 'light';
  const tickColor = isLight ? '#0891b2' : '#06b6d4';
  const rulerOpacity = isLight ? 0.09 : 0.15;
  const cornerBg = isLight ? 'rgba(8, 145, 178, 0.03)' : 'rgba(6, 182, 212, 0.04)';
  const cornerBorder = isLight ? 'rgba(8, 145, 178, 0.06)' : 'rgba(6, 182, 212, 0.08)';
  const borderLine = isLight ? 'rgba(8,145,178,0.06)' : 'rgba(6,182,212,0.08)';

  const horizontalTicks = useMemo(() => {
    const ticks: React.JSX.Element[] = [];
    for (let x = 0; x <= 3840; x += MINOR) {
      const isMajor = x % MAJOR === 0;
      const isMedium = !isMajor && x % MEDIUM === 0;
      const y1 = isMajor ? 0 : isMedium ? 10 : 14;
      const strokeWidth = isMajor ? 1 : isMedium ? 0.5 : 0.3;
      ticks.push(
        <line key={x} x1={x} y1={y1} x2={x} y2={RULER_SIZE} stroke={tickColor} strokeWidth={strokeWidth} />
      );
    }
    return ticks;
  }, [tickColor]);

  const verticalTicks = useMemo(() => {
    const ticks: React.JSX.Element[] = [];
    for (let y = 0; y <= 2160; y += MINOR) {
      const isMajor = y % MAJOR === 0;
      const isMedium = !isMajor && y % MEDIUM === 0;
      const x1 = isMajor ? 0 : isMedium ? 10 : 14;
      const strokeWidth = isMajor ? 1 : isMedium ? 0.5 : 0.3;
      ticks.push(
        <line key={y} x1={x1} y1={y} x2={RULER_SIZE} y2={y} stroke={tickColor} strokeWidth={strokeWidth} />
      );
    }
    return ticks;
  }, [tickColor]);

  return (
    <>
      {/* Corner square */}
      <div
        className="fixed left-0 top-0 z-[1] pointer-events-none"
        style={{
          width: RULER_SIZE,
          height: RULER_SIZE,
          background: cornerBg,
          borderRight: `1px solid ${cornerBorder}`,
          borderBottom: `1px solid ${cornerBorder}`,
        }}
      />

      {/* Top ruler */}
      <div
        className="fixed top-0 right-0 z-[1] pointer-events-none"
        style={{ left: RULER_SIZE, height: RULER_SIZE }}
      >
        <svg width="100%" height={RULER_SIZE} style={{ opacity: rulerOpacity }}>
          {horizontalTicks}
          <line x1="0" y1={RULER_SIZE - 0.5} x2="100%" y2={RULER_SIZE - 0.5} stroke={borderLine} strokeWidth="1" />
        </svg>
      </div>

      {/* Left ruler */}
      <div
        className="fixed left-0 bottom-0 z-[1] pointer-events-none"
        style={{ top: RULER_SIZE, width: RULER_SIZE }}
      >
        <svg width={RULER_SIZE} height="100%" style={{ opacity: rulerOpacity }}>
          {verticalTicks}
          <line x1={RULER_SIZE - 0.5} y1="0" x2={RULER_SIZE - 0.5} y2="100%" stroke={borderLine} strokeWidth="1" />
        </svg>
      </div>
    </>
  );
}
