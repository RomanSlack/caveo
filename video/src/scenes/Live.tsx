import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile} from 'remotion';
import {C, F} from '../theme';
import {Felt, Kraft} from '../components/ui';
import {has} from '../components/Presenter';

// Browser-capture box: right of Roman's bottom-left box (x < 460), 16:10 like a 1440x900 capture.
const BOX = {x: 500, y: 100, w: 1380, h: 862};

/* A live app clip (Playwright capture of caveo.work), played from its first frame, framed on kraft. */
export const Live: React.FC<{clip: string; label: string; from?: number; rate?: number}> = ({clip, label, from = 0, rate = 1}) => {
  if (!has(clip)) {
    return (
      <Felt>
        <div style={{position: 'absolute', left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, border: `4px dashed ${C.feltMuted}`, borderRadius: 26, display: 'grid', placeItems: 'center', textAlign: 'center', color: C.feltFg}}>
          <div>
            <div style={{fontFamily: F.body, fontWeight: 700, fontSize: 26, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.sun}}>Live app clip</div>
            <div style={{fontFamily: F.display, fontWeight: 700, fontSize: 56, marginTop: 12}}>{label}</div>
            <div style={{fontFamily: F.mono, fontSize: 24, marginTop: 16, color: C.feltMuted}}>drop public/{clip}</div>
          </div>
        </div>
      </Felt>
    );
  }
  return (
    <Kraft>
      <AbsoluteFill>
        <div style={{position: 'absolute', left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, borderRadius: 18, overflow: 'hidden', border: '8px solid #fff', boxShadow: '0 26px 60px rgba(40,25,10,0.45)', background: C.paper}}>
          <OffthreadVideo src={staticFile(clip)} startFrom={Math.round(from * 30)} playbackRate={rate} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </div>
      </AbsoluteFill>
    </Kraft>
  );
};
