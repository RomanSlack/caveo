import React from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {ARCH, C, F} from '../theme';
import {clamp, Felt, Kraft, Latch, LogoChip, Paper, Sticker, useIn, VultrMark, Words} from '../components/ui';
import {ICONS} from '../components/icons';

type Node = {title: string; sub: string; vultr?: boolean; tone?: 'red' | 'green'};
const NODES: Node[] = [
  {title: 'Invoice email', sub: ''},
  {title: 'A fresh computer per file', sub: 'Vultr Cloud Compute', vultr: true},
  {title: 'Sealed throwaway computer', sub: '', tone: 'red'},
  {title: 'AI reads it', sub: 'Vultr Serverless Inference', vultr: true},
  {title: 'Simple rules decide', sub: ''},
  {title: 'A real person', sub: '', tone: 'green'},
];
const W = 268;
const GAP = 34;
const X0 = (1920 - (NODES.length * W + (NODES.length - 1) * GAP)) / 2;
const Y = 330;
const H = 290;
const STEP = 15; // frames between nodes

const Diagram: React.FC = () => {
  const f = useCurrentFrame();
  const vault = useIn(6 * STEP + 6, 12, Easing.out(Easing.back(1.6)));
  // The invoice packet travels the pipeline once everything is built.
  const travel = interpolate(f, [125, 205], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const px = X0 + W / 2 + travel * (NODES.length - 1) * (W + GAP);
  return (
    <Felt>
      <div style={{position: 'absolute', left: 0, right: 0, top: 56, textAlign: 'center'}}>
        <div style={{fontFamily: F.body, fontWeight: 700, fontSize: 30, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.sun}}>
          <Words text="How it works" at={0} stagger={2} />
        </div>
        <div style={{fontFamily: F.display, fontWeight: 700, fontSize: 76, color: C.feltFg, marginTop: 10}}>
          <Words text="Everything runs on Vultr." at={3} stagger={2} />
        </div>
      </div>
      {/* connectors */}
      {NODES.slice(1).map((_, i) => {
        const p = interpolate(f, [(i + 1) * STEP - 4, (i + 1) * STEP + 4], [0, 1], clamp);
        const x = X0 + (i + 1) * W + i * GAP;
        return <div key={i} style={{position: 'absolute', left: x, top: Y + H / 2 - 3, width: GAP * p, height: 6, background: C.sun, borderRadius: 3}} />;
      })}
      {NODES.map((n, i) => {
        const p = interpolate(f, [i * STEP, i * STEP + 11], [0, 1], {...clamp, easing: Easing.out(Easing.back(1.8))});
        const border = n.tone === 'red' ? C.red : n.tone === 'green' ? C.green : undefined;
        return (
          <div key={n.title} style={{position: 'absolute', left: X0 + i * (W + GAP), top: Y, width: W, height: H, transform: `translateY(${(1 - p) * 70}px) scale(${0.7 + 0.3 * p})`, opacity: Math.min(1, p * 2)}}>
            <Paper style={{height: '100%', padding: '34px 26px', outline: border ? `6px solid ${border}` : undefined}} stitch={border ? `${border}88` : undefined}>
              <div style={{display: 'flex', alignItems: 'center', gap: 10, height: 34, marginBottom: 12}}>
                {n.vultr ? (
                  <>
                    <VultrMark size={34} />
                    <span style={{fontFamily: F.body, fontWeight: 700, fontSize: 22, color: C.vultr, letterSpacing: '0.06em', textTransform: 'uppercase'}}>Vultr</span>
                  </>
                ) : (
                  <span style={{fontFamily: F.display, fontWeight: 700, fontSize: 22, color: C.inkSoft}}>{i + 1}</span>
                )}
              </div>
              <div style={{fontFamily: F.display, fontWeight: 700, fontSize: 34, lineHeight: 1.04, color: n.tone === 'red' ? C.redInk : n.tone === 'green' ? C.green : C.ink}}>{n.title}</div>
              {n.sub ? <div style={{fontFamily: F.body, fontWeight: 700, fontSize: 24, lineHeight: 1.25, color: C.vultr, marginTop: 12}}>{n.sub}</div> : null}
            </Paper>
          </div>
        );
      })}
      {/* sandbox guard */}
      <div style={{position: 'absolute', left: X0 + 2 * (W + GAP) + W - 100, top: Y - 96}}>
        <Latch pose="latch2-alarm" at={2 * STEP + 8} height={110} />
      </div>
      {/* invoice packet */}
      {f >= 125 && f <= 212 ? (
        <div style={{position: 'absolute', left: px - 22, top: Y + H / 2 - 22, width: 44, height: 44, borderRadius: 10, background: C.red, border: '5px solid #fff', boxShadow: '0 6px 16px rgba(0,0,0,0.4)', transform: `rotate(${travel * 360}deg)`}} />
      ) : null}
      {/* evidence vault */}
      <div style={{position: 'absolute', left: X0 + 1 * (W + GAP) + W / 2, top: Y + H + 20, width: 3 * (W + GAP), transform: `scale(${vault})`, transformOrigin: '50% 0', opacity: Math.min(1, vault * 2)}}>
        <div style={{position: 'absolute', left: '50%', top: 0, width: 6, height: 50, background: C.sun, borderRadius: 3}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 50}}>
          <Paper style={{padding: '24px 34px', display: 'flex', alignItems: 'center', gap: 22}}>
            <VultrMark size={44} />
            <div>
              <div style={{fontFamily: F.display, fontWeight: 700, fontSize: 38, color: C.ink}}>Keeps the evidence</div>
              <div style={{fontFamily: F.body, fontWeight: 500, fontSize: 24, color: C.inkSoft}}>Vultr Object Storage</div>
            </div>
          </Paper>
        </div>
      </div>
      {/* built with */}
      <div style={{position: 'absolute', right: 80, top: 905, display: 'flex', alignItems: 'center', gap: 16}}>
        <span style={{fontFamily: F.body, fontWeight: 700, fontSize: 22, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.feltMuted, marginRight: 6, opacity: useIn(118, 8)}}>Built with</span>
        {[
          {label: 'Docker', icon: ICONS.docker},
          {label: 'gVisor'},
          {label: 'Python', icon: ICONS.python},
          {label: 'FastAPI', icon: ICONS.fastapi},
          {label: 'Resend', icon: ICONS.resend},
        ].map((c, i) => {
          const p = interpolate(f, [120 + i * 4, 130 + i * 4], [0, 1], {...clamp, easing: Easing.out(Easing.back(2.2))});
          return (
            <LogoChip key={c.label} label={c.label} path={c.icon?.path} hex={c.icon?.hex} size={24} style={{transform: `scale(${p})`, opacity: Math.min(1, p * 2)}} />
          );
        })}
      </div>
    </Felt>
  );
};

