import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadOutfit} from '@remotion/google-fonts/Outfit';
import {WeddingProps, sectionPlan} from './types';

const {fontFamily: cormorant} = loadCormorant();
const {fontFamily: outfit} = loadOutfit();

const C = {
  cream: '#FFF7F3',
  champagne: '#E7C694',
  rose: '#C58B7D',
  plum: '#2A1535',
  muted: 'rgba(255,247,243,0.72)',
};

const SectionFade: React.FC<{duration: number; children: React.ReactNode}> = ({duration, children}) => {
  const frame = useCurrentFrame();
  const edge = Math.max(1, Math.min(16, Math.floor(duration / 2) - 1));
  const opacity = interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

const Fade: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  delay = 0,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame - delay, [0, 28], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <div style={{opacity, transform: `translateY(${y}px)`, ...style}}>{children}</div>;
};

const TrackingText: React.FC<{children: string; delay?: number; style?: React.CSSProperties}> = ({
  children,
  delay = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - delay, fps, config: {damping: 180, mass: 0.65}});
  return (
    <div
      style={{
        opacity: p,
        letterSpacing: interpolate(p, [0, 1], [22, 7]),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 240], [1.04, 1.12], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{backgroundColor: C.plum, overflow: 'hidden'}}>
      <Img
        src={staticFile('engagement-glow-bg.svg')}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(18,9,28,0.08) 0%, rgba(18,9,28,0.14) 52%, rgba(13,5,20,0.78) 100%)',
        }}
      />
      {Array.from({length: 16}).map((_, i) => {
        const x = random(`engage-x-${i}`) * 1080;
        const y = random(`engage-y-${i}`) * 1920;
        const size = 5 + random(`engage-size-${i}`) * 18;
        const pulse = 0.18 + 0.28 * Math.abs(Math.sin(frame * 0.035 + i));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '999px',
              backgroundColor: i % 3 === 0 ? '#F8D6B6' : '#E8B9D5',
              opacity: pulse,
              filter: 'blur(6px)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const BrandMark: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: 118,
      right: 76,
      display: 'flex',
      alignItems: 'center',
      gap: 22,
      color: C.cream,
      fontFamily: cormorant,
      fontSize: 50,
      letterSpacing: 1,
      opacity: 0.92,
    }}
  >
    <div
      style={{
        width: 23,
        height: 31,
        border: `4px solid ${C.champagne}`,
        borderRadius: '60% 60% 70% 70%',
        transform: 'rotate(10deg)',
      }}
    />
    <span>Invita Videos</span>
  </div>
);

const HeroNames: React.FC<WeddingProps> = (props) => (
  <AbsoluteFill style={{justifyContent: 'flex-end', padding: '0 76px 250px'}}>
    <TrackingText
      style={{
        color: C.champagne,
        fontFamily: outfit,
        fontSize: 35,
        fontWeight: 700,
        textTransform: 'uppercase',
        marginBottom: 52,
      }}
    >
      Together with their families
    </TrackingText>
    <Fade delay={14}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 34,
          color: C.cream,
          fontFamily: cormorant,
          fontSize: 126,
          lineHeight: 0.98,
          textShadow: '0 16px 44px rgba(0,0,0,0.22)',
        }}
      >
        <span>{props.couple.partnerOne}</span>
        <span style={{fontSize: 80, color: C.champagne, fontStyle: 'italic'}}>and</span>
        <span>{props.couple.partnerTwo}</span>
      </div>
    </Fade>
    <Fade delay={30}>
      <div
        style={{
          marginTop: 62,
          color: C.cream,
          fontFamily: outfit,
          fontSize: 43,
          letterSpacing: 1.5,
        }}
      >
        <strong>{props.eventDate || '14 December 2026'}</strong>
        <span style={{color: C.muted}}> · {props.venue.name || 'The Grand Palms'}{props.venue.city ? `, ${props.venue.city}` : ''}</span>
      </div>
    </Fade>
  </AbsoluteFill>
);

