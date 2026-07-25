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

// Soft rose-gold / blush palette — warmer and gentler than From My Heart's
// deeper wine tones, so the two Heartfelt templates read as distinct choices.
const C = {
  ink: '#2A1016',
  deep: '#3B1220',
  blush: '#F3B6B0',
  roseGold: '#D98F7B',
  cream: '#FFF7F2',
  glow: '#F7D9C4',
};

// Resolve copy with graceful fallbacks so no scene is ever blank. There are no
// separate opening/closing message fields any more — the first and last image
// messages ARE the opening and closing text.
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
  const eyebrow = [occasionLabel, recipientTerm ? `For my ${recipientTerm}` : ''].filter(Boolean).join('  ·  ');
  return {celebrant, sender, recipientTerm, occasionLabel, photoMessages, eyebrow};
};

// ---------- Reusable motion primitives ----------

const RevealFade: React.FC<{children: React.ReactNode; from?: number; dur?: number; y?: number; style?: React.CSSProperties}> = ({children, from = 0, dur = 24, y = 22, style}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - from, [0, dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ty = interpolate(frame - from, [0, dur], [y, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scale = interpolate(frame - from, [0, dur], [0.97, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <div style={{opacity, transform: `translateY(${ty}px) scale(${scale})`, ...style}}>{children}</div>;
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
      <AbsoluteFill style={{background: `linear-gradient(160deg, ${C.roseGold}, ${C.ink})`, alignItems: 'center', justifyContent: 'center', color: C.glow, fontFamily: serif, fontSize: 180}}>
        {index + 1}
      </AbsoluteFill>
    );
  }
  return (
    <Img
      src={src}
      pauseWhenLoading
      style={{position: 'absolute', inset: '-7%', width: '114%', height: '114%', objectFit: 'cover', transform: `scale(${scale}) translate(${px}px, ${py}px)`, filter: 'saturate(1.04) brightness(.94) contrast(1.02)'}}
    />
  );
};

// Legibility scrim — warmed with blush light.
const WarmOverlay: React.FC<{heavyBottom?: boolean}> = ({heavyBottom}) => (
  <>
    <AbsoluteFill style={{background: `linear-gradient(180deg, rgba(42,16,22,.30) 0%, rgba(42,16,22,0) 24%, rgba(42,16,22,0) 44%, rgba(42,16,22,${heavyBottom ? 0.64 : 0.34}) 100%)`}} />
    <AbsoluteFill style={{background: 'radial-gradient(120% 75% at 50% 46%, rgba(0,0,0,0) 46%, rgba(30,10,16,.46) 100%)'}} />
    <AbsoluteFill style={{background: 'radial-gradient(55% 38% at 24% 18%, rgba(247,214,196,.18), transparent 70%)', mixBlendMode: 'screen'}} />
  </>
);

// Very subtle, slow light-leak sweep (no particles).
const LightLeak: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const x = interpolate(frame, [0, durationInFrames], [-18, 26]);
  const opacity = interpolate(frame, [0, durationInFrames * 0.5, durationInFrames], [0.05, 0.15, 0.05]);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity, mixBlendMode: 'screen', background: `radial-gradient(40% 55% at ${50 + x}% 28%, rgba(247,214,196,.9), transparent 60%)`}} />
  );
};

// ---------- Message card ----------
// Bold, highlighted text on a soft rose-gold panel so it stays comfortable over
// any photo. Placement 'center' = full-frame reveal (opening/closing + every
// other middle); 'panel' = a card resting at the bottom (the alternating middle)
// — preserving this template's "reveal then bottom panel" rhythm.

type Role = 'opening' | 'middle' | 'closing';
type Placement = 'center' | 'panel';

