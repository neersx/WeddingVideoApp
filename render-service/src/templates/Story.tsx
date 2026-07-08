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
import {loadFont as loadArchivo} from '@remotion/google-fonts/ArchivoBlack';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {WeddingProps} from './types';

const {fontFamily: cormorant} = loadCormorant();
const {fontFamily: archivo} = loadArchivo();
const {fontFamily: inter} = loadInter();

const C = {
  sage: '#7A9B76',
  sageDeep: '#4A6B48',
  ivory: '#F4EFE6',
  ink: '#1F1F1F',
  brass: '#A67B39',
  brassLight: '#D4B87A',
};

const FadeIn: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  delay = 0,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - delay, fps, config: {damping: 200}});
  return <div style={{opacity: p, transform: `translateY(${(1 - p) * 30}px)`, ...style}}>{children}</div>;
};

const SlideInLeft: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  delay = 0,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - delay, fps, config: {damping: 180}});
  return <div style={{opacity: p, transform: `translateX(${(1 - p) * -120}px)`, ...style}}>{children}</div>;
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

const AbsSlide: React.FC<{children: React.ReactNode; bg?: string}> = ({children, bg}) => (
  <AbsoluteFill style={{backgroundColor: bg || C.ivory}}>{children}</AbsoluteFill>
);

// 5 chapters: primary photo + names 20%, date reveal photo 20%, place + message 22%, events 20%, invitation 18%
const plan = (df: number) => {
  const primary = Math.round(df * 0.2);
  const date = Math.round(df * 0.2);
  const place = Math.round(df * 0.22);
  const events = Math.round(df * 0.2);
  const finale = df - primary - date - place - events;
  return {primary, date, place, events, finale};
};

