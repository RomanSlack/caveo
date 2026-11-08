import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile} from 'remotion';
import {SEGMENTS, segStart} from './theme';
import {Hook} from './scenes/Hook';
import {Architecture} from './scenes/Architecture';
import {EndCard} from './scenes/EndCard';
import {Live} from './scenes/Live';
import {Walkthrough} from './scenes/Walkthrough';
import {Presenter} from './components/Presenter';

const MOTION: Record<string, React.FC> = {
  hook: Hook,
  flow: Walkthrough,
  arch: Architecture,
  end: EndCard,
};

/** Music bed only under the motion stretches, low so Roman's voice leads. Pool Party by Infraction (no copyright). */
const MusicBed: React.FC<{from: number; frames: number; trimStart: number}> = ({from, frames, trimStart}) => (
  <Sequence from={from} durationInFrames={frames}>
    <Audio
      src={staticFile('music/pool-party.mp3')}
      startFrom={trimStart}
      volume={(f) => interpolate(f, [0, 12, frames - 18, frames], [0, 0.1, 0.1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
    />
  </Sequence>
);

export const Caveo: React.FC = () => {
  const liveStart = segStart('summit');
  const archStart = segStart('arch');
  const total = SEGMENTS.reduce((a, s) => a + s.frames, 0);
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {SEGMENTS.map((s) => {
        const M = MOTION[s.id];
        return (
          <Sequence key={s.id} from={segStart(s.id)} durationInFrames={s.frames} name={s.label}>
            {s.kind === 'live' ? <Live clip={s.clip!} label={s.label} from={s.from} rate={s.rate} /> : <M />}
          </Sequence>
        );
      })}
      <Presenter />
      {/* bed under lines 1-6, silent under the live clips, back for lines 12-14 */}
      <MusicBed from={0} frames={liveStart} trimStart={0} />
      <MusicBed from={archStart} frames={total - archStart} trimStart={900} />
    </AbsoluteFill>
  );
};
