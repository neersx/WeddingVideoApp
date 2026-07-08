import React from 'react';
import {Composition} from 'remotion';
import {Marigold} from '../templates/Marigold';
import {Midnight} from '../templates/Midnight';
import {Heartbeat} from '../templates/Heartbeat';
import {Story} from '../templates/Story';
import {Poster} from '../templates/Poster';
import {defaultProps, FPS, WeddingProps} from '../templates/types';

const meta = ({props}: {props: WeddingProps}) => ({
  durationInFrames: Math.round(Math.min(60, Math.max(5, props.durationInSeconds || 30)) * FPS),
});

const compositions: {id: string; component: React.FC<WeddingProps>}[] = [
  {id: 'Marigold', component: Marigold},
  {id: 'Midnight', component: Midnight},
  {id: 'Heartbeat', component: Heartbeat},
  {id: 'Story', component: Story},
  {id: 'Poster', component: Poster},
];

export const Root: React.FC = () => (
  <>
    {compositions.map(({id, component}) => (
      <Composition
        key={id}
        id={id}
        component={component}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={30 * FPS}
        defaultProps={defaultProps}
        calculateMetadata={meta}
      />
    ))}
  </>
);
