import React from 'react';
import {AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';
import {C, F} from '../theme';
import {Felt, Kraft, Sticker} from '../components/ui';
import {has} from '../components/Presenter';

// Browser-capture box: right of Roman's bottom-left box (x < 460), 16:10 like the 1440x900 capture.
const BOX = {x: 500, y: 110, w: 1380, h: 862};
const CLIP_W = 1440;

/** Camera keyframe: at segment second t, show the clip region starting at (x, y), w wide (height = w / 1.6). */
export type Cam = {t: number; x: number; y: number; w: number};

const camAt = (cams: Cam[], t: number) => {
  if (!cams.length) return {x: 0, y: 0, w: CLIP_W};
  if (t <= cams[0].t) return cams[0];
  for (let i = 0; i < cams.length - 1; i++) {
    const a = cams[i];
    const b = cams[i + 1];
    if (t < b.t) {
      const k = interpolate(t, [a.t, b.t], [0, 1], {easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
      return {x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k};
    }
  }
  return cams[cams.length - 1];
};

/* A live app clip (Playwright capture of caveo.work), framed on kraft, with a camera that pushes in on what Roman is saying. */
export const Live: React.FC<{clip: string; label: string; from?: number; rate?: number; cams?: Cam[]}> = ({clip, label, from = 0, rate = 1, cams = []}) => {
  const f = useCurrentFrame();
  if (!has(clip)) {
    return (
      <Felt>
        <div style={{position: 'absolute', left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, border: `4px dashed ${C.feltMuted}`, borderRadius: 26, display: 'grid', placeItems: 'center', color: C.feltFg, fontFamily: F.display, fontSize: 56}}>
          {label}
        </div>
      </Felt>
    );
  }
  const c = camAt(cams, f / 30);
  const s = BOX.w / c.w;
  const enter = interpolate(f, [0, 10], [0, 1], {easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <Kraft>
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: BOX.x,
            top: BOX.y,
            width: BOX.w,
            height: BOX.h,
            borderRadius: 18,
            overflow: 'hidden',
            border: '8px solid #fff',
            boxShadow: '0 26px 60px rgba(40,25,10,0.45)',
            background: C.paper,
            transform: `translateY(${(1 - enter) * 40}px) scale(${0.96 + 0.04 * enter})`,
            opacity: enter,
          }}
        >
          <div style={{position: 'absolute', left: -c.x * s, top: -c.y * s, width: CLIP_W * s, height: (CLIP_W / 1.6) * s}}>
            <OffthreadVideo src={staticFile(clip)} startFrom={Math.round(from * 30)} playbackRate={rate} muted style={{width: '100%', height: '100%'}} />
          </div>
        </div>
        <div style={{position: 'absolute', left: BOX.x - 24, top: BOX.y - 40}}>
          <Sticker at={4} rotate={-4} size={34} bg={C.green}>
            ● LIVE · caveo.work
          </Sticker>
        </div>
      </AbsoluteFill>
    </Kraft>
  );
};
