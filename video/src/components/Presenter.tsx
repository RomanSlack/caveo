import React from 'react';
import {AbsoluteFill, Audio, getStaticFiles, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, Corner, F, FACE_OFFSET, SEGMENTS, WIDTH, HEIGHT} from '../theme';

const has = (name: string) => getStaticFiles().some((f) => f.name === name);
export const FILES = {
  face: 'live/face.mp4',
  matte: 'live/face-matte.webm', // optional: same take with the background removed (alpha)
};

type Geo = {x: number; y: number; w: number; h: number; vs: number; vx: number; vy: number; frame: number; radius: number};

// Full: Roman fills the left panel (x 0..1040, his center near x 520), graphics live right of x 1040.
// Plain face.mp4 is cropped to the panel; with the matte, the kraft shows through behind him.
const FULL: Geo = {x: 0, y: 0, w: 1040, h: HEIGHT, vs: 1, vx: 520 - WIDTH / 2, vy: 0, frame: 0, radius: 0};
const CW = 420;
const CH = 340;
const M = 40;
const VS = 0.42; // video scale in the corner box
const corner = (c: Corner): Geo => {
  const x = c.endsWith('l') ? M : WIDTH - M - CW;
  const y = c.startsWith('b') ? HEIGHT - M - CH : M;
  // Center the (centered) subject horizontally in the box, keep the head near the top third.
  return {x, y, w: CW, h: CH, vs: VS, vx: CW / 2 - (WIDTH * VS) / 2, vy: -40, frame: 1, radius: 26};
};
const geoOf = (m: 'full' | Corner) => (m === 'full' ? FULL : corner(m));
const lerp = (a: Geo, b: Geo, t: number): Geo => {
  const o = {} as Geo;
  (Object.keys(a) as (keyof Geo)[]).forEach((k) => (o[k] = a[k] + (b[k] - a[k]) * t));
  return o;
};

/** Where Roman is at film frame f: the segment's mode, sprung from the previous segment's mode at the boundary. */
const useGeo = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  let start = 0;
  let prev: 'full' | Corner = SEGMENTS[0].presenter;
  for (const s of SEGMENTS) {
    if (f < start + s.frames) {
      const t = spring({frame: f - start, fps, config: {damping: 18, stiffness: 140, mass: 0.8}});
      return lerp(geoOf(prev), geoOf(s.presenter), t);
    }
    prev = s.presenter;
    start += s.frames;
  }
  return geoOf(prev);
};

const Silhouette: React.FC = () => (
  <AbsoluteFill>
    <svg viewBox="0 0 1920 1080" width={WIDTH} height={HEIGHT}>
      <g fill={C.ink} opacity={0.32}>
        <ellipse cx="960" cy="420" rx="150" ry="185" />
        <path d="M600 1080 C600 800 760 690 960 690 C1160 690 1320 800 1320 1080 Z" />
      </g>
    </svg>
    <div style={{position: 'absolute', left: 0, right: 0, top: 640, textAlign: 'center', fontFamily: F.body, fontWeight: 700, fontSize: 34, color: C.paper}}>
      Roman (drop public/live/face.mp4)
    </div>
  </AbsoluteFill>
);

/** Roman's webcam layer for the whole film. face.mp4 is the picture and the narration audio; the matte replaces the picture if present. */
export const Presenter: React.FC = () => {
  const g = useGeo();
  const face = has(FILES.face);
  const picture = has(FILES.matte) ? 'matte' : face ? 'face' : 'none';
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {face ? <Audio src={staticFile(FILES.face)} startFrom={FACE_OFFSET + 1} /* +1 frame: the render pipeline delays audio ~43ms */ /> : null}
      <div
        style={{
          position: 'absolute',
          left: g.x,
          top: g.y,
          width: g.w,
          height: g.h,
          borderRadius: g.radius,
          overflow: 'hidden',
          background: g.frame > 0.01 ? `rgba(254,250,241,${g.frame})` : 'transparent',
          border: `${10 * g.frame}px solid rgba(255,255,255,${g.frame})`,
          boxShadow: `0 ${20 * g.frame}px ${44 * g.frame}px rgba(40,25,10,${0.4 * g.frame})`,
        }}
      >
        <div style={{position: 'absolute', left: g.vx, top: g.vy, width: WIDTH, height: HEIGHT, transform: `scale(${g.vs})`, transformOrigin: '0 0'}}>
          {picture === 'matte' ? (
            <OffthreadVideo src={staticFile(FILES.matte)} startFrom={FACE_OFFSET} muted transparent style={{width: WIDTH, height: HEIGHT}} />
          ) : picture === 'face' ? (
            <OffthreadVideo src={staticFile(FILES.face)} startFrom={FACE_OFFSET} muted style={{width: WIDTH, height: HEIGHT, objectFit: 'cover'}} />
          ) : (
            <Silhouette />
          )}
        </div>
        {/* stitched inset, like every paper card in the app */}
        <div style={{position: 'absolute', inset: 8, border: `3px dashed rgba(160,125,85,${0.55 * g.frame})`, borderRadius: Math.max(0, g.radius - 8)}} />
      </div>
    </AbsoluteFill>
  );
};

export {has};