const MessageCard: React.FC<{
  text: string;
  emphasis: boolean;
  placement: Placement;
  from: number;
  eyebrow?: string;
  signature?: string;
  signatureFrom?: number;
}> = ({text, emphasis, placement, from, eyebrow, signature, signatureFrom = from + 22}) => {
  const frame = useCurrentFrame();
  const fontSize = emphasis ? 98 : 86;
  const isPanel = placement === 'panel';

  const wrapper: React.CSSProperties = isPanel
    ? {position: 'absolute', left: 0, right: 0, bottom: 96, display: 'flex', justifyContent: 'center', padding: '0 70px'}
    : {position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 92px'};

  const sigOpacity = interpolate(frame - signatureFrom, [0, 18], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <div style={wrapper}>
      <RevealFade from={from} y={isPanel ? 40 : 28} style={{width: isPanel ? '100%' : 'auto', maxWidth: 920, textAlign: 'center'}}>
        <div
          style={{
            position: 'relative',
            padding: emphasis ? '58px 66px 54px' : '42px 56px',
            borderRadius: 42,
            background: 'linear-gradient(180deg, rgba(59,18,32,.52) 0%, rgba(42,16,22,.72) 100%)',
            border: '1px solid rgba(247,217,196,.30)',
            boxShadow: '0 26px 68px rgba(0,0,0,.40)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Rose-gold accent bar — the highlight that lifts the card off the photo. */}
          <div style={{width: emphasis ? 96 : 70, height: 3, margin: '0 auto 22px', borderRadius: 3, background: `linear-gradient(90deg, transparent, ${C.glow}, ${C.blush}, transparent)`}} />

          {eyebrow ? (
            <div style={{marginBottom: 18, color: C.glow, fontFamily: sans, fontWeight: 700, fontSize: 32, letterSpacing: 6, textTransform: 'uppercase', textShadow: '0 2px 14px rgba(0,0,0,.55)'}}>
              {eyebrow}
            </div>
          ) : null}

          <div
            style={{
              fontFamily: serif,
              fontWeight: 700,
              fontStyle: 'italic',
              fontSize,
              lineHeight: 1.18,
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
      </RevealFade>
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
  placement: Placement;
  eyebrow?: string;
  signature?: string;
};

const Scene: React.FC<SceneProps> = ({src, message, index, dur, trans, role, placement, eyebrow, signature}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Crossfade the whole scene in/out over `trans` frames.
  const sceneOpacity = interpolate(frame, [0, trans, dur - trans, dur], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // Every screen shows its photo alone for a beat before the words rise in.
  const cardFrom = Math.max(trans + 2, Math.min(Math.round(fps * 0.9), Math.floor(dur * 0.28)));
  const emphasis = role !== 'middle';

  return (
    <AbsoluteFill style={{opacity: sceneOpacity}}>
      <AbsoluteFill style={{background: C.ink}}>
        <KenBurns src={src} index={index} dur={dur} />
      </AbsoluteFill>
      <WarmOverlay heavyBottom={placement === 'panel'} />
      <LightLeak />
      <MessageCard
        text={message}
        emphasis={emphasis}
        placement={placement}
        from={cardFrom}
        eyebrow={eyebrow}
        signature={signature}
        signatureFrom={cardFrom + 26}
      />
    </AbsoluteFill>
  );
};

// The closing branding screen is shared across every template — see BrandOutro.tsx.

// Subtle, non-intrusive branding shown across the photo scenes only.
const BrandFooter: React.FC<{visibleUntil: number}> = ({visibleUntil}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = interpolate(frame, [fps, fps * 1.6, visibleUntil - fps, visibleUntil], [0, 0.6, 0.6, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', bottom: 28, left: 0, right: 0, textAlign: 'center', opacity, zIndex: 30}}>
      <span style={{fontFamily: sans, fontSize: 26, letterSpacing: 4, color: 'rgba(255,247,242,.9)', textShadow: '0 2px 14px rgba(0,0,0,.6)'}}>InvitaVideos.com</span>
    </div>
  );
};

export const ForeverSpecial: React.FC<WeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const copy = useCopy(props);
  const photos = props.photos || [];
  const maxSlides = Number(props.settings?.maxSlides) || 5;

  // One scene per uploaded image (capped by maxSlides). Every image carries its
  // own message; the first and last are the opening and closing.
  const photoCount = Math.max(1, Math.min(photos.length || copy.photoMessages.length, maxSlides));

  // Reserve a branded outro (~15% of runtime, 2–5s); the photo slides fill the
  // rest. Opening/closing run ~4s (never under 3.5s while runtime allows), middle
  // slides 2.5–3.5s. See heartfeltTiming.ts.
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
        // Edges are always the full-frame reveal; middles alternate reveal/panel
        // so the template keeps its signature rhythm.
        const placement: Placement = role === 'middle' && i % 2 === 1 ? 'panel' : 'center';
        const {from, dur: base} = slides[i];
        const dur = base + trans;
        const message = copy.photoMessages[i] || copy.photoMessages[copy.photoMessages.length - 1] || '';
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <Scene
              src={photos[i]}
              message={message}
              index={i}
              dur={dur}
              trans={trans}
              role={role}
              placement={placement}
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
