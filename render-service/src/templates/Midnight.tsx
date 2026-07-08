import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadOutfit} from '@remotion/google-fonts/Outfit';
import {WeddingProps, sectionPlan} from './types';

const {fontFamily: cormorant} = loadCormorant();
const {fontFamily: outfit} = loadOutfit();

const C = {
  midnight: '#120B1A',
  shade: '#2B1B3D',
  gold: '#D4AF37',
  orchid: '#7A5C9E',
  black: '#0B0B0F',
  white: '#E7D9F2',
  muted: '#8A6F3A',
};

const Stars: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {Array.from({length: 40}).map((_, i) => {
        const x = random(`sx${i}`) * 1080;
        const y = random(`sy${i}`) * 1920;
        const size = 2 + random(`ss${i}`) * 4;
        const twinkle = 0.2 + 0.8 * Math.abs(Math.sin(frame * 0.05 + i * 1.7));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: C.gold,
              opacity: twinkle * 0.7,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const TrackIn: React.FC<{delay?: number; children: string; style?: React.CSSProperties}> = ({
  delay = 0,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - delay, fps, config: {damping: 200, mass: 0.8}});
  const spacing = interpolate(p, [0, 1], [30, 6]);
  return (
    <div style={{opacity: p, letterSpacing: spacing, ...style}}>{children}</div>
  );
};

const Fade: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  delay = 0,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <div style={{opacity, ...style}}>{children}</div>;
};

const SectionFade: React.FC<{duration: number; children: React.ReactNode}> = ({duration, children}) => {
  const frame = useCurrentFrame();
  const edge = Math.max(1, Math.min(14, Math.floor(duration / 2) - 1));
  const opacity = interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

const Center: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: 90, textAlign: 'center'}}>
    {children}
  </AbsoluteFill>
);

export const Midnight: React.FC<WeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const plan = sectionPlan(durationInFrames);
  const photos = props.photos ?? [];
  const schedule = props.schedule ?? [];
  const frame = useCurrentFrame();
  const musicVolume = interpolate(
    frame,
    [0, fps, durationInFrames - 2 * fps, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );

  return (
    <AbsoluteFill style={{backgroundColor: C.black, fontFamily: outfit, color: C.white}}>
      {props.musicUrl ? <Audio src={props.musicUrl} volume={musicVolume} /> : null}
      <Stars />

      <Sequence durationInFrames={plan.intro}>
        <SectionFade duration={plan.intro}>
          <Center>
            <TrackIn style={{fontSize: 30, textTransform: 'uppercase', color: C.gold, fontWeight: 300}}>
              An evening to remember
            </TrackIn>
            <Fade delay={10}>
              <div style={{fontFamily: cormorant, fontSize: 140, fontWeight: 500, marginTop: 70, lineHeight: 1.05}}>
                {props.couple.partnerOne}
              </div>
            </Fade>
            <Fade delay={20}>
              <div style={{fontFamily: cormorant, fontSize: 64, color: C.gold, fontStyle: 'italic', margin: '24px 0'}}>
                and
              </div>
            </Fade>
            <Fade delay={30}>
              <div style={{fontFamily: cormorant, fontSize: 140, fontWeight: 500, lineHeight: 1.05}}>
                {props.couple.partnerTwo}
              </div>
            </Fade>
          </Center>
        </SectionFade>
      </Sequence>

      <Sequence from={plan.intro} durationInFrames={plan.message}>
        <SectionFade duration={plan.message}>
          <Center>
            <Fade>
              <div style={{width: 2, height: 140, backgroundColor: C.gold, margin: '0 auto 60px'}} />
              <div style={{fontFamily: cormorant, fontSize: 60, lineHeight: 1.5, maxWidth: 860, fontStyle: 'italic'}}>
                {props.message || 'Under a midnight sky, two souls become one.'}
              </div>
              <div style={{width: 2, height: 140, backgroundColor: C.gold, margin: '60px auto 0'}} />
            </Fade>
          </Center>
        </SectionFade>
      </Sequence>

      <Sequence from={plan.intro + plan.message} durationInFrames={plan.photos}>
        <SectionFade duration={plan.photos}>
          {photos.length === 0 ? (
            <Center>
              <Fade>
                <div style={{fontFamily: cormorant, fontSize: 220, color: C.gold}}>
                  {props.couple.partnerOne.charAt(0)}
                  {props.couple.partnerTwo.charAt(0)}
                </div>
              </Fade>
            </Center>
          ) : (
            <PhotoReel photos={photos} duration={plan.photos} />
          )}
        </SectionFade>
      </Sequence>

      <Sequence from={plan.intro + plan.message + plan.photos} durationInFrames={plan.schedule}>
        <SectionFade duration={plan.schedule}>
          <Center>
            <TrackIn style={{fontSize: 30, textTransform: 'uppercase', color: C.gold, fontWeight: 300, marginBottom: 80}}>
              The Program
            </TrackIn>
            {schedule.map((item, i) => (
              <Fade key={i} delay={10 + i * 10}>
                <div style={{display: 'flex', alignItems: 'baseline', gap: 44, margin: '32px 0'}}>
                  <span style={{fontFamily: cormorant, fontSize: 76, fontWeight: 500}}>{item.name}</span>
                  <span style={{fontSize: 36, color: C.orchid, letterSpacing: 4}}>{item.time}</span>
                </div>
              </Fade>
            ))}
          </Center>
        </SectionFade>
      </Sequence>

      <Sequence from={durationInFrames - plan.finale} durationInFrames={plan.finale}>
        <SectionFade duration={plan.finale}>
          <Center>
            <TrackIn style={{fontSize: 32, textTransform: 'uppercase', color: C.gold, fontWeight: 300}}>
              Save the Date
            </TrackIn>
            <Fade delay={12}>
              <div style={{fontFamily: cormorant, fontSize: 104, fontWeight: 500, marginTop: 60}}>
                {props.eventDate}
              </div>
            </Fade>
            <Fade delay={24}>
              <div style={{fontSize: 42, color: C.gold, marginTop: 60, letterSpacing: 3}}>{props.venue.name}</div>
              <div style={{fontSize: 34, color: C.orchid, marginTop: 18, letterSpacing: 8, textTransform: 'uppercase'}}>
                {props.venue.city}
              </div>
            </Fade>
          </Center>
        </SectionFade>
      </Sequence>
    </AbsoluteFill>
  );
};

const PhotoReel: React.FC<{photos: string[]; duration: number}> = ({photos, duration}) => {
  const per = Math.floor(duration / photos.length);
  return (
    <AbsoluteFill>
      {photos.map((src, i) => (
        <Sequence key={i} from={i * per} durationInFrames={i === photos.length - 1 ? duration - i * per : per}>
          <CinematicPhoto src={src} duration={per} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const CinematicPhoto: React.FC<{src: string; duration: number}> = ({src, duration}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, duration], [1.2, 1.0]);
  const edge = Math.max(1, Math.min(12, Math.floor(duration / 2) - 1));
  const opacity = interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{opacity}}>
      <Img
        src={src}
        pauseWhenLoading
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
          filter: 'brightness(0.75) contrast(1.1)',
        }}
      />
      <AbsoluteFill
        style={{background: 'linear-gradient(180deg, rgba(11,11,15,0.6) 0%, rgba(11,11,15,0) 40%, rgba(11,11,15,0) 60%, rgba(11,11,15,0.7) 100%)'}}
      />
    </AbsoluteFill>
  );
};