const FullBleedPhoto: React.FC<{src?: string; duration: number; fallbackBg: string}> = ({
  src,
  duration,
  fallbackBg,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, duration], [1.05, 1.16]);
  return (
    <AbsoluteFill style={{backgroundColor: fallbackBg}}>
      {src ? (
        <Img
          src={src}
          pauseWhenLoading
          style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`}}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(31,31,31,0.4) 0%, rgba(31,31,31,0.1) 40%, rgba(31,31,31,0.85) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

export const Story: React.FC<WeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const p = plan(durationInFrames);
  const photos = (props.photos ?? []).slice(0, 6);
  const [p1, p2, p3] = [photos[0], photos[1] ?? photos[0], photos[2] ?? photos[0]];
  const schedule = props.schedule ?? [];
  const frame = useCurrentFrame();
  const musicVolume = interpolate(
    frame,
    [0, fps, durationInFrames - 2 * fps, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );

  return (
    <AbsoluteFill style={{backgroundColor: C.ivory, fontFamily: inter}}>
      {props.musicUrl ? <Audio src={props.musicUrl} volume={musicVolume} /> : null}

      {/* Chapter 1: Primary photo + wedding announcement */}
      <Sequence durationInFrames={p.primary}>
        <SectionFade duration={p.primary}>
          <AbsSlide bg={C.sageDeep}>
            <FullBleedPhoto src={p1} duration={p.primary} fallbackBg={C.sageDeep} />
            <AbsoluteFill style={{justifyContent: 'flex-end', padding: 90, alignItems: 'flex-start'}}>
              <SlideInLeft>
                <div
                  style={{
                    fontSize: 22,
                    letterSpacing: 14,
                    textTransform: 'uppercase',
                    color: C.brassLight,
                    marginBottom: 30,
                    fontFamily: inter,
                    fontWeight: 500,
                  }}
                >
                  The Wedding Of
                </div>
              </SlideInLeft>
              <SlideInLeft delay={10}>
                <div
                  style={{
                    fontFamily: cormorant,
                    fontSize: 130,
                    color: C.ivory,
                    lineHeight: 1,
                    fontWeight: 700,
                    letterSpacing: -2,
                  }}
                >
                  {props.couple.partnerOne}
                </div>
              </SlideInLeft>
              <SlideInLeft delay={16}>
                <div
                  style={{
                    fontFamily: cormorant,
                    fontSize: 60,
                    color: C.brassLight,
                    fontStyle: 'italic',
                    margin: '4px 0',
                  }}
                >
                  and
                </div>
              </SlideInLeft>
              <SlideInLeft delay={22}>
                <div
                  style={{
                    fontFamily: cormorant,
                    fontSize: 130,
                    color: C.ivory,
                    lineHeight: 1,
                    fontWeight: 700,
                    letterSpacing: -2,
                    marginBottom: 40,
                  }}
                >
                  {props.couple.partnerTwo}
                </div>
              </SlideInLeft>
            </AbsoluteFill>
          </AbsSlide>
        </SectionFade>
      </Sequence>

      {/* Chapter 2: Photo + huge bold DATE overlay */}
      <Sequence from={p.primary} durationInFrames={p.date}>
        <SectionFade duration={p.date}>
          <AbsSlide bg={C.ink}>
            <FullBleedPhoto src={p2} duration={p.date} fallbackBg={C.ink} />
            <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: 60}}>
              <FadeIn>
                <div
                  style={{
                    fontSize: 26,
                    letterSpacing: 20,
                    textTransform: 'uppercase',
                    color: C.brassLight,
                    marginBottom: 30,
                  }}
                >
                  Save The Date
                </div>
              </FadeIn>
              <FadeIn delay={10}>
                <div
                  style={{
                    fontFamily: archivo,
                    fontSize: 140,
                    color: C.ivory,
                    lineHeight: 0.95,
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: -3,
                    textShadow: '0 6px 40px rgba(0,0,0,0.6)',
                  }}
                >
                  {props.eventDate}
                </div>
              </FadeIn>
              <FadeIn delay={22}>
                <div style={{width: 240, height: 4, backgroundColor: C.brass, margin: '48px auto'}} />
              </FadeIn>
              <FadeIn delay={28}>
                <div style={{fontFamily: cormorant, fontSize: 42, color: C.ivory, fontStyle: 'italic'}}>
                  {props.couple.partnerOne} &amp; {props.couple.partnerTwo}
                </div>
              </FadeIn>
            </AbsoluteFill>
          </AbsSlide>
        </SectionFade>
      </Sequence>

      {/* Chapter 3: Place + message */}
      <Sequence from={p.primary + p.date} durationInFrames={p.place}>
        <SectionFade duration={p.place}>
          <AbsSlide bg={C.sage}>
            <FullBleedPhoto src={p3} duration={p.place} fallbackBg={C.sage} />
            <AbsoluteFill
              style={{justifyContent: 'center', alignItems: 'center', padding: 80, textAlign: 'center'}}
            >
              <FadeIn>
                <div
                  style={{
                    fontSize: 24,
                    letterSpacing: 14,
                    textTransform: 'uppercase',
                    color: C.brassLight,
                    marginBottom: 24,
                  }}
                >
                  The Venue
                </div>
              </FadeIn>
              <FadeIn delay={8}>
                <div
                  style={{
                    fontFamily: cormorant,
                    fontSize: 108,
                    color: C.ivory,
                    lineHeight: 1.05,
                    fontWeight: 700,
                  }}
                >
                  {props.venue.name}
                </div>
              </FadeIn>
              <FadeIn delay={18}>
                <div
                  style={{
                    fontSize: 34,
                    color: C.brassLight,
                    letterSpacing: 8,
                    textTransform: 'uppercase',
                    marginTop: 12,
                    marginBottom: 40,
                  }}
                >
                  {props.venue.city}
                </div>
              </FadeIn>
              <FadeIn delay={28}>
                <div
                  style={{
                    fontFamily: cormorant,
                    fontStyle: 'italic',
                    fontSize: 42,
                    color: C.ivory,
                    maxWidth: 820,
                    lineHeight: 1.4,
                    opacity: 0.95,
                  }}
                >
                  {props.message || 'A place chosen with love, where our story begins.'}
                </div>
              </FadeIn>
            </AbsoluteFill>
          </AbsSlide>
        </SectionFade>
      </Sequence>

      {/* Chapter 4: Events timeline */}
      <Sequence from={p.primary + p.date + p.place} durationInFrames={p.events}>
        <SectionFade duration={p.events}>
          <AbsoluteFill style={{backgroundColor: C.ivory, padding: 90}}>
            <FadeIn>
              <div
                style={{
                  fontSize: 24,
                  letterSpacing: 14,
                  textTransform: 'uppercase',
                  color: C.brass,
                  marginBottom: 20,
                }}
              >
                The Celebrations
              </div>
            </FadeIn>
            <FadeIn delay={6}>
              <div style={{width: 180, height: 4, backgroundColor: C.brass, marginBottom: 50}} />
            </FadeIn>
            {schedule.slice(0, 4).map((item, i) => (
              <FadeIn key={i} delay={12 + i * 8}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    padding: '26px 0',
                    borderBottom: `1px solid rgba(31,31,31,0.15)`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: cormorant,
                      fontSize: 68,
                      color: C.ink,
                      fontWeight: 700,
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}. {item.name}
                  </div>
                  <div
                    style={{
                      fontFamily: archivo,
                      fontSize: 36,
                      color: C.brass,
                      letterSpacing: 2,
                    }}
                  >
                    {item.time}
                  </div>
                </div>
              </FadeIn>
            ))}
          </AbsoluteFill>
        </SectionFade>
      </Sequence>

      {/* Chapter 5: Invitation */}
      <Sequence from={p.primary + p.date + p.place + p.events} durationInFrames={p.finale}>
        <SectionFade duration={p.finale}>
          <AbsoluteFill
            style={{
              backgroundColor: C.ink,
              justifyContent: 'center',
              alignItems: 'center',
              padding: 90,
              textAlign: 'center',
            }}
          >
            <FadeIn>
              <div
                style={{
                  fontSize: 22,
                  letterSpacing: 18,
                  textTransform: 'uppercase',
                  color: C.brassLight,
                  marginBottom: 40,
                }}
              >
                We Invite You
              </div>
            </FadeIn>
            <FadeIn delay={8}>
              <div
                style={{
                  fontFamily: cormorant,
                  fontStyle: 'italic',
                  fontSize: 58,
                  color: C.ivory,
                  maxWidth: 880,
                  lineHeight: 1.35,
                }}
              >
                Together with our families, we joyfully request the honour of your presence
              </div>
            </FadeIn>
            <FadeIn delay={22}>
              <div style={{width: 240, height: 4, backgroundColor: C.brass, margin: '48px auto'}} />
            </FadeIn>
            <FadeIn delay={26}>
              <div
                style={{
                  fontFamily: cormorant,
                  fontSize: 96,
                  color: C.ivory,
                  fontWeight: 700,
                  lineHeight: 1.05,
                }}
              >
                {props.couple.partnerOne} &amp; {props.couple.partnerTwo}
              </div>
            </FadeIn>
          </AbsoluteFill>
        </SectionFade>
      </Sequence>
    </AbsoluteFill>
  );
};
