import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadOutfit} from '@remotion/google-fonts/Outfit';
import {WeddingProps, TimelineData, TimelineMoment, TimelineScreen} from './types';
import {BrandOutro} from './BrandOutro';

const {fontFamily: serif} = loadCormorant();
const {fontFamily: sans} = loadOutfit();

const C = {
  plum: '#1A1526',
  violet: '#6D3B8F',
  orchid: '#C58BD8',
  champagne: '#F3E6C4',
  gold: '#E7C77A',
  cream: '#F5EEFF',
};

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

// Full-bleed background photo with a slow Ken Burns push and a plum scrim that
// darkens the top and bottom so text stays legible over any image.
const PhotoBackdrop: React.FC<{src?: string; duration: number; index: number}> = ({src, duration, index}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, duration], [1.06, 1.16]);
  const pan = interpolate(frame, [0, duration], [0, index % 2 === 0 ? -24 : 24]);
  return (
    <AbsoluteFill style={{backgroundColor: C.plum, overflow: 'hidden'}}>
      {src ? (
        <Img
          src={src}
          pauseWhenLoading
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translateX(${pan}px)`,
            filter: 'saturate(1.05)',
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(26,21,38,0.82) 0%, rgba(26,21,38,0.28) 34%, rgba(26,21,38,0.42) 62%, rgba(26,21,38,0.9) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const FadeUp: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  delay = 0,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - delay, fps, config: {damping: 200}});
  return <div style={{opacity: p, transform: `translateY(${(1 - p) * 44}px)`, ...style}}>{children}</div>;
};

const Ornament: React.FC<{delay?: number}> = ({delay = 0}) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame - delay, [0, 22], [0, 120], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '26px 0'}}>
      <div style={{width: w, height: 1, background: `linear-gradient(90deg, transparent, ${C.gold})`}} />
      <div style={{width: 8, height: 8, transform: 'rotate(45deg)', background: C.gold, boxShadow: `0 0 12px ${C.gold}`}} />
      <div style={{width: w, height: 1, background: `linear-gradient(90deg, ${C.gold}, transparent)`}} />
    </div>
  );
};

const Frame: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: 110, textAlign: 'center'}}>
    {children}
  </AbsoluteFill>
);

const OpeningScreen: React.FC<{screen: TimelineScreen; eyebrow: string; duration: number}> = ({screen, eyebrow, duration}) => (
  <AbsoluteFill>
    <PhotoBackdrop src={screen.backgroundImage} duration={duration} index={0} />
    <Frame>
      {eyebrow ? (
        <FadeUp>
          <div style={{fontFamily: sans, fontSize: 30, letterSpacing: 10, textTransform: 'uppercase', color: C.gold}}>{eyebrow}</div>
        </FadeUp>
      ) : null}
      <Ornament delay={6} />
      <FadeUp delay={10}>
        <div style={{fontFamily: serif, fontSize: 104, lineHeight: 1.08, color: C.cream, fontWeight: 600}}>{screen.title}</div>
      </FadeUp>
      {screen.message ? (
        <FadeUp delay={20}>
          <div style={{fontFamily: serif, fontSize: 46, lineHeight: 1.5, color: C.champagne, fontStyle: 'italic', maxWidth: 820, marginTop: 30}}>
            {screen.message}
          </div>
        </FadeUp>
      ) : null}
    </Frame>
  </AbsoluteFill>
);

const MomentScreen: React.FC<{moment: TimelineMoment; index: number; total: number; duration: number}> = ({
  moment,
  index,
  total,
  duration,
}) => (
  <AbsoluteFill>
    <PhotoBackdrop src={moment.backgroundImage} duration={duration} index={index + 1} />
    {/* Chapter progress — a quiet row of dots marking where we are in the story. */}
    <div style={{position: 'absolute', top: 90, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10}}>
      {Array.from({length: total}).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === index ? 26 : 8,
            height: 8,
            borderRadius: 4,
            background: i === index ? C.gold : 'rgba(245,238,255,0.4)',
            transition: 'none',
          }}
        />
      ))}
    </div>
    <Frame>
      {moment.monthYear ? (
        <FadeUp>
          <div style={{fontFamily: sans, fontSize: 30, letterSpacing: 8, textTransform: 'uppercase', color: C.gold}}>{moment.monthYear}</div>
        </FadeUp>
      ) : null}
      <Ornament delay={5} />
      <FadeUp delay={9}>
        <div style={{fontFamily: serif, fontSize: 92, lineHeight: 1.1, color: C.cream, fontWeight: 600}}>{moment.title}</div>
      </FadeUp>
      {moment.message ? (
        <FadeUp delay={18}>
          <div style={{fontFamily: serif, fontSize: 44, lineHeight: 1.5, color: C.champagne, maxWidth: 840, marginTop: 26}}>
            {moment.message}
          </div>
        </FadeUp>
      ) : null}
    </Frame>
  </AbsoluteFill>
);

const ClosingScreen: React.FC<{screen: TimelineScreen; duration: number}> = ({screen, duration}) => (
  <AbsoluteFill>
    <PhotoBackdrop src={screen.backgroundImage} duration={duration} index={99} />
    <Frame>
      <Ornament />
      <FadeUp delay={6}>
        <div style={{fontFamily: serif, fontSize: 100, lineHeight: 1.1, color: C.cream, fontWeight: 600}}>{screen.title}</div>
      </FadeUp>
      {screen.message ? (
        <FadeUp delay={16}>
          <div style={{fontFamily: serif, fontSize: 46, lineHeight: 1.5, color: C.champagne, fontStyle: 'italic', maxWidth: 820, marginTop: 30}}>
            {screen.message}
          </div>
        </FadeUp>
      ) : null}
      <Ornament delay={24} />
    </Frame>
  </AbsoluteFill>
);

const EMPTY_TIMELINE: TimelineData = {
  opening: {title: 'A Journey Through Beautiful Memories', message: 'Every picture holds a memory.'},
  items: [],
  closing: {title: 'And the Story Continues…', message: 'Here is to every memory still waiting for us.'},
};

export const Journey: React.FC<WeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const timeline = (props.resolved?.timeline as TimelineData) || EMPTY_TIMELINE;
  const items = timeline.items || [];
  const occasion = props.resolved?.occasionLabel || props.resolved?.occasion || 'Our Story';

  // Screens = opening + each moment + closing + branding. Split the composition
  // evenly across content screens; branding gets the remainder.
  const totalScreens = items.length + 3;
  const per = Math.max(1, Math.floor(durationInFrames / totalScreens));
  const contentScreens = items.length + 2; // opening + moments + closing
  const brandingStart = contentScreens * per;
  const brandingDuration = Math.max(1, durationInFrames - brandingStart);

  const musicVolume = interpolate(
    frame,
    [0, fps, durationInFrames - 2 * fps, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

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
