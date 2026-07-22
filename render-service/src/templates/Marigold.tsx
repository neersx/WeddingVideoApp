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
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadMontserrat} from '@remotion/google-fonts/Montserrat';
import {WeddingProps, sectionPlan} from './types';

const {fontFamily: playfair} = loadPlayfair();
const {fontFamily: montserrat} = loadMontserrat();

const C = {
  rust: '#C55A36',
  orange: '#E07A5F',
  gold: '#D4AF37',
  yellow: '#F8AB5B',
  sage: '#81B29A',
  bg: '#FFF8F0',
  dark: '#4A2545',
};

const Petals: React.FC = () => {
  const frame = useCurrentFrame();
  const {height, durationInFrames} = useVideoConfig();
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {Array.from({length: 22}).map((_, i) => {
        const x = random(`px${i}`) * 1080;
        const size = 18 + random(`ps${i}`) * 30;
        const speed = 0.6 + random(`pv${i}`) * 0.8;
        const y = ((frame * speed * 3 + random(`py${i}`) * height * 2) % (height + 200)) - 100;
        const rot = frame * (1 + random(`pr${i}`) * 3) + random(`pr2${i}`) * 360;
        const color = [C.gold, C.yellow, C.orange][i % 3];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size * 0.6,
              borderRadius: '50% 0 50% 0',
              backgroundColor: color,
              opacity: 0.35 + random(`po${i}`) * 0.3,
              transform: `rotate(${rot}deg)`,
            }}
          />
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
  return (
    <div style={{opacity: p, transform: `translateY(${(1 - p) * 60}px)`, ...style}}>{children}</div>
  );
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

// Sits behind the intro slide's text: the couple's first photo, full-bleed
// with no padding, plus a silver gradient scrim boxed to the same ~55% of
// the frame the text occupies — dark enough at the edges and lighter through
// the middle to keep the couple's names legible over any photo.
const IntroBackdrop: React.FC<{src: string}> = ({src}) => (
  <AbsoluteFill>
    <Img src={src} pauseWhenLoading style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: '75%',
          height: '55%',
          background:
            'linear-gradient(180deg, rgba(192,192,192,0.8) 0%, rgba(192,192,192,0.45) 50%, rgba(192,192,192,0.8) 100%)',
        }}
      />
    </AbsoluteFill>
  </AbsoluteFill>
);

const Center: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill
    style={{justifyContent: 'center', alignItems: 'center', padding: 90, textAlign: 'center'}}
  >
    {children}
  </AbsoluteFill>
);

const GoldLine: React.FC<{delay?: number}> = ({delay = 0}) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame - delay, [0, 25], [0, 320], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <div style={{width: w, height: 3, backgroundColor: C.gold, margin: '40px auto'}} />;
};

