import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadOutfit} from '@remotion/google-fonts/Outfit';
import {WeddingProps, ResolvedCopy} from './types';
import {BrandOutro} from './BrandOutro';
import {planHeartfeltTiming} from './heartfeltTiming';

const {fontFamily: serif} = loadCormorant();
const {fontFamily: sans} = loadOutfit();

// Warm, emotional palette — soft cinematic, no party colours.
const C = {ink: '#160A0F', cream: '#FFF7EA', rose: '#D98774', wine: '#5E1A2E', amber: '#F1B56B', glow: '#FFD9A8'};

// Resolve copy with graceful fallbacks so no scene is ever blank. There are no
// separate opening/closing message fields any more — the first and last image
// messages ARE the opening and closing text (see the scene roles below).
const useCopy = (props: WeddingProps) => {
  const r: ResolvedCopy = props.resolved || {};
  const celebrant = r.celebrantName || props.couple?.partnerOne || 'You';
  const sender = r.senderName || '';
  const recipientTerm = r.recipientTerm || '';
  const occasionLabel = r.occasionLabel || '';
  const fallbacks = [
    `To my ${recipientTerm || 'favourite person'}…`,
    'every moment with you is a gift.',
    'You make ordinary days feel golden.',
    'Thank you for being exactly you.',
    'With all my heart, always.',
  ];
  const photoMessages = r.photoMessages && r.photoMessages.length ? r.photoMessages : fallbacks;
  const eyebrow = [occasionLabel, recipientTerm ? `For my ${recipientTerm}` : '']
    .filter(Boolean)
    .join('  ·  ');
  return {celebrant, sender, recipientTerm, occasionLabel, photoMessages, eyebrow};
};

// ---------- Reusable motion primitives ----------

// Gentle fade + slight upward reveal.
const Reveal: React.FC<{children: React.ReactNode; from?: number; dur?: number; y?: number; style?: React.CSSProperties}> = ({children, from = 0, dur = 26, y = 26, style}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - from, [0, dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ty = interpolate(frame - from, [0, dur], [y, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <div style={{opacity, transform: `translateY(${ty}px)`, ...style}}>{children}</div>;
};

// Full-screen slow Ken Burns move; alternates zoom/pan per index so repeated
// crops never feel identical.
const KenBurns: React.FC<{src?: string; index: number; dur: number}> = ({src, index, dur}) => {
  const frame = useCurrentFrame();
  const zoomIn = index % 2 === 0;
  const scale = interpolate(frame, [0, dur], zoomIn ? [1.03, 1.15] : [1.15, 1.03], {extrapolateRight: 'clamp'});
  const px = interpolate(frame, [0, dur], [index % 2 ? 20 : -20, index % 2 ? -20 : 20], {extrapolateRight: 'clamp'});
  const py = interpolate(frame, [0, dur], [12, -12], {extrapolateRight: 'clamp'});
  if (!src) {
    return (
      <AbsoluteFill style={{background: `linear-gradient(160deg, ${C.wine}, ${C.ink})`, alignItems: 'center', justifyContent: 'center', color: C.amber, fontFamily: serif, fontSize: 180}}>
        {index + 1}
      </AbsoluteFill>
    );
  }
  return (
    <Img
      src={src}
      pauseWhenLoading
      style={{position: 'absolute', inset: '-7%', width: '114%', height: '114%', objectFit: 'cover', transform: `scale(${scale}) translate(${px}px, ${py}px)`, filter: 'saturate(.95) brightness(.9) contrast(1.03)'}}
    />
  );
};

// Warm readability overlay: bottom gradient for lower-third text + soft vignette.
const WarmOverlay: React.FC = () => (
  <>
    <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(22,10,15,.34) 0%, rgba(22,10,15,0) 26%, rgba(22,10,15,0) 44%, rgba(22,10,15,.82) 100%)'}} />
    <AbsoluteFill style={{background: 'radial-gradient(120% 80% at 50% 42%, rgba(0,0,0,0) 50%, rgba(20,7,12,.55) 100%)'}} />
    <AbsoluteFill style={{background: 'radial-gradient(60% 40% at 26% 20%, rgba(255,217,168,.16), transparent 70%)', mixBlendMode: 'screen'}} />
  </>
);

// Very subtle, slow light-leak sweep (no particles).
const LightLeak: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const x = interpolate(frame, [0, durationInFrames], [-20, 30]);
  const opacity = interpolate(frame, [0, durationInFrames * 0.5, durationInFrames], [0.05, 0.16, 0.05]);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity, mixBlendMode: 'screen', background: `radial-gradient(40% 55% at ${50 + x}% 30%, rgba(255,196,140,.9), transparent 60%)`}} />
  );
};

