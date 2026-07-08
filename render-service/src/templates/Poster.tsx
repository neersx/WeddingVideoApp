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
import {loadFont as loadArchivo} from '@remotion/google-fonts/ArchivoBlack';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {WeddingProps} from './types';

const {fontFamily: archivo} = loadArchivo();
const {fontFamily: inter} = loadInter();
const {fontFamily: playfair} = loadPlayfair();

const C = {
  bg: '#F2EEE5',
  ink: '#0A0A0A',
  red: '#E63946',
  yellow: '#F4C542',
  blue: '#264653',
  mute: '#7C7566',
};

const FadeIn: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  delay = 0,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - delay, fps, config: {damping: 200}});
  return <div style={{opacity: p, transform: `translateY(${(1 - p) * 40}px)`, ...style}}>{children}</div>;
};

const ScaleIn: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  delay = 0,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - delay, fps, config: {damping: 220}});
  return (
    <div style={{opacity: p, transform: `scale(${0.6 + p * 0.4})`, ...style}}>{children}</div>
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

// Sections: monogram intro 18%, photo mosaic 32%, events 22%, message 14%, invitation 14%
const plan = (df: number) => {
  const intro = Math.round(df * 0.18);
  const photos = Math.round(df * 0.32);
  const events = Math.round(df * 0.22);
  const message = Math.round(df * 0.14);
  const finale = df - intro - photos - events - message;
  return {intro, photos, events, message, finale};
};

const GeoShapes: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rot1 = frame * 0.4;
  const rot2 = frame * -0.3;
  const p1 = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{overflow: 'hidden', opacity: p1}}>
      <div
        style={{
          position: 'absolute',
          top: -100,
          right: -160,
          width: 460,
          height: 460,
          borderRadius: '50%',
          backgroundColor: C.yellow,
          transform: `rotate(${rot1}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -180,
          left: -140,
          width: 500,
          height: 500,
          backgroundColor: C.red,
          transform: `rotate(${rot2}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 220,
          left: -80,
          width: 180,
          height: 180,
          backgroundColor: C.blue,
          transform: `rotate(${rot1 * 0.6}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 400,
          right: 80,
          width: 60,
          height: 320,
          backgroundColor: C.ink,
          transform: `rotate(${rot2 * 0.7}deg)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Poster: React.FC<WeddingProps> = (props) => {
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

  const initials = `${props.couple.partnerOne.charAt(0)}${props.couple.partnerTwo.charAt(0)}`.toUpperCase();

  return (
    <AbsoluteFill style={{backgroundColor: C.bg, fontFamily: inter}}>
      {props.musicUrl ? <Audio src={props.musicUrl} volume={musicVolume} /> : null}

      {/* Chapter 1: Geometric monogram intro */}
      <Sequence durationInFrames={p.intro}>
        <SectionFade duration={p.intro}>
          <AbsoluteFill style={{backgroundColor: C.bg}}>
            <GeoShapes />
            <AbsoluteFill
              style={{justifyContent: 'center', alignItems: 'center', padding: 80, textAlign: 'center'}}
            >
              <ScaleIn>
                <div
                  style={{
                    width: 460,
                    height: 460,
                    borderRadius: '50%',
                    backgroundColor: C.ink,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    boxShadow: '20px 20px 0 ' + C.red,
                  }}
                >
                  <div
                    style={{
                      fontFamily: archivo,
                      fontSize: 260,
                      color: C.bg,
                      lineHeight: 1,
                      letterSpacing: -6,
                    }}
                  >
                    {initials}
                  </div>
                </div>
              </ScaleIn>
              <FadeIn delay={18}>
                <div
                  style={{
                    marginTop: 60,
                    fontFamily: archivo,
                    fontSize: 72,
                    color: C.ink,
                    lineHeight: 1.05,
                    textTransform: 'uppercase',
                    letterSpacing: -1,
                  }}
                >
                  {props.couple.partnerOne}
                  <br />
                  &amp; {props.couple.partnerTwo}
                </div>
              </FadeIn>
              <FadeIn delay={28}>
                <div
                  style={{
                    marginTop: 32,
                    padding: '10px 24px',
                    backgroundColor: C.red,
                    color: C.bg,
                    fontSize: 22,
                    letterSpacing: 8,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  You're Invited
                </div>
              </FadeIn>
            </AbsoluteFill>
          </AbsoluteFill>
        </SectionFade>
      </Sequence>

      {/* Chapter 2: Photo mosaic with strong grid lines */}
      <Sequence from={p.intro} durationInFrames={p.photos}>
        <SectionFade duration={p.photos}>
          <PhotoMosaic photos={photos} initials={initials} />
        </SectionFade>
      </Sequence>

      {/* Chapter 3: Events */}
      <Sequence from={p.intro + p.photos} durationInFrames={p.events}>
        <SectionFade duration={p.events}>
          <AbsoluteFill style={{backgroundColor: C.ink, padding: 80}}>
            <FadeIn>
              <div
                style={{
                  fontFamily: archivo,
                  fontSize: 90,
                  color: C.bg,
                  textTransform: 'uppercase',
                  lineHeight: 0.95,
                  letterSpacing: -2,
                }}
              >
                The
                <br />
                Program
              </div>
            </FadeIn>
            <FadeIn delay={8}>
              <div style={{width: 120, height: 6, backgroundColor: C.red, margin: '30px 0 50px'}} />
            </FadeIn>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24}}>
              {schedule.slice(0, 4).map((item, i) => (
                <FadeIn key={i} delay={14 + i * 6}>
                  <div
                    style={{
                      backgroundColor: i % 2 === 0 ? C.yellow : C.red,
                      color: i % 2 === 0 ? C.ink : C.bg,
                      padding: 30,
                      minHeight: 200,
                    }}
                  >
                    <div style={{fontSize: 20, letterSpacing: 8, textTransform: 'uppercase', opacity: 0.7}}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div
                      style={{
                        fontFamily: archivo,
                        fontSize: 52,
                        lineHeight: 1,
                        marginTop: 16,
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{fontSize: 30, marginTop: 20, fontWeight: 700}}>{item.time}</div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </AbsoluteFill>
        </SectionFade>
      </Sequence>

      {/* Chapter 4: Message */}
      <Sequence from={p.intro + p.photos + p.events} durationInFrames={p.message}>
        <SectionFade duration={p.message}>
          <AbsoluteFill
            style={{
              backgroundColor: C.red,
              padding: 100,
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <FadeIn>
              <div style={{fontFamily: playfair, fontSize: 160, color: C.bg, lineHeight: 0.9}}>&ldquo;</div>
            </FadeIn>
            <FadeIn delay={8}>
              <div
                style={{
                  fontFamily: playfair,
                  fontSize: 62,
                  color: C.bg,
                  fontStyle: 'italic',
                  maxWidth: 860,
                  lineHeight: 1.35,
                  fontWeight: 500,
                }}
              >
                {props.message || 'Two hearts, one bold new chapter.'}
              </div>
            </FadeIn>
          </AbsoluteFill>
        </SectionFade>
      </Sequence>

      {/* Chapter 5: Save the date poster */}
      <Sequence from={p.intro + p.photos + p.events + p.message} durationInFrames={p.finale}>
        <SectionFade duration={p.finale}>
          <AbsoluteFill style={{backgroundColor: C.bg, padding: 80}}>
            <GeoShapes />
            <AbsoluteFill
              style={{justifyContent: 'center', alignItems: 'center', padding: 80, textAlign: 'center'}}
            >
              <FadeIn>
                <div
                  style={{
                    fontFamily: archivo,
                    fontSize: 40,
                    color: C.ink,
                    letterSpacing: 12,
                    textTransform: 'uppercase',
                  }}
                >
                  Save The Date
                </div>
              </FadeIn>
              <FadeIn delay={8}>
                <div
                  style={{
                    fontFamily: archivo,
                    fontSize: 150,
                    color: C.ink,
                    lineHeight: 1,
                    letterSpacing: -3,
                    marginTop: 30,
                    textTransform: 'uppercase',
                    textShadow: `10px 10px 0 ${C.red}`,
                  }}
                >
                  {props.eventDate}
                </div>
              </FadeIn>
              <FadeIn delay={20}>
                <div
                  style={{
                    marginTop: 60,
                    fontFamily: archivo,
                    fontSize: 46,
                    color: C.blue,
                    textTransform: 'uppercase',
                  }}
                >
                  {props.venue.name}
                </div>
                <div
                  style={{
                    fontSize: 24,
                    color: C.ink,
                    letterSpacing: 8,
                    textTransform: 'uppercase',
                    marginTop: 12,
                  }}
                >
                  {props.venue.city}
                </div>
              </FadeIn>
            </AbsoluteFill>
          </AbsoluteFill>
        </SectionFade>
      </Sequence>
    </AbsoluteFill>
  );
};

const PhotoMosaic: React.FC<{photos: string[]; initials: string}> = ({photos, initials}) => {
  if (photos.length === 0) {
    return (
      <AbsoluteFill style={{backgroundColor: C.yellow, justifyContent: 'center', alignItems: 'center'}}>
        <div
          style={{
            fontFamily: archivo,
            fontSize: 500,
            color: C.ink,
            letterSpacing: -20,
            textTransform: 'uppercase',
          }}
        >
          {initials}
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{padding: 24, backgroundColor: C.ink}}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: `1fr ${photos.length > 3 ? '1fr 1fr' : '1fr'}`,
          gap: 20,
          width: '100%',
          height: '100%',
        }}
      >
        {photos.slice(0, 5).map((src, i) => (
          <MosaicCell key={i} src={src} index={i} total={photos.length} />
        ))}
        <div
          style={{
            backgroundColor: C.red,
            color: C.bg,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: archivo,
            fontSize: 240,
            letterSpacing: -8,
            textTransform: 'uppercase',
          }}
        >
          {initials}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const MosaicCell: React.FC<{src: string; index: number; total: number}> = ({src, index}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - index * 4, fps, config: {damping: 220}});
  const scale = 1.02 + (frame / 300) * 0.05;
  return (
    <div style={{overflow: 'hidden', opacity: p, transform: `scale(${p})`}}>
      <Img
        src={src}
        pauseWhenLoading
        style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`}}
      />
    </div>
  );
};
