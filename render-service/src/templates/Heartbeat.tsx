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
import {loadFont as loadDancing} from '@remotion/google-fonts/DancingScript';
import {loadFont as loadMontserrat} from '@remotion/google-fonts/Montserrat';
import {WeddingProps} from './types';

const {fontFamily: cormorant} = loadCormorant();
const {fontFamily: dancing} = loadDancing();
const {fontFamily: montserrat} = loadMontserrat();

const C = {
  blush: '#F5D0D8',
  rose: '#B4405F',
  deep: '#7A1E3A',
  cream: '#FFF7F0',
  gold: '#C7A365',
  ink: '#2A1620',
};

const heartPath =
  'M12 21s-7-4.5-9.5-9C.7 8.3 3 4 7 4c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 4 0 6.3 4.3 4.5 8-2.5 4.5-9.5 9-9.5 9z';

const Beating: React.FC<{size: number; color: string; edgeColor?: string}> = ({size, color, edgeColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beat = Math.sin((frame / fps) * Math.PI * 2.6) * 0.06 + 1;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{transform: `scale(${beat})`}}>
      <path d={heartPath} fill={color} stroke={edgeColor || 'none'} strokeWidth={edgeColor ? 0.4 : 0} />
    </svg>
  );
};

const FloatingHearts: React.FC = () => {
  const frame = useCurrentFrame();
  const {height} = useVideoConfig();
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {Array.from({length: 14}).map((_, i) => {
        const seed = i * 37.7;
        const x = (Math.sin(seed) * 0.5 + 0.5) * 1080;
        const speed = 0.6 + ((seed * 3) % 100) / 100;
        const y = ((frame * speed * 2 + seed * 40) % (height + 300)) - 150;
        const size = 20 + ((seed * 7) % 30);
        const opacity = 0.22 + ((seed * 5) % 30) / 100;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              opacity,
            }}
          >
            <svg viewBox="0 0 24 24" width={size} height={size}>
              <path d={heartPath} fill={i % 2 === 0 ? C.rose : C.gold} />
            </svg>
          </div>
        );
      })}
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
  return <div style={{opacity: p, transform: `translateY(${(1 - p) * 50}px)`, ...style}}>{children}</div>;
};

const SectionFade: React.FC<{duration: number; children: React.ReactNode}> = ({duration, children}) => {
  const frame = useCurrentFrame();
  const edge = Math.max(1, Math.min(12, Math.floor(duration / 2) - 1));
  const opacity = interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

const Center: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <AbsoluteFill
    style={{justifyContent: 'center', alignItems: 'center', padding: 90, textAlign: 'center', ...style}}
  >
    {children}
  </AbsoluteFill>
);

// Section plan: intro heart 18%, photos w/ date 42%, events 20%, message + invite 20%
const plan = (df: number) => {
  const intro = Math.round(df * 0.18);
  const photos = Math.round(df * 0.42);
  const events = Math.round(df * 0.2);
  const finale = df - intro - photos - events;
  return {intro, photos, events, finale};
};

