import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, F} from '../theme';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Snappy ease-out 0..1 over `dur` frames starting at `at`. */
export const useIn = (at: number, dur = 10, ease = Easing.out(Easing.cubic)) => {
  const f = useCurrentFrame();
  return interpolate(f, [at, at + dur], [0, 1], {...clamp, easing: ease});
};

/** Spring 0..1 (with overshoot when damping is low). */
export const useSpring = (at: number, config = {damping: 12, stiffness: 190, mass: 0.7}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: f - at, fps, config});
};

export const Kraft: React.FC<{children?: React.ReactNode; push?: number}> = ({children, push = 0}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.kraft, overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile('img/kraft.webp')})`,
          backgroundSize: '900px',
          transform: `scale(${1.02 + push * f})`,
        }}
      />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(255,240,215,0.35), rgba(60,35,10,0.28) 100%)'}} />
      {children}
    </AbsoluteFill>
  );
};

export const Felt: React.FC<{children?: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{backgroundColor: C.felt, overflow: 'hidden'}}>
    <AbsoluteFill style={{backgroundImage: `url(${staticFile('img/felt.webp')})`, backgroundSize: '900px', opacity: 0.9}} />
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.06), rgba(0,0,0,0.45) 100%)'}} />
    {children}
  </AbsoluteFill>
);

/** Paper card with the stitched inset outline from the app. */
export const Paper: React.FC<{style?: React.CSSProperties; children?: React.ReactNode; stitch?: string}> = ({style, children, stitch}) => (
  <div
    style={{
      position: 'relative',
      background: C.paper,
      borderRadius: 26,
      padding: 44,
      boxShadow: '0 2px 0 rgba(255,255,255,0.7) inset, 0 22px 50px rgba(60,35,10,0.32), 0 4px 10px rgba(60,35,10,0.18)',
      ...style,
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 10,
        border: `3px dashed ${stitch ?? C.stitch}`,
        borderRadius: 18,
        pointerEvents: 'none',
      }}
    />
    {children}
  </div>
);

/** Red die-cut sticker that slaps on: big and tilted, then lands with overshoot. */
export const Sticker: React.FC<{
  at: number;
  rotate?: number;
  bg?: string;
  color?: string;
  size?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({at, rotate = 7, bg = C.red, color = '#fff', size = 40, style, children}) => {
  const f = useCurrentFrame();
  const s = useSpring(at, {damping: 9, stiffness: 260, mass: 0.6});
  if (f < at) return null;
  const scale = interpolate(s, [0, 1], [2.1, 1]);
  const rot = interpolate(s, [0, 1], [rotate - 22, rotate]);
  const op = interpolate(f, [at, at + 3], [0, 1], clamp);
  return (
    <div
      style={{
        display: 'inline-block',
        background: bg,
        color,
        fontFamily: F.display,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        padding: `${size * 0.32}px ${size * 0.5}px`,
        borderRadius: size * 0.36,
        border: `${Math.max(5, size * 0.13)}px solid #fff`,
        boxShadow: '0 12px 26px rgba(80,20,10,0.35)',
        transform: `scale(${scale}) rotate(${rot}deg)`,
        opacity: op,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Words rise in one by one (by-word stagger, snappy). */
export const Words: React.FC<{text: string; at: number; stagger?: number; style?: React.CSSProperties; wordStyle?: (i: number) => React.CSSProperties}> = ({
  text,
  at,
  stagger = 3,
  style,
  wordStyle,
}) => {
  const f = useCurrentFrame();
  const words = text.split(' ');
  return (
    <span style={style}>
      {words.map((w, i) => {
        // No overshoot: words settle flat on the baseline, so a mid-animation frame never looks wobbly.
        const p = interpolate(f, [at + i * stagger, at + i * stagger + 8], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: interpolate(p, [0, 0.4], [0, 1], clamp),
              transform: `translateY(${(1 - p) * 16}px)`,
              marginRight: '0.24em',
              ...(wordStyle ? wordStyle(i) : {}),
            }}
          >
            {w}
          </span>
        );
      })}
    </span>
  );
};

/** Latch drops in from above, squashes on landing, then idles with a gentle bob. */
export const Latch: React.FC<{pose: string; at: number; height: number; style?: React.CSSProperties; bob?: boolean}> = ({pose, at, height, style, bob = true}) => {
  const f = useCurrentFrame();
  const fall = interpolate(f, [at, at + 9], [-700, 0], {...clamp, easing: Easing.in(Easing.quad)});
  const t = f - (at + 9); // frames since landing
  const squash = t < 0 ? 0 : Math.exp(-t / 5) * Math.cos(t * 0.75);
  const sx = 1 + 0.16 * squash;
  const sy = 1 - 0.16 * squash;
  const idle = bob && t > 12 ? Math.sin((t - 12) / 14) * 6 : 0;
  if (f < at) return null;
  return (
    <Img
      src={staticFile(`img/${pose}.webp`)}
      style={{
        height,
        transformOrigin: '50% 100%',
        transform: `translateY(${fall + idle}px) scale(${sx}, ${sy})`,
        filter: 'drop-shadow(0 22px 26px rgba(50,30,10,0.35))',
        ...style,
      }}
    />
  );
};

