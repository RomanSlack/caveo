import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {C, F} from '../theme';
import {clamp, Felt, Latch, useIn, useSpring, VultrMark, Words} from '../components/ui';

/* End card (1:48, 7s). Content sits right of x 1040: Roman stands full size on the left for the last line. */
export const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const zero = useSpring(0, {damping: 8, stiffness: 240, mass: 0.6});
  const url = useIn(26, 10, Easing.out(Easing.back(2)));
  const lock = useIn(44, 12, Easing.out(Easing.back(1.6)));
  return (
    <Felt>
      <div style={{position: 'absolute', left: 1050, top: 90, width: 820}}>
        <div
          style={{
            display: 'inline-block',
            fontFamily: F.display,
            fontWeight: 700,
            fontSize: 330,
            lineHeight: 0.85,
            color: C.sun,
            transform: `scale(${interpolate(zero, [0, 1], [2.2, 1])}) rotate(${interpolate(zero, [0, 1], [-24, -4])}deg)`,
            transformOrigin: '30% 60%',
            textShadow: '0 14px 30px rgba(0,0,0,0.45)',
            opacity: interpolate(f, [0, 3], [0, 1], clamp),
          }}
        >
          0
        </div>
        <div style={{fontFamily: F.display, fontWeight: 700, fontSize: 60, lineHeight: 1.05, color: C.feltFg, marginTop: 10}}>
          <Words text="fake invoices paid." at={10} stagger={3} />
          <br />
          <Words text="Try to beat it." at={18} stagger={3} wordStyle={() => ({color: C.sun})} />
        </div>
        <div
          style={{
            display: 'inline-block',
            marginTop: 40,
            background: C.paper,
            color: C.ink,
            fontFamily: F.display,
            fontWeight: 700,
            fontSize: 64,
            padding: '18px 40px',
            borderRadius: 999,
            boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
            transform: `scale(${url})`,
            transformOrigin: '0 50%',
          }}
        >
          caveo.work
        </div>
        {/* Built on Vultr lockup */}
        <div
          style={{
            marginTop: 46,
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            background: '#fff',
            borderRadius: 22,
            padding: '20px 30px',
            width: 'fit-content',
            boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
            transform: `translateY(${(1 - lock) * 40}px)`,
            opacity: lock,
          }}
        >
          <VultrMark size={64} />
          <div>
            <div style={{fontFamily: F.body, fontWeight: 700, fontSize: 20, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#51607a'}}>Built on</div>
            <div style={{fontFamily: F.body, fontWeight: 800, fontSize: 48, lineHeight: 1, color: '#0a1a33'}}>Vultr</div>
          </div>
          <div style={{width: 2, alignSelf: 'stretch', background: '#e3e8f0', margin: '0 6px'}} />
          <div style={{fontFamily: F.body, fontWeight: 600, fontSize: 22, lineHeight: 1.45, color: '#33415c'}}>
            Cloud Compute
            <br />
            Serverless Inference
            <br />
            Object Storage
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', right: 24, bottom: 24}}>
        <Latch pose="latch3-cheer" at={8} height={300} />
      </div>
    </Felt>
  );
};
