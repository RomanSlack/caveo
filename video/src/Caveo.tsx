import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile} from 'remotion';
import {END_HOLD, SEGMENTS, segStart} from './theme';
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

/** One continuous music bed, kept well under Roman's voice; it lifts only after his last word, on the end card hold.
 * Pool Party by Infraction (no copyright). BED is about -30 dB against the -16 LUFS voice. */
const BED = 0.035;
const MusicBed: React.FC<{frames: number; voiceEnd: number}> = ({frames, voiceEnd}) => (
  <Audio
    src={staticFile('music/pool-party.mp3')}
    volume={(f) =>
      interpolate(f, [0, 15, voiceEnd, voiceEnd + 12, frames - 20, frames], [0, BED, BED, 0.11, 0.11, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    }
  />
);

export const Caveo: React.FC = () => {
  const total = SEGMENTS.reduce((a, s) => a + s.frames, 0);
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {SEGMENTS.map((s) => {
        const M = MOTION[s.id];
        return (
          <Sequence key={s.id} from={segStart(s.id)} durationInFrames={s.frames} name={s.label}>
            {s.kind === 'live' ? <Live clip={s.clip!} label={s.label} from={s.from} rate={s.rate} cams={s.cams} /> : <M />}
          </Sequence>
        );
      })}
      <Presenter />
      <MusicBed frames={total} voiceEnd={total - END_HOLD} />
    </AbsoluteFill>
  );
};