const MessageCard: React.FC<WeddingProps> = (props) => (
  <AbsoluteFill style={{justifyContent: 'center', padding: 96}}>
    <Fade>
      <div
        style={{
          border: '1px solid rgba(231,198,148,0.45)',
          borderRadius: 42,
          padding: '88px 72px',
          background: 'rgba(24,12,31,0.28)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
          color: C.cream,
          textAlign: 'center',
        }}
      >
        <div style={{fontFamily: outfit, color: C.champagne, fontSize: 29, letterSpacing: 8, textTransform: 'uppercase'}}>
          Engagement Celebration
        </div>
        <div style={{fontFamily: cormorant, fontSize: 67, lineHeight: 1.35, marginTop: 48, fontStyle: 'italic'}}>
          {props.message || 'With joy in their hearts, they invite you to celebrate the beginning of their forever.'}
        </div>
      </div>
    </Fade>
  </AbsoluteFill>
);

const PhotoMoment: React.FC<{photos: string[]; duration: number; couple: WeddingProps['couple']}> = ({photos, duration, couple}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20, duration - 18, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [0, duration], [1.08, 1.0]);

  if (!photos.length) {
    return (
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity}}>
        <div style={{fontFamily: cormorant, color: C.champagne, fontSize: 210}}>
          {couple.partnerOne.charAt(0)}
          <span style={{color: C.cream}}>&amp;</span>
          {couple.partnerTwo.charAt(0)}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{opacity, padding: 80, justifyContent: 'center'}}>
      <div
        style={{
          height: 1180,
          borderRadius: 52,
          overflow: 'hidden',
          border: '2px solid rgba(231,198,148,0.55)',
          boxShadow: '0 38px 90px rgba(0,0,0,0.34)',
        }}
      >
        <Img
          src={photos[0]}
          pauseWhenLoading
          style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, filter: 'brightness(0.82) saturate(1.08)'}}
        />
      </div>
    </AbsoluteFill>
  );
};

const ScheduleMoment: React.FC<WeddingProps & {duration: number}> = (props) => (
  <AbsoluteFill style={{justifyContent: 'center', padding: 92}}>
    <Fade>
      <div style={{fontFamily: outfit, color: C.champagne, fontSize: 30, letterSpacing: 8, textTransform: 'uppercase', marginBottom: 62}}>
        Ceremony Details
      </div>
      {(props.schedule?.length ? props.schedule : [{name: 'Engagement', time: props.eventDate || 'Save the date'}]).slice(0, 4).map((item, index) => (
        <div
          key={`${item.name}-${index}`}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 30,
            color: C.cream,
            borderTop: '1px solid rgba(231,198,148,0.28)',
            padding: '34px 0',
            fontFamily: outfit,
            fontSize: 38,
          }}
        >
          <span style={{fontFamily: cormorant, fontSize: 62}}>{item.name}</span>
          <span style={{color: C.muted, textAlign: 'right'}}>{item.time}</span>
        </div>
      ))}
    </Fade>
  </AbsoluteFill>
);

export const EngagementGlow: React.FC<WeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const plan = sectionPlan(durationInFrames);
  const frame = useCurrentFrame();
  const musicVolume = interpolate(
    frame,
    [0, fps, durationInFrames - 2 * fps, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );

  return (
    <AbsoluteFill style={{fontFamily: outfit, backgroundColor: C.plum}}>
      {props.musicUrl ? <Audio src={props.musicUrl} volume={musicVolume} /> : null}
      <Background />
      <BrandMark />

      <Sequence durationInFrames={plan.intro}>
        <SectionFade duration={plan.intro}>
          <HeroNames {...props} />
        </SectionFade>
      </Sequence>

      <Sequence from={plan.intro} durationInFrames={plan.message}>
        <SectionFade duration={plan.message}>
          <MessageCard {...props} />
        </SectionFade>
      </Sequence>

      <Sequence from={plan.intro + plan.message} durationInFrames={plan.photos}>
        <SectionFade duration={plan.photos}>
          <PhotoMoment photos={props.photos ?? []} duration={plan.photos} couple={props.couple} />
        </SectionFade>
      </Sequence>

      <Sequence from={plan.intro + plan.message + plan.photos} durationInFrames={plan.schedule}>
        <SectionFade duration={plan.schedule}>
          <ScheduleMoment {...props} duration={plan.schedule} />
        </SectionFade>
      </Sequence>

      <Sequence from={durationInFrames - plan.finale} durationInFrames={plan.finale}>
        <SectionFade duration={plan.finale}>
          <HeroNames {...props} />
        </SectionFade>
      </Sequence>
    </AbsoluteFill>
  );
};
