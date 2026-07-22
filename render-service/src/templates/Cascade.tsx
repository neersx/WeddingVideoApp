import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {WeddingProps} from './types';
import {BrandOutro} from './BrandOutro';
import {C, ClosingScreen, MomentScreen, OpeningScreen, useTimelinePlan} from './timelineScreens';

// Slides each screen in vertically from the top down to its resting place. No
// exit animation: the next screen slides down over this one, so consecutive
// sequences overlap by `enter` frames (below) and there's never a gap. A motion
// blur peaks while the screen is travelling and clears as it settles, and a
// short opacity ramp softens the leading edge — together they make the hand-off
// read as a smooth glide rather than a hard cut.
const SlideDown: React.FC<{enter: number; children: React.ReactNode}> = ({enter, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame, fps, durationInFrames: enter, config: {damping: 200}});
  const translateY = interpolate(p, [0, 1], [-100, 0]); // percent of screen height
  const blur = interpolate(p, [0, 1], [16, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const opacity = interpolate(p, [0, 0.3, 1], [0, 1, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{transform: `translateY(${translateY}%)`, filter: `blur(${blur}px)`, opacity}}>
      {children}
    </AbsoluteFill>
  );
};

export const Cascade: React.FC<WeddingProps> = (props) => {
  const {durationInFrames} = useVideoConfig();
  const {timeline, items, occasion, per, brandingStart, brandingDuration, musicVolume} = useTimelinePlan(props);
  // The slide/overlap window: each screen stays on screen `enter` frames past
  // its slot so the next can slide down over it without exposing the backdrop.
  const enter = Math.max(1, Math.min(26, Math.floor(per / 3)));
  const tail = (from: number) => Math.min(per + enter, durationInFrames - from);

  return (
    <AbsoluteFill style={{backgroundColor: C.plum}}>
      {props.musicUrl ? <Audio src={props.musicUrl} volume={musicVolume} /> : null}

      <Sequence from={0} durationInFrames={tail(0)}>
        <SlideDown enter={enter}>
          <OpeningScreen screen={timeline.opening} eyebrow={occasion} duration={per} />
        </SlideDown>
      </Sequence>

      {items.map((moment, i) => {
        const from = (i + 1) * per;
        return (
          <Sequence key={i} from={from} durationInFrames={tail(from)}>
            <SlideDown enter={enter}>
              <MomentScreen moment={moment} index={i} total={items.length} duration={per} />
            </SlideDown>
          </Sequence>
        );
      })}

      <Sequence from={(items.length + 1) * per} durationInFrames={tail((items.length + 1) * per)}>
        <SlideDown enter={enter}>
          <ClosingScreen screen={timeline.closing} duration={per} />
        </SlideDown>
      </Sequence>

      <Sequence from={brandingStart} durationInFrames={brandingDuration}>
        <SlideDown enter={enter}>
          <BrandOutro durationInFrames={brandingDuration} />
        </SlideDown>
      </Sequence>
    </AbsoluteFill>
  );
};