export const Heartbeat: React.FC<WeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const p = plan(durationInFrames);
  const photos = (props.photos ?? []).slice(0, 6);
  const schedule = props.schedule ?? [];
  const frame = useCurrentFrame();
  const musicVolume = interpolate(
    frame,
    [0, fps, durationInFrames - 2 * fps, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );

  return (
    <AbsoluteFill style={{backgroundColor: C.cream, fontFamily: montserrat}}>
      {props.musicUrl ? <Audio src={props.musicUrl} volume={musicVolume} /> : null}
      <FloatingHearts />

      <Sequence durationInFrames={p.intro}>
        <SectionFade duration={p.intro}>
          <Center>
            <FadeUp>
              <div style={{marginBottom: 40}}>
                <Beating size={220} color={C.rose} />
              </div>
            </FadeUp>
            <FadeUp delay={10}>
              <div
                style={{
                  fontFamily: dancing,
                  fontSize: 96,
                  color: C.deep,
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                {props.couple.partnerOne}
              </div>
            </FadeUp>
            <FadeUp delay={18}>
              <div style={{fontFamily: cormorant, fontSize: 52, color: C.gold, margin: '10px 0', fontStyle: 'italic'}}>
                &amp;
              </div>
            </FadeUp>
            <FadeUp delay={26}>
              <div
                style={{
                  fontFamily: dancing,
                  fontSize: 96,
                  color: C.deep,
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                {props.couple.partnerTwo}
              </div>
            </FadeUp>
            <FadeUp delay={40}>
              <div
                style={{
                  marginTop: 40,
                  fontSize: 22,
                  letterSpacing: 12,
                  textTransform: 'uppercase',
                  color: C.rose,
                }}
              >
                Are Getting Married
              </div>
            </FadeUp>
          </Center>
        </SectionFade>
      </Sequence>

      <Sequence from={p.intro} durationInFrames={p.photos}>
        <SectionFade duration={p.photos}>
          <PhotoBook photos={photos} duration={p.photos} eventDate={props.eventDate} venueName={props.venue.name} />
        </SectionFade>
      </Sequence>

      <Sequence from={p.intro + p.photos} durationInFrames={p.events}>
        <SectionFade duration={p.events}>
          <Center>
            <FadeUp>
              <div style={{fontSize: 26, letterSpacing: 14, textTransform: 'uppercase', color: C.rose, marginBottom: 44}}>
                Wedding Events
              </div>
            </FadeUp>
            {schedule.slice(0, 4).map((item, i) => (
              <FadeUp key={i} delay={8 + i * 8}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 32,
                    padding: '18px 30px',
                    margin: '10px 0',
                    background: 'rgba(180,64,95,0.06)',
                    borderRadius: 999,
                    borderLeft: `4px solid ${C.gold}`,
                  }}
                >
                  <div style={{width: 26, height: 26}}>
                    <svg viewBox="0 0 24 24" width={26} height={26}>
                      <path d={heartPath} fill={C.rose} />
                    </svg>
                  </div>
                  <span style={{fontFamily: cormorant, fontSize: 58, color: C.deep, fontWeight: 700}}>{item.name}</span>
                  <span style={{marginLeft: 'auto', fontSize: 34, color: C.gold, letterSpacing: 2}}>{item.time}</span>
                </div>
              </FadeUp>
            ))}
          </Center>
        </SectionFade>
      </Sequence>

      <Sequence from={p.intro + p.photos + p.events} durationInFrames={p.finale}>
        <SectionFade duration={p.finale}>
          <Center>
            <FadeUp>
              <div style={{fontSize: 22, letterSpacing: 14, textTransform: 'uppercase', color: C.rose}}>
                With love, we invite you
              </div>
            </FadeUp>
            <FadeUp delay={8}>
              <div
                style={{
                  fontFamily: cormorant,
                  fontStyle: 'italic',
                  fontSize: 48,
                  color: C.deep,
                  maxWidth: 850,
                  lineHeight: 1.4,
                  margin: '30px 0',
                }}
              >
                &ldquo;{props.message || 'Please join us as we begin our forever.'}&rdquo;
              </div>
            </FadeUp>
            <FadeUp delay={20}>
              <div style={{margin: '20px 0'}}>
                <Beating size={90} color={C.rose} />
              </div>
            </FadeUp>
            <FadeUp delay={26}>
              <div style={{fontFamily: dancing, fontSize: 72, color: C.deep, fontWeight: 700}}>
                {props.eventDate}
              </div>
              <div style={{fontSize: 30, color: C.gold, marginTop: 12, letterSpacing: 4, textTransform: 'uppercase'}}>
                {props.venue.name} · {props.venue.city}
              </div>
            </FadeUp>
          </Center>
        </SectionFade>
      </Sequence>
    </AbsoluteFill>
  );
};

const PhotoBook: React.FC<{photos: string[]; duration: number; eventDate: string; venueName: string}> = ({
  photos,
  duration,
  eventDate,
  venueName,
}) => {
  if (photos.length === 0) {
    return (
      <Center>
        <div
          style={{
            width: 720,
            height: 960,
            borderRadius: 30,
            background: `linear-gradient(135deg, ${C.blush}, ${C.rose})`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 40px 80px rgba(122,30,58,0.3)',
          }}
        >
          <div style={{width: 260}}>
            <Beating size={260} color={C.cream} edgeColor={C.gold} />
          </div>
        </div>
        <DateBar eventDate={eventDate} venueName={venueName} />
      </Center>
    );
  }
  const per = Math.floor(duration / photos.length);
  return (
    <AbsoluteFill>
      {photos.map((src, i) => (
        <Sequence
          key={i}
          from={i * per}
          durationInFrames={i === photos.length - 1 ? duration - i * per : per}
        >
          <PhotoCard src={src} duration={per} index={i} />
        </Sequence>
      ))}
      <DateBar eventDate={eventDate} venueName={venueName} />
    </AbsoluteFill>
  );
};

const PhotoCard: React.FC<{src: string; duration: number; index: number}> = ({src, duration, index}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, duration], [1.04, 1.14]);
  const pan = interpolate(frame, [0, duration], [0, index % 2 === 0 ? -20 : 20]);
  const edge = Math.max(1, Math.min(10, Math.floor(duration / 2) - 1));
  const opacity = interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity}}>
      <div
        style={{
          width: 900,
          height: 1250,
          overflow: 'hidden',
          borderRadius: 30,
          boxShadow: '0 40px 80px rgba(122,30,58,0.25)',
          border: `8px solid ${C.cream}`,
        }}
      >
        <Img
          src={src}
          pauseWhenLoading
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translateX(${pan}px)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const DateBar: React.FC<{eventDate: string; venueName: string}> = ({eventDate, venueName}) => {
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', padding: 90, pointerEvents: 'none'}}>
      <div
        style={{
          background: 'rgba(42,22,32,0.85)',
          padding: '20px 60px',
          borderRadius: 999,
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          gap: 30,
          border: `2px solid ${C.gold}`,
        }}
      >
        <div style={{width: 30, height: 30}}>
          <svg viewBox="0 0 24 24" width={30} height={30}>
            <path d={heartPath} fill={C.rose} />
          </svg>
        </div>
        <div style={{textAlign: 'left'}}>
          <div style={{color: C.cream, fontFamily: cormorant, fontSize: 40, fontWeight: 700, lineHeight: 1}}>{eventDate}</div>
          <div style={{color: C.gold, fontSize: 20, letterSpacing: 4, textTransform: 'uppercase', marginTop: 4}}>
            {venueName || ' '}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
