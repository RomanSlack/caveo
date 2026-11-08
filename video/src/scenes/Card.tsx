import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {C, CARDS, F} from '../theme';
import {clamp, Felt, Sticker, Words} from '../components/ui';

/* Section title card, 40 frames: number sticker slaps on, title rises by word, quick exit on the last frames. */
export const Card: React.FC<{n: 1 | 2 | 3}> = ({n}) => {
  const f = useCurrentFrame();
  const c = CARDS[n - 1];
  const out = interpolate(f, [34, 40], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  return (
    <Felt>
      {/* Starts right of the presenter's bottom-left box (x < 480). */}
      <AbsoluteFill style={{justifyContent: 'center', paddingLeft: 540, transform: `translateY(${out * -60}px)`, opacity: 1 - out}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 50}}>
          <Sticker at={0} rotate={-6} size={140} style={{padding: '26px 52px'}}>
            {n}
          </Sticker>
          <div style={{position: 'relative', width: 960}}>
            {n === 3 ? <Envelope at={10} /> : null}
            <div style={{fontFamily: F.body, fontWeight: 700, fontSize: 30, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.sun, marginBottom: 18}}>
              <Words text={`Part ${n} of 3`} at={3} stagger={2} />
            </div>
            <div style={{fontFamily: F.display, fontWeight: 700, fontSize: 92, lineHeight: 1, color: C.feltFg, letterSpacing: '-0.01em'}}>
              <Words text={c.title} at={5} stagger={3} />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </Felt>
  );
};

/** Generic envelope (no brand marks) that flies in beside the "Email it yourself" title. */
const Envelope: React.FC<{at: number}> = ({at}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 12], [0, 1], {...clamp, easing: Easing.out(Easing.back(1.8))});
  return (
    <svg
      viewBox="0 0 120 84"
      width={190}
      style={{position: 'absolute', right: 120, top: -40, transform: `translate(${(1 - p) * 300}px, ${(1 - p) * -120}px) rotate(${8 - p * 4}deg)`, opacity: Math.min(1, p * 2), filter: 'drop-shadow(0 12px 18px rgba(0,0,0,0.4))'}}
    >
      <rect x="2" y="2" width="116" height="80" rx="10" fill="#fefaf1" stroke="#fff" strokeWidth="4" />
      <path d="M6 8 L60 48 L114 8" fill="none" stroke="#de3d34" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};
