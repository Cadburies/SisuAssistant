import { useState } from 'react';
import type { PluginProps } from '../../app/plugin';
import { fmt, radToDeg, skAngleDeg, skSpeedKn, wrapDeg } from '../../app/units';

export function Windex({ sk }: PluginProps) {
  const [full, setFull] = useState(false);
  const [northUp, setNorthUp] = useState(false);
  const twd = skAngleDeg(sk.wind.twd);
  const twa = skAngleDeg(sk.wind.twa);
  const awa = skAngleDeg(sk.wind.awa);
  const tws = skSpeedKn(sk.wind.tws);
  const aws = skSpeedKn(sk.wind.aws);
  const heading =
    sk.self.heading != null
      ? wrapDeg(radToDeg(sk.self.heading))
      : sk.self.headingMag != null
        ? wrapDeg(radToDeg(sk.self.headingMag))
        : undefined;
  const roseRot = northUp ? 0 : -(heading ?? 0);
  const boatRot = northUp ? (heading ?? 0) : 0;
  const twdNeedle = twd == null ? null : wrapDeg(twd + roseRot);
  const awaNeedle =
    awa == null ? null : wrapDeg((heading ?? 0) + signedAwa(awa) + roseRot);

  return (
    <section className={full ? 'windex full' : 'windex'}>
      <div className="windex-toolbar">
        <span>Windex</span>
        <span>
          <button type="button" onClick={() => setNorthUp((v) => !v)}>
            {northUp ? 'North up' : 'Head up'}
          </button>{' '}
          <button type="button" onClick={() => setFull((v) => !v)}>
            {full ? 'Dock' : 'Full'}
          </button>
        </span>
      </div>
      <svg className="windex-glass" viewBox="0 0 320 320" role="img" aria-label="Windex">
        <defs>
          <radialGradient id="glass" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#1a2836" />
            <stop offset="100%" stopColor="#0a1016" />
          </radialGradient>
        </defs>
        <circle cx="160" cy="160" r="154" fill="#1c2430" stroke="#3a4a5c" strokeWidth="6" />
        <circle cx="160" cy="160" r="140" fill="url(#glass)" stroke="#e0b43a" strokeWidth="2" />
        <g transform={`rotate(${roseRot} 160 160)`}>
          {ticks()}
        </g>
        <g transform={`rotate(${boatRot} 160 160)`}>{boat()}</g>
        {twdNeedle != null ? needle(twdNeedle, '#e24a4a', 118, 7) : null}
        {awaNeedle != null ? needle(awaNeedle, '#e0b43a', 92, 5) : null}
        <circle cx="160" cy="160" r="7" fill="#e7eef6" />
      </svg>
      <div className="windex-readout">
        <div>
          <span>TWD</span>
          <strong>{fmt(twd, 0)}°</strong>
        </div>
        <div>
          <span>TWS</span>
          <strong>{fmt(tws, 1)} kn</strong>
        </div>
        <div>
          <span>AWA</span>
          <strong>{fmtAwa(awa)}</strong>
        </div>
        <div>
          <span>AWS</span>
          <strong>{fmt(aws, 1)} kn</strong>
        </div>
        <div>
          <span>TWA</span>
          <strong>{fmtAwa(twa)}</strong>
        </div>
        <div>
          <span>HDG</span>
          <strong>{fmt(heading, 0)}°</strong>
        </div>
      </div>
    </section>
  );
}

function signedAwa(deg: number): number {
  const w = wrapDeg(deg);
  return w > 180 ? w - 360 : w;
}

function fmtAwa(deg: number | undefined): string {
  if (deg == null) return '—';
  const s = signedAwa(deg);
  const side = s > 0 ? 'S' : s < 0 ? 'P' : '';
  return `${Math.abs(s).toFixed(0)}°${side}`;
}

function ticks() {
  const out = [];
  for (let d = 0; d < 360; d += 10) {
    const major = d % 30 === 0;
    const rad = ((d - 90) * Math.PI) / 180;
    const r1 = major ? 118 : 128;
    const r2 = 138;
    const x1 = 160 + r1 * Math.cos(rad);
    const y1 = 160 + r1 * Math.sin(rad);
    const x2 = 160 + r2 * Math.cos(rad);
    const y2 = 160 + r2 * Math.sin(rad);
    out.push(
      <line
        key={d}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={major ? '#e7eef6' : '#5a7188'}
        strokeWidth={major ? 2 : 1}
      />,
    );
    if (major) {
      const tx = 160 + 104 * Math.cos(rad);
      const ty = 160 + 104 * Math.sin(rad);
      out.push(
        <text
          key={`t${d}`}
          x={tx}
          y={ty}
          fill="#8aa0b5"
          fontSize="11"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {d === 0 ? 'N' : d}
        </text>,
      );
    }
  }
  return out;
}

function boat() {
  return (
    <path
      d="M160 78 L186 210 L160 196 L134 210 Z"
      fill="#3ec6d822"
      stroke="#9ec9d6"
      strokeWidth="2"
    />
  );
}

function needle(deg: number, color: string, length: number, width: number) {
  return (
    <g transform={`rotate(${deg} 160 160)`}>
      <polygon
        points={`160,${160 - length} ${160 - width},${160 + 18} 160,${160 + 10} ${160 + width},${160 + 18}`}
        fill={color}
        opacity="0.95"
      />
    </g>
  );
}