export const Marigold: React.FC<WeddingProps> = (props) => {
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
    <AbsoluteFill style={{backgroundColor: C.bg, fontFamily: montserrat}}>
      {props.musicUrl ? <Audio src={props.musicUrl} volume={musicVolume} /> : null}
      <Petals />

      <Sequence durationInFrames={plan.intro}>
        <SectionFade duration={plan.intro}>
          {photos.length > 0 ? <IntroBackdrop src={photos[0]} /> : null}
          <Center>
            <FadeUp>
              <div style={{fontSize: 34, letterSpacing: 12, textTransform: 'uppercase', color: C.rust}}>
                Together with their families
              </div>
            </FadeUp>
            <GoldLine delay={8} />
            <FadeUp delay={12}>
              <div style={{fontFamily: playfair, fontSize: 128, color: C.dark, fontWeight: 700, lineHeight: 1.1}}>
                {props.couple.partnerOne}
              </div>
            </FadeUp>
            <FadeUp delay={20}>
              <div style={{fontFamily: playfair, fontSize: 72, color: C.gold, fontStyle: 'italic', margin: '20px 0'}}>
                &amp;
              </div>
            </FadeUp>
            <FadeUp delay={28}>
              <div style={{fontFamily: playfair, fontSize: 128, color: C.dark, fontWeight: 700, lineHeight: 1.1}}>
                {props.couple.partnerTwo}
              </div>
            </FadeUp>
          </Center>
        </SectionFade>
      </Sequence>

      <Sequence from={plan.intro} durationInFrames={plan.message}>
        <SectionFade duration={plan.message}>
          <Center>
            <FadeUp>
              <div style={{fontSize: 120, color: C.gold, fontFamily: playfair}}>&ldquo;</div>
              <div style={{fontFamily: playfair, fontSize: 58, color: C.dark, lineHeight: 1.5, maxWidth: 850, fontStyle: 'italic'}}>
                {props.message || 'Two hearts, one beautiful journey.'}
              </div>
            </FadeUp>
            <GoldLine delay={15} />
          </Center>
        </SectionFade>
      </Sequence>

      <Sequence from={plan.intro + plan.message} durationInFrames={plan.photos}>
        <SectionFade duration={plan.photos}>
          {photos.length === 0 ? (
            <Center>
              <FadeUp>
                <div style={{fontFamily: playfair, fontSize: 200, color: C.gold}}>
                  {props.couple.partnerOne.charAt(0)}
                  <span style={{color: C.rust}}> · </span>
                  {props.couple.partnerTwo.charAt(0)}
                </div>
              </FadeUp>
            </Center>
          ) : (
            <PhotoSlideshow photos={photos} duration={plan.photos} />
          )}
        </SectionFade>
      </Sequence>

      <Sequence from={plan.intro + plan.message + plan.photos} durationInFrames={plan.schedule}>
        <SectionFade duration={plan.schedule}>
          <Center>
            <FadeUp>
              <div style={{fontSize: 34, letterSpacing: 12, textTransform: 'uppercase', color: C.rust, marginBottom: 60}}>
                Celebrations
              </div>
            </FadeUp>
            {schedule.map((item, i) => (
              <FadeUp key={i} delay={8 + i * 8}>
                <div style={{display: 'flex', alignItems: 'baseline', gap: 40, margin: '28px 0'}}>
                  <span style={{fontFamily: playfair, fontSize: 72, color: C.dark, fontWeight: 600}}>{item.name}</span>
                  <span style={{fontSize: 40, color: C.orange, letterSpacing: 3}}>{item.time}</span>
                </div>
              </FadeUp>
            ))}
          </Center>
        </SectionFade>
      </Sequence>

      <Sequence from={durationInFrames - plan.finale} durationInFrames={plan.finale}>
        <SectionFade duration={plan.finale}>
          <Center>
            <FadeUp>
              <div style={{fontSize: 36, letterSpacing: 14, textTransform: 'uppercase', color: C.rust}}>
                Save the Date
              </div>
            </FadeUp>
            <GoldLine delay={8} />
            <FadeUp delay={12}>
              <div style={{fontFamily: playfair, fontSize: 96, color: C.dark, fontWeight: 700}}>{props.eventDate}</div>
            </FadeUp>
            <FadeUp delay={22}>
              <div style={{fontSize: 44, color: C.orange, marginTop: 50, letterSpacing: 3}}>{props.venue.name}</div>
              <div style={{fontSize: 36, color: C.sage, marginTop: 16, letterSpacing: 6, textTransform: 'uppercase'}}>
                {props.venue.city}
              </div>
            </FadeUp>
          </Center>
        </SectionFade>
      </Sequence>
    </AbsoluteFill>
  );
};

const PhotoSlideshow: React.FC<{photos: string[]; duration: number}> = ({photos, duration}) => {
  const per = Math.floor(duration / photos.length);
  return (
    <AbsoluteFill>
      {photos.map((src, i) => (
        <Sequence key={i} from={i * per} durationInFrames={i === photos.length - 1 ? duration - i * per : per}>
          <KenBurns src={src} duration={per} index={i} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const KenBurns: React.FC<{src: string; duration: number; index: number}> = ({src, duration, index}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, duration], [1.02, 1.16]);
  const pan = interpolate(frame, [0, duration], [0, index % 2 === 0 ? -30 : 30]);
  const edge = Math.max(1, Math.min(10, Math.floor(duration / 2) - 1));
  const opacity = interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity}}>
      <div
        style={{
          width: 840,
          height: 1200,
          overflow: 'hidden',
          borderRadius: 24,
          border: `6px solid ${C.gold}`,
          boxShadow: '0 40px 80px rgba(74,37,69,0.25)',
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