// ---------- Message card ----------
// Every message sits in a legible, softly-lit panel so text stays comfortable
// over any photo. Opening and closing slides use the large, centred emphasis;
// middle slides use a smaller lower-third card.

type Role = 'opening' | 'middle' | 'closing';

const MessageCard: React.FC<{
  text: string;
  role: Role;
  from: number;
  eyebrow?: string;
  signature?: string;
  signatureFrom?: number;
}> = ({text, role, from, eyebrow, signature, signatureFrom = from + 20}) => {
  const frame = useCurrentFrame();
  const emphasis = role !== 'middle';
  const fontSize = emphasis ? 96 : 74;

  const wrapper: React.CSSProperties = emphasis
    ? {position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 96px'}
    : {position: 'absolute', left: 0, right: 0, bottom: 220, display: 'flex', justifyContent: 'center', padding: '0 84px'};

  const sigOpacity = interpolate(frame - signatureFrom, [0, 18], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <div style={wrapper}>
      <Reveal from={from} y={emphasis ? 30 : 22} style={{maxWidth: 900, textAlign: 'center'}}>
        <div
          style={{
            position: 'relative',
            padding: emphasis ? '56px 64px 52px' : '38px 52px',
            borderRadius: 40,
            background: 'linear-gradient(180deg, rgba(30,12,18,.60) 0%, rgba(18,8,12,.74) 100%)',
            border: '1px solid rgba(255,217,168,.26)',
            boxShadow: '0 26px 70px rgba(0,0,0,.45)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Gold accent bar — the "highlight" that lifts the card off the photo. */}
          <div style={{width: emphasis ? 92 : 66, height: 3, margin: '0 auto 22px', borderRadius: 3, background: `linear-gradient(90deg, transparent, ${C.glow}, ${C.amber}, transparent)`}} />

          {eyebrow ? (
            <div style={{marginBottom: 18, color: C.glow, fontFamily: sans, fontWeight: 700, fontSize: 32, letterSpacing: 6, textTransform: 'uppercase', textShadow: '0 2px 14px rgba(0,0,0,.6)'}}>
              {eyebrow}
            </div>
          ) : null}

          <div
            style={{
              fontFamily: serif,
              fontWeight: 700,
              fontStyle: 'italic',
              fontSize,
              lineHeight: 1.2,
              color: C.cream,
              textShadow: '0 4px 26px rgba(0,0,0,.6)',
            }}
          >
            {text}
          </div>

          {signature ? (
            <div style={{marginTop: 30, opacity: sigOpacity, fontFamily: sans, fontWeight: 700, fontSize: 34, letterSpacing: 1, color: C.glow, textShadow: '0 3px 16px rgba(0,0,0,.55)'}}>
              {signature}
            </div>
          ) : null}
        </div>
      </Reveal>
    </div>
  );
};

// ---------- Scene ----------

type SceneProps = {
  src?: string;
  message: string;
  index: number;
  dur: number;
  trans: number;
  role: Role;
  eyebrow?: string;
  signature?: string;
};

const PhotoScene: React.FC<SceneProps> = ({src, message, index, dur, trans, role, eyebrow, signature}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // Crossfade: fade the whole scene in and out over `trans` frames.
  const sceneOpacity = interpolate(frame, [0, trans, dur - trans, dur], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // Let the photo breathe for a beat before the words rise in.
  const cardFrom = Math.max(trans + 2, Math.min(Math.round(fps * 0.7), Math.floor(dur * 0.24)));

  return (
    <AbsoluteFill style={{opacity: sceneOpacity}}>
      <AbsoluteFill style={{background: C.ink}}>
        <KenBurns src={src} index={index} dur={dur} />
      </AbsoluteFill>
      <WarmOverlay />
      <LightLeak />
      <MessageCard text={message} role={role} from={cardFrom} eyebrow={eyebrow} signature={signature} signatureFrom={cardFrom + 26} />
    </AbsoluteFill>
  );
};

// The closing branding screen is shared across every template — see BrandOutro.tsx.

// Subtle, non-intrusive branding shown across the photo scenes only.
const BrandFooter: React.FC<{visibleUntil: number}> = ({visibleUntil}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = interpolate(frame, [fps, fps * 1.6, visibleUntil - fps, visibleUntil], [0, 0.62, 0.62, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', bottom: 70, left: 0, right: 0, textAlign: 'center', opacity, zIndex: 30}}>
      <span style={{fontFamily: sans, fontSize: 27, letterSpacing: 4, color: 'rgba(255,247,234,.9)', textShadow: '0 2px 14px rgba(0,0,0,.6)'}}>InvitaVideos.com</span>
    </div>
  );
};

export const FromMyHeart: React.FC<WeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const copy = useCopy(props);
  const photos = props.photos || [];
  const maxSlides = Number(props.settings?.maxSlides) || 5;

  // One scene per uploaded image (capped by maxSlides). Every image carries its
  // own message; the first and last are the opening and closing.
  const photoCount = Math.max(1, Math.min(photos.length || copy.photoMessages.length, maxSlides));

  // Reserve a branded outro (~15% of runtime, 2–5s); the photo slides fill the
  // rest. The opening and closing slides run ~4s (never under 3.5s while runtime
  // allows), middle slides 2.5–3.5s. See heartfeltTiming.ts.
  const trans = Math.round(fps * 0.4);
  const {slides, photoTotal} = planHeartfeltTiming({durationInFrames, fps, photoCount});

  const musicVolume = interpolate(
    frame,
    [0, fps, Math.max(fps, durationInFrames - fps), durationInFrames],
    [0, 0.9, 0.9, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  return (
    <AbsoluteFill style={{background: C.ink, fontFamily: sans}}>
      {props.musicUrl ? <Audio src={props.musicUrl} volume={musicVolume} /> : null}

      {Array.from({length: photoCount}).map((_, i) => {
        const isFirst = i === 0;
        const isLast = i === photoCount - 1;
        const role: Role = isFirst ? 'opening' : isLast ? 'closing' : 'middle';
        const {from, dur: base} = slides[i];
        // Overlap into the next scene (or the outro) by `trans`.
        const dur = base + trans;
        const message = copy.photoMessages[i] || copy.photoMessages[copy.photoMessages.length - 1] || '';
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <PhotoScene
              src={photos[i]}
              message={message}
              index={i}
              dur={dur}
              trans={trans}
              role={role}
              eyebrow={isFirst ? copy.eyebrow : undefined}
              signature={isLast && copy.sender ? `With love, ${copy.sender}` : undefined}
            />
          </Sequence>
        );
      })}

      <BrandFooter visibleUntil={photoTotal} />

      <Sequence from={photoTotal} durationInFrames={durationInFrames - photoTotal}>
        <BrandOutro durationInFrames={durationInFrames - photoTotal} />
      </Sequence>
    </AbsoluteFill>
  );
};
