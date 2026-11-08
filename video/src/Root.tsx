import React from 'react';
import {Composition} from 'remotion';
import {FPS, HEIGHT, LINES, TOTAL_FRAMES, WIDTH} from './theme';
import {Caveo} from './Caveo';
import {Hook} from './scenes/Hook';
import {Card} from './scenes/Card';
import {Architecture} from './scenes/Architecture';
import {EndCard} from './scenes/EndCard';
import {Verdict, VERDICT_FRAMES, Walkthrough} from './scenes/Walkthrough';

const C1 = () => <Card n={1} />;
const C2 = () => <Card n={2} />;
const C3 = () => <Card n={3} />;

export const RemotionRoot: React.FC = () => {
  const base = {fps: FPS, width: WIDTH, height: HEIGHT};
  return (
    <>
      <Composition id="Caveo" component={Caveo} durationInFrames={TOTAL_FRAMES} {...base} />
      <Composition id="Hook" component={Hook} durationInFrames={LINES.l1 + LINES.l2 + LINES.l3 + LINES.l4} {...base} />
      <Composition id="Walkthrough" component={Walkthrough} durationInFrames={LINES.l5 + LINES.l6} {...base} />
      <Composition id="Verdict" component={Verdict} durationInFrames={VERDICT_FRAMES} {...base} />
      <Composition id="Card1" component={C1} durationInFrames={40} {...base} />
      <Composition id="Card2" component={C2} durationInFrames={40} {...base} />
      <Composition id="Card3" component={C3} durationInFrames={40} {...base} />
      <Composition id="Architecture" component={Architecture} durationInFrames={LINES.l12 + LINES.l13} {...base} />
      <Composition id="EndCard" component={EndCard} durationInFrames={LINES.l14} {...base} />
    </>
  );
};
