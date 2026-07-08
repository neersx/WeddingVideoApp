import React from 'react';
import {Composition} from 'remotion';
import {Marigold} from '../templates/Marigold';
import {Midnight} from '../templates/Midnight';
import {defaultProps, FPS, WeddingProps} from '../templates/types';

const meta = ({props}: {props: WeddingProps}) => ({
  durationInFrames: Math.round(Math.min(60, Math.max(5, props.durationInSeconds || 30)) * FPS),
});

export const Root: React.FC = () => (
  <>
    <Composition
      id="Marigold"
      component={Marigold}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={30 * FPS}
      defaultProps={defaultProps}
      calculateMetadata={meta}
    />
    <Composition
      id="Midnight"
      component={Midnight}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={30 * FPS}
      defaultProps={defaultProps}
      calculateMetadata={meta}
    />
  </>
);
