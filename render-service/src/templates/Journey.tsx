import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame} from 'remotion';
import {WeddingProps} from './types';
import {BrandOutro} from './BrandOutro';
import {C, ClosingScreen, MomentScreen, OpeningScreen, useTimelinePlan} from './timelineScreens';

// Cross-fades each screen in and out at its edges.
const ScreenFade: React.FC<{duration: number; children: React.ReactNode}> = ({duration, children}) => {
  const frame = useCurrentFrame();
  const edge = Math.max(1, Math.min(14, Math.floor(duration / 3)));
  const opacity = interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

export const Journey: React.FC<WeddingProps> = (props) => {
  const {timeline, items, occasion, per, brandingStart, brandingDuration, musicVolume} = useTimelinePlan(props);

  return (
    <AbsoluteFill style={{backgroundColor: C.plum}}>
      {props.musicUrl ? <Audio src={props.musicUrl} volume={musicVolume} /> : null}

      <Sequence durationInFrames={per}>
        <ScreenFade duration={per}>
          <OpeningScreen screen={timeline.opening} eyebrow={occasion} duration={per} />
        </ScreenFade>
      </Sequence>

      {items.map((moment, i) => (
        <Sequence key={i} from={(i + 1) * per} durationInFrames={per}>
          <ScreenFade duration={per}>
            <MomentScreen moment={moment} index={i} total={items.length} duration={per} />
          </ScreenFade>
        </Sequence>
      ))}

      <Sequence from={(items.length + 1) * per} durationInFrames={per}>
        <ScreenFade duration={per}>
          <ClosingScreen screen={timeline.closing} duration={per} />
        </ScreenFade>
      </Sequence>

      <Sequence from={brandingStart} durationInFrames={brandingDuration}>
        <BrandOutro durationInFrames={brandingDuration} />
      </Sequence>
    </AbsoluteFill>
  );
};
