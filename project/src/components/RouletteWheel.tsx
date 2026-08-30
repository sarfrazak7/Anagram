import React from 'react';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const TILE_ANGLE = 360 / 26;

const SIZE = 480;
const CX = SIZE / 2;
const CY = SIZE / 2;

// 3D layered radii — outer to inner
// Rim is now ~38px thick (was ~18px) for a raised, chunky wooden look
const RIM_OUTER = 236;       // outermost rim edge
const RIM_INNER = 198;       // inner edge of wooden rim (38px thick)
const BALL_TRACK_OUTER = 196;
const BALL_TRACK_INNER = 180;
const TILE_OUTER = 178;
const TILE_INNER = 96;
const HUB_R = 40;
const BALL_ORBIT_R = 188;
const BALL_R = 8;

interface RouletteWheelProps {
  spinning: boolean;
  rotation: number;
  ballAngle: number;
  landedIndex: number | null;
  onSpinEnd: () => void;
  timerOverlay?: React.ReactNode;
}

function polar(r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function sectorPath(r1: number, r2: number, a1: number, a2: number) {
  const gap = 0.4;
  const p1 = polar(r1, a1 + gap);
  const p2 = polar(r2, a1 + gap);
  const p3 = polar(r2, a2 - gap);
  const p4 = polar(r1, a2 - gap);
  const f = (n: number) => n.toFixed(2);
  return (
    `M${f(p1.x)},${f(p1.y)} ` +
    `L${f(p2.x)},${f(p2.y)} ` +
    `A${r2},${r2},0,0,1,${f(p3.x)},${f(p3.y)} ` +
    `L${f(p4.x)},${f(p4.y)} ` +
    `A${r1},${r1},0,0,0,${f(p1.x)},${f(p1.y)}Z`
  );
}

// Generates a wood-grain arc path for a ring sector
function woodGrainArcPath(r1: number, r2: number, a1: number, a2: number) {
  const mid = (r1 + r2) / 2;
  return sectorPath(mid - 1, mid + 1, a1, a2);
}

// Place letters of a word along a circular arc as individual <text> elements.
// This avoids SVG <textPath>, which iOS Safari silently fails to render when
// combined with filters or gradient fills.
function arcText(
  word: string,
  radius: number,
  centerAngle: number,
  spreadDeg: number,
  fontSize: number,
  keyPrefix: string,
) {
  const letters = word.split('');
  const n = letters.length;
  const depth = Math.round(fontSize * 0.22); // 3-D extrusion depth

  return letters.map((ch, i) => {
    const angle = centerAngle - spreadDeg / 2 + (spreadDeg / (n - 1)) * i;
    const p = polar(radius, angle);
    const rot = `rotate(${angle}, ${p.x}, ${p.y})`;
    const common = {
      textAnchor: 'middle' as const,
      dy: '0.35em',
      transform: rot,
      fontFamily: "'Black Ops One', sans-serif",
      fontSize,
      fontWeight: 'bold',
    };

    // Build stacked extrusion layers (dark → mid → face → highlight)
    const layers = [];

    // Deep shadow layers (darkest black, offset most)
    for (let d = depth; d >= 1; d--) {
      const rad = ((angle - 90) * Math.PI) / 180;
      const ox = Math.cos(rad) * d * 0.6;
      const oy = Math.sin(rad) * d * 0.6;
      layers.push(
        <text
          key={`${keyPrefix}-${i}-s${d}`}
          x={p.x + ox}
          y={p.y + oy}
          {...common}
          fill="#000000"
        >
          {ch}
        </text>
      );
    }

    // Dark base layer (bottom of gradient — near black)
    layers.push(
      <text key={`${keyPrefix}-${i}-dark`} x={p.x} y={p.y + 1} {...common} fill="#1a1a1a">
        {ch}
      </text>
    );

    // Mid-tone layer (steel grey)
    layers.push(
      <text key={`${keyPrefix}-${i}-mid`} x={p.x} y={p.y + 0.3} {...common} fill="#606060">
        {ch}
      </text>
    );

    // Main face — silver (top of gradient)
    layers.push(
      <text key={`${keyPrefix}-${i}-face`} x={p.x} y={p.y - 0.3} {...common} fill="#a8a8a8">
        {ch}
      </text>
    );

    // Top highlight — bright silver sheen (narrow, offset toward light source)
    const hrad = ((angle - 90) * Math.PI) / 180;
    layers.push(
      <text
        key={`${keyPrefix}-${i}-hl`}
        x={p.x - Math.cos(hrad) * 1.2}
        y={p.y - Math.sin(hrad) * 1.2 - 0.3}
        {...common}
        fill="#dcdcdc"
        fontSize={fontSize - 2}
      >
        {ch}
      </text>
    );

    return <g key={`${keyPrefix}-${i}`}>{layers}</g>;
  });
}

export default function RouletteWheel({
  spinning,
  rotation,
  ballAngle,
  landedIndex,
  timerOverlay,
}: RouletteWheelProps) {
  const spinTransition = spinning
    ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
    : 'none';

  const bumperAngles = Array.from({ length: 8 }, (_, i) => i * 45 + 22.5);
  // Wood grain lines at various radii across the rim
  const grainAngles = Array.from({ length: 24 }, (_, i) => i * 15);

  return (
    <div style={{ width: '100%', maxWidth: SIZE, aspectRatio: '1 / 1', position: 'relative' }}>
      {timerOverlay && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          {timerOverlay}
        </div>
      )}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ display: 'block', filter: 'drop-shadow(0 16px 36px rgba(0,0,0,0.7))' }}
      >
        <defs>
          {/* === Silver-black gradient for SPIN ALPHA logo === */}
          {/* SVG gradients silently fail on <text> with transforms (Safari),
              so we simulate the gradient with stacked flat-fill layers instead. */}

          {/* === Pine wood rim — warm honey-pine tones === */}
          <radialGradient id="rw-rim" cx="40%" cy="35%" r="70%">
            <stop offset="0%"  stopColor="#e8c57a" />
            <stop offset="18%" stopColor="#c9993c" />
            <stop offset="38%" stopColor="#a97220" />
            <stop offset="58%" stopColor="#8c5810" />
            <stop offset="78%" stopColor="#6b3e08" />
            <stop offset="92%" stopColor="#4a2804" />
            <stop offset="100%" stopColor="#2e1602" />
          </radialGradient>

          {/* Polished top-bevel highlight — bright streak across the top */}
          <linearGradient id="rw-rimBevel" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,230,160,0.72)" />
            <stop offset="18%"  stopColor="rgba(255,210,120,0.38)" />
            <stop offset="42%"  stopColor="rgba(200,160,60,0.10)" />
            <stop offset="70%"  stopColor="rgba(80,40,0,0.18)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.50)" />
          </linearGradient>

          {/* Radial wood grain overlay — subtle darker rings */}
          <radialGradient id="rw-woodGrain" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(80,40,0,0.0)" />
            <stop offset="30%"  stopColor="rgba(60,30,0,0.12)" />
            <stop offset="48%"  stopColor="rgba(40,15,0,0.06)" />
            <stop offset="62%"  stopColor="rgba(60,30,0,0.18)" />
            <stop offset="78%"  stopColor="rgba(30,12,0,0.08)" />
            <stop offset="90%"  stopColor="rgba(60,30,0,0.22)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
          </radialGradient>

          {/* Outer brass edge ring */}
          <linearGradient id="rw-brassOuter" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#f8e68c" />
            <stop offset="35%"  stopColor="#d4af37" />
            <stop offset="65%"  stopColor="#a07818" />
            <stop offset="100%" stopColor="#6b4c0a" />
          </linearGradient>

          {/* Inner brass edge ring */}
          <linearGradient id="rw-brassInner" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#f0d870" />
            <stop offset="40%"  stopColor="#c8981e" />
            <stop offset="100%" stopColor="#7a5008" />
          </linearGradient>

          {/* Ball track */}
          <radialGradient id="rw-ballTrack" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#1a1a2a" />
            <stop offset="100%" stopColor="#0a0a14" />
          </radialGradient>

          {/* Inner field gradient */}
          <radialGradient id="rw-innerField" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#1c1c32" />
            <stop offset="100%" stopColor="#0d0d1c" />
          </radialGradient>

          {/* Hub wood */}
          <radialGradient id="rw-hubWood" cx="35%" cy="30%" r="75%">
            <stop offset="0%"   stopColor="#e8c46a" />
            <stop offset="45%"  stopColor="#8b5a2b" />
            <stop offset="100%" stopColor="#4a2a0e" />
          </radialGradient>

          {/* Crossbar wood */}
          <linearGradient id="rw-crossbar" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#d4a055" />
            <stop offset="30%"  stopColor="#9a6230" />
            <stop offset="70%"  stopColor="#7a4820" />
            <stop offset="100%" stopColor="#5c3210" />
          </linearGradient>

          {/* Ball */}
          <radialGradient id="rw-ball" cx="35%" cy="30%" r="65%">
            <stop offset="0%"   stopColor="#ffffff" />
            <stop offset="40%"  stopColor="#f0f0f0" />
            <stop offset="80%"  stopColor="#c0c0c0" />
            <stop offset="100%" stopColor="#888888" />
          </radialGradient>

          {/* Bumper */}
          <linearGradient id="rw-bumper" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#f8e070" />
            <stop offset="50%"  stopColor="#d4af37" />
            <stop offset="100%" stopColor="#9a7820" />
          </linearGradient>

          {/* Filters */}
          <filter id="rw-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="rw-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="8" stdDeviation="14" floodColor="#000000" floodOpacity="0.8" />
          </filter>
          <filter id="rw-hubGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="rw-rimGlow" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ====================================================
            OUTER RIM — thick polished pine with brass edging
            ==================================================== */}

        {/* Deep shadow ring behind the whole rim for 3D lift */}
        <circle
          cx={CX} cy={CY} r={RIM_OUTER + 4}
          fill="rgba(0,0,0,0.55)"
          filter="url(#rw-shadow)"
        />

        {/* Outermost brass border ring */}
        <circle cx={CX} cy={CY} r={RIM_OUTER}
          fill="none"
          stroke="url(#rw-brassOuter)"
          strokeWidth="7"
        />

        {/* Pine wood body of the rim */}
        <circle cx={CX} cy={CY} r={RIM_OUTER - 3.5}
          fill="url(#rw-rim)"
        />
        {/* Mask out the inner part so only the rim band is wood */}
        <circle cx={CX} cy={CY} r={RIM_INNER + 4}
          fill="#0a3d2e"
        />

        {/* Wood grain overlay rings (subtle concentric arcs) */}
        {grainAngles.map((a, i) => {
          const r = RIM_INNER + 6 + (i % 8) * 3.5;
          if (r > RIM_OUTER - 8) return null;
          return (
            <path
              key={i}
              d={woodGrainArcPath(r, r + 1.5, a, a + 14)}
              fill={`rgba(60,30,0,${0.05 + (i % 3) * 0.04})`}
            />
          );
        })}

        {/* Polished bevel highlight across rim top half */}
        <circle cx={CX} cy={CY} r={RIM_OUTER - 3.5}
          fill="url(#rw-rimBevel)"
          style={{ mixBlendMode: 'screen' } as React.CSSProperties}
        />

        {/* Radial wood-grain depth overlay */}
        <circle cx={CX} cy={CY} r={RIM_OUTER - 3.5}
          fill="url(#rw-woodGrain)"
        />
        {/* Mask inner again after overlays */}
        <circle cx={CX} cy={CY} r={RIM_INNER + 4}
          fill="#0a3d2e"
        />

        {/* Inner brass ring at rim edge */}
        <circle cx={CX} cy={CY} r={RIM_INNER + 4}
          fill="none"
          stroke="url(#rw-brassInner)"
          strokeWidth="5"
        />

        {/* Fine inner gold trim line */}
        <circle cx={CX} cy={CY} r={RIM_INNER}
          fill="none"
          stroke="#f4d03f"
          strokeWidth="1.2"
          strokeOpacity="0.85"
        />

        {/* === BALL TRACK === */}
        <circle cx={CX} cy={CY} r={BALL_TRACK_OUTER} fill="url(#rw-ballTrack)" />
        <circle cx={CX} cy={CY} r={BALL_TRACK_OUTER} fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="2" />
        <circle cx={CX} cy={CY} r={BALL_TRACK_INNER} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2" />

        {/* === DIAMOND BUMPERS === */}
        {bumperAngles.map((angle, i) => {
          const p = polar(BALL_ORBIT_R, angle);
          const size = 7;
          return (
            <g key={i}>
              <polygon
                points={`${p.x},${p.y - size} ${p.x + size},${p.y} ${p.x},${p.y + size} ${p.x - size},${p.y}`}
                fill="rgba(0,0,0,0.4)"
                transform="translate(1.5, 2)"
              />
              <polygon
                points={`${p.x},${p.y - size} ${p.x + size},${p.y} ${p.x},${p.y + size} ${p.x - size},${p.y}`}
                fill="url(#rw-bumper)"
                stroke="#9a7820"
                strokeWidth="0.5"
              />
              <polygon
                points={`${p.x},${p.y - size + 1} ${p.x + size - 2},${p.y - 1} ${p.x},${p.y + 1} ${p.x - size + 2},${p.y - 1}`}
                fill="rgba(255,240,180,0.4)"
              />
            </g>
          );
        })}

        {/* === SPINNING WHEEL GROUP === */}
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: spinTransition,
          }}
        >
          <circle cx={CX} cy={CY} r={TILE_OUTER + 1} fill="#0d0d1c" />

          {ALPHABET.map((letter, i) => {
            const a1 = i * TILE_ANGLE;
            const a2 = (i + 1) * TILE_ANGLE;
            const midAngle = a1 + TILE_ANGLE / 2;
            const isLanded = landedIndex === i && !spinning;
            const isEven = i % 2 === 0;

            const tileFill = isLanded ? '#d4af3722' : isEven ? '#0e2e1e' : '#1e0e0e';
            const tileStroke = isLanded ? '#f4d03f' : isEven ? '#145a36' : '#6b1414';
            const textColor = isLanded ? '#f4d03f' : isEven ? '#3db882' : '#cc5050';

            const tp = polar(TILE_INNER + (TILE_OUTER - TILE_INNER) * 0.72, midAngle);

            return (
              <g key={letter} filter={isLanded ? 'url(#rw-glow)' : undefined}>
                <path
                  d={sectorPath(TILE_INNER, TILE_OUTER, a1, a2)}
                  fill={tileFill}
                  stroke={tileStroke}
                  strokeWidth={isLanded ? 1.5 : 1}
                />
                <text
                  x={tp.x}
                  y={tp.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${midAngle}, ${tp.x}, ${tp.y})`}
                  fill={textColor}
                  fontSize="16"
                  fontWeight="800"
                  fontFamily="'Georgia', serif"
                  style={{ userSelect: 'none' } as React.CSSProperties}
                >
                  {letter}
                </text>
              </g>
            );
          })}

          <circle cx={CX} cy={CY} r={TILE_OUTER} fill="none" stroke="#d4af37" strokeWidth="1.5" />
          <circle cx={CX} cy={CY} r={TILE_INNER} fill="none" stroke="#d4af37" strokeWidth="1.5" />

          <circle cx={CX} cy={CY} r={TILE_INNER - 1.5} fill="url(#rw-innerField)" />

          <circle cx={CX} cy={CY} r={HUB_R + 28} fill="none" stroke="#d4af37" strokeWidth="0.8" strokeOpacity="0.5" />
          <circle cx={CX} cy={CY} r={HUB_R + 42} fill="none" stroke="#d4af37" strokeWidth="0.5" strokeOpacity="0.25" />

          {Array.from({ length: 8 }).map((_, i) => {
            const angle = i * 45;
            const p1 = polar(HUB_R + 30, angle);
            const p2 = polar(TILE_INNER - 10, angle);
            return (
              <line
                key={i}
                x1={p1.x} y1={p1.y}
                x2={p2.x} y2={p2.y}
                stroke="#d4af37"
                strokeWidth="0.5"
                strokeOpacity="0.2"
              />
            );
          })}
        </g>

        {/* === BALL === */}
        <g
          style={{
            transform: `rotate(${ballAngle}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: spinTransition,
          }}
        >
          <circle cx={CX + 1.5} cy={CY - BALL_ORBIT_R + 2} r={BALL_R} fill="rgba(0,0,0,0.4)" />
          <circle
            cx={CX} cy={CY - BALL_ORBIT_R}
            r={BALL_R}
            fill="url(#rw-ball)"
            style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.6))' }}
          />
          <circle cx={CX - 2.5} cy={CY - BALL_ORBIT_R - 2.5} r={2.5} fill="rgba(255,255,255,0.7)" />
        </g>

        {/* === INDICATOR at top === */}
        <polygon
          points={`${CX},${CY - RIM_INNER + 4} ${CX - 10},${CY - RIM_INNER - 10} ${CX + 10},${CY - RIM_INNER - 10}`}
          fill="#d4af37"
          stroke="#9a7820"
          strokeWidth="1"
          filter="url(#rw-glow)"
        />

        {/* === CENTER HUB — wooden crossbar handle (restored) === */}
        <g filter="url(#rw-hubGlow)">
          <circle cx={CX} cy={CY} r={HUB_R} fill="url(#rw-hubWood)" />
          <circle cx={CX} cy={CY} r={HUB_R} fill="none" stroke="#d4af37" strokeWidth="2.5" />
          <circle cx={CX} cy={CY} r={HUB_R - 5} fill="none" stroke="#f4d03f" strokeWidth="0.8" strokeOpacity="0.5" />

          {/* Horizontal crossbar */}
          <rect
            x={CX - HUB_R + 9} y={CY - 5.5}
            width={(HUB_R - 9) * 2} height={11} rx={5.5}
            fill="url(#rw-crossbar)" stroke="#b07828" strokeWidth="0.8"
          />
          <rect
            x={CX - HUB_R + 10} y={CY - 4}
            width={(HUB_R - 10) * 2} height={4} rx={2}
            fill="rgba(255,200,100,0.25)"
          />
          {/* Vertical crossbar */}
          <rect
            x={CX - 5.5} y={CY - HUB_R + 9}
            width={11} height={(HUB_R - 9) * 2} rx={5.5}
            fill="url(#rw-crossbar)" stroke="#b07828" strokeWidth="0.8"
          />
          <rect
            x={CX - 3} y={CY - HUB_R + 10}
            width={4} height={(HUB_R - 10) * 2} rx={2}
            fill="rgba(255,200,100,0.25)"
          />

          {/* Center cap */}
          <circle cx={CX} cy={CY} r={10} fill="#d4af37" stroke="#f4d03f" strokeWidth="1.5" />
          <circle cx={CX} cy={CY} r={5} fill="#f8e070" />
          <circle cx={CX - 2} cy={CY - 2} r={2} fill="rgba(255,255,255,0.5)" />
        </g>

        {/* === SPIN ALPHA logo — outside wheel, inside table box ===
            Rendered as static SVG outside the spinning/ball groups,
            positioned top-left and top-right of the outer rim. */}
        {/* "SPIN" centred at 330° (upper-left), spread 36° */}
        {arcText('SPIN', RIM_OUTER - 12, 330, 36, 22, 'spin')}
        {/* "ALPHA" centred at 30° (upper-right), spread 44° */}
        {arcText('ALPHA', RIM_OUTER - 12, 30, 44, 21, 'alpha')}
      </svg>
    </div>
  );
}