export const VultrMark: React.FC<{size?: number; color?: string}> = ({size = 26, color = C.vultr}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{fill: color, flexShrink: 0}}>
    <path d="M8.36 2.172A1.194 1.194 0 007.348 1.6H1.2A1.2 1.2 0 000 2.8a1.211 1.211 0 00.182.64l11.6 18.4a1.206 1.206 0 002.035 0l3.075-4.874a1.229 1.229 0 00.182-.64 1.211 1.211 0 00-.182-.642zm10.349 8.68a1.206 1.206 0 002.035 0L21.8 9.178l2.017-3.2a1.211 1.211 0 00.183-.64 1.229 1.229 0 00-.183-.64l-1.6-2.526a1.206 1.206 0 00-1.016-.571h-6.148a1.2 1.2 0 00-1.201 1.2 1.143 1.143 0 00.188.64z" />
  </svg>
);

export const VultrPill: React.FC<{size?: number; text?: React.ReactNode; style?: React.CSSProperties}> = ({size = 24, text, style}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: size * 0.4,
      background: '#fff',
      color: '#0a1a33',
      fontFamily: F.body,
      fontWeight: 700,
      fontSize: size,
      padding: `${size * 0.42}px ${size * 0.7}px`,
      borderRadius: 999,
      boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    <VultrMark size={size * 1.1} />
    {text ?? (
      <span>
        Runs on <b>Vultr</b>
      </span>
    )}
  </span>
);

/** Deterministic decaying camera shake for impacts. */
export const shake = (f: number, at: number, amp = 14) => {
  const t = f - at;
  if (t < 0 || t > 14) return {x: 0, y: 0};
  const k = Math.exp(-t / 3.5) * amp;
  return {x: Math.sin(t * 2.7) * k, y: Math.cos(t * 3.3) * k * 0.7};
};

/** Paper "receipt" citation that slaps on next to a stat: reads like a document reference, not an insignia. */
export const Citation: React.FC<{at: number; title: string; site: string; rotate?: number}> = ({at, title, site, rotate = -4}) => {
  const f = useCurrentFrame();
  const s = useSpring(at, {damping: 10, stiffness: 260, mass: 0.6});
  if (f < at) return null;
  const line = interpolate(f, [at + 6, at + 14], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  return (
    <div
      style={{
        display: 'inline-block',
        background: C.paper,
        padding: '18px 26px 20px',
        borderRadius: 6,
        boxShadow: '0 12px 26px rgba(60,35,10,0.32)',
        transform: `scale(${interpolate(s, [0, 1], [1.8, 1])}) rotate(${interpolate(s, [0, 1], [rotate - 16, rotate])}deg)`,
        opacity: interpolate(f, [at, at + 3], [0, 1], clamp),
        textAlign: 'left',
        // torn receipt edge
        clipPath: 'polygon(0 0,100% 0,100% calc(100% - 8px),95% 100%,90% calc(100% - 8px),85% 100%,80% calc(100% - 8px),75% 100%,70% calc(100% - 8px),65% 100%,60% calc(100% - 8px),55% 100%,50% calc(100% - 8px),45% 100%,40% calc(100% - 8px),35% 100%,30% calc(100% - 8px),25% 100%,20% calc(100% - 8px),15% 100%,10% calc(100% - 8px),5% 100%,0 calc(100% - 8px))',
      }}
    >
      <div style={{fontFamily: F.body, fontWeight: 700, fontSize: 16, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.inkSoft}}>Source</div>
      <div style={{fontFamily: F.body, fontWeight: 700, fontSize: 30, color: C.ink, marginTop: 4, whiteSpace: 'nowrap'}}>{title}</div>
      <div style={{height: 5, background: C.red, borderRadius: 3, marginTop: 6, width: `${line * 100}%`}} />
      <div style={{fontFamily: F.mono, fontWeight: 500, fontSize: 20, color: C.inkSoft, marginTop: 8}}>{site}</div>
    </div>
  );
};

/** Small white "built with" logo chip. */
export const LogoChip: React.FC<{path?: string; hex?: string; label: string; size?: number; style?: React.CSSProperties}> = ({path, hex, label, size = 26, style}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: size * 0.45,
      background: '#fff',
      color: C.ink,
      fontFamily: F.body,
      fontWeight: 700,
      fontSize: size,
      padding: `${size * 0.42}px ${size * 0.75}px`,
      borderRadius: 999,
      boxShadow: '0 8px 18px rgba(0,0,0,0.25)',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {path ? (
      <svg viewBox="0 0 24 24" width={size * 1.15} height={size * 1.15} style={{fill: hex}}>
        <path d={path} />
      </svg>
    ) : null}
    {label}
  </span>
);