const Tiles: React.FC<{at: number; paid: number; good: boolean}> = ({at, paid, good}) => {
  const f = useCurrentFrame();
  return (
    <div style={{display: 'flex', gap: 12}}>
      {Array.from({length: 12}).map((_, i) => {
        const p = interpolate(f, [at + i * 2, at + i * 2 + 8], [0, 1], {...clamp, easing: Easing.out(Easing.back(2.4))});
        const isPaid = i === 11 && paid > 0;
        const bg = isPaid ? C.red : good ? C.green : '#b9ab9a';
        return (
          <div key={i} style={{width: 62, height: 78, borderRadius: 10, background: bg, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: F.display, fontWeight: 700, fontSize: isPaid ? 17 : 34, transform: `scale(${p}) rotate(${(i % 3) - 1}deg)`, boxShadow: '0 5px 12px rgba(60,35,10,0.25)'}}>
            {isPaid ? 'PAID' : good ? '✓' : ''}
          </div>
        );
      })}
    </div>
  );
};

const Score: React.FC = () => {
  const row = (label: string, sub: string, at: number, paid: number, good: boolean) => (
    <Paper style={{padding: '34px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40}}>
      <div style={{width: 520}}>
        <div style={{fontFamily: F.display, fontWeight: 700, fontSize: 48, color: C.ink, lineHeight: 1}}>{label}</div>
        {sub ? <div style={{fontFamily: F.body, fontWeight: 500, fontSize: 23, color: C.inkSoft, marginTop: 8, whiteSpace: 'nowrap'}}>{sub}</div> : null}
      </div>
      <Tiles at={at} paid={paid} good={good} />
      <div style={{width: 250, textAlign: 'right', fontFamily: F.display, fontWeight: 700, fontSize: 78, color: good ? C.green : C.redInk, fontVariantNumeric: 'tabular-nums'}}>
        {paid}/12
        <div style={{fontFamily: F.body, fontSize: 24, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.1em', textTransform: 'uppercase'}}>paid</div>
      </div>
    </Paper>
  );
  return (
    <Kraft>
      <div style={{position: 'absolute', left: 130, right: 130, top: 120}}>
        <div style={{fontFamily: F.display, fontWeight: 700, fontSize: 84, color: C.ink, lineHeight: 1}}>
          <Words text="We hid the note for the AI 11 ways." at={0} stagger={3} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 34, marginTop: 70}}>
          {row('A normal AI', '', 14, 1, false)}
          {row('Caveo', '', 44, 0, true)}
        </div>
      </div>
      <div style={{position: 'absolute', right: 150, bottom: 110}}>
        <Sticker at={80} rotate={-5} size={44} bg={C.green}>
          11 of 11 hidden notes caught
        </Sticker>
      </div>
    </Kraft>
  );
};

export const Architecture: React.FC = () => (
  <AbsoluteFill>
    <Sequence from={ARCH.diagram[0]} durationInFrames={ARCH.diagram[1] - ARCH.diagram[0]}>
      <Diagram />
    </Sequence>
    <Sequence from={ARCH.score[0]} durationInFrames={ARCH.score[1] - ARCH.score[0]}>
      <Score />
    </Sequence>
  </AbsoluteFill>
);
