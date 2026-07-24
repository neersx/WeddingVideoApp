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
import {ClosingMessageScene} from './ClosingMessageScene';
import {closingPhotoIndex, planHeartfeltTiming} from './heartfeltTiming';

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

// Resolve copy with graceful fallbacks so no scene is ever blank.
const useCopy = (props: WeddingProps) => {
  const r: ResolvedCopy = props.resolved || {};
  const celebrant = r.celebrantName || props.couple?.partnerOne || 'You';
  const sender = r.senderName || '';
  const recipientTerm = r.recipientTerm || '';
  const occasionLabel = r.occasionLabel || '';
  const intro = r.introMessage || (occasionLabel ? `${occasionLabel} wishes, ${celebrant}` : `Every word here is for you, ${celebrant}`);
  const final = r.finalMessage || 'Forever grateful for you.';
  const fallbacks = [
    `To my ${recipientTerm || 'favourite person'}…`,
    'every moment with you is a gift.',
    'You make ordinary days feel golden.',
    'Thank you for being exactly you.',
    'With all my heart, always.',
  ];
  const photoMessages = r.photoMessages && r.photoMessages.length ? r.photoMessages : fallbacks;
  const eyebrow = [occasionLabel, recipientTerm ? `For my ${recipientTerm}` : ''].filter(Boolean).join('  ·  ');
  return {celebrant, sender, recipientTerm, occasionLabel, intro, final, photoMessages, eyebrow};
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
      style={{position: 'absolute', inset: '-7%', width: '114%', height: '114%', objectFit: 'cover', transform: `scale(${scale}) translate(${px}px, ${py}px)`, filter: 'saturate(1.04) brightness(.97) contrast(1.02)'}}
    />
  );
};

// Legibility scrim — lighter than a full panel, warmed with blush light.
const WarmOverlay: React.FC<{heavyBottom?: boolean}> = ({heavyBottom}) => (
  <>
    <AbsoluteFill style={{background: `linear-gradient(180deg, rgba(42,16,22,.26) 0%, rgba(42,16,22,0) 24%, rgba(42,16,22,0) 44%, rgba(42,16,22,${heavyBottom ? 0.62 : 0.3}) 100%)`}} />
    <AbsoluteFill style={{background: 'radial-gradient(120% 75% at 50% 46%, rgba(0,0,0,0) 48%, rgba(30,10,16,.42) 100%)'}} />
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

const GoldRule: React.FC<{opacity?: number}> = ({opacity = 0.85}) => (
  <div style={{width: 74, height: 2, background: `linear-gradient(90deg, transparent, ${C.glow}, transparent)`, margin: '18px auto', opacity}} />
);

// ---------- Scene ----------

type SceneProps = {
  src?: string;
  caption: string;
  index: number;
  dur: number;
  trans: number;
  variant: 'overlay' | 'panel';
  eyebrow?: string;
  intro?: string;
};

const Scene: React.FC<SceneProps> = ({src, caption, index, dur, trans, variant, eyebrow, intro}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Crossfade the whole scene in/out over `trans` frames.
  const sceneOpacity = interpolate(frame, [0, trans, dur - trans, dur], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // Every screen shows its photo alone for a beat before any words appear.
  const delay = Math.max(10, Math.min(Math.round(fps * 1.1), Math.floor(dur * 0.32)));

  // Scene 0 only: the opening wish dissolves into this photo's caption.
  // Floor at delay+21 so the interpolate keyframes below ([delay, delay+20,
  // introOut, introOut+16]) stay strictly increasing even when a very short
  // scene (e.g. a long closing message eating most of the budget) would
  // otherwise put this too close to (or before) delay+20.
  const introOut = intro ? Math.max(delay + 21, delay + Math.round((dur - delay) * 0.46)) : 0;
  const captionIn = intro ? introOut + 14 : delay;
  const introOpacity = intro ? interpolate(frame, [delay, delay + 20, introOut, introOut + 16], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;

  const isPanel = variant === 'panel';
  const captionSize = isPanel ? 96 : 104;
  const introSize = isPanel ? 92 : 108;

  // Panel: rises from the bottom to cover roughly half the frame.
  const panelStart = Math.max(0, delay - 10);
  const panelReveal = interpolate(frame, [panelStart, panelStart + 26], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const panelY = interpolate(panelReveal, [0, 1], [60, 0]);

  const textBlock = (
    <>
      {eyebrow ? (
        <RevealFade from={Math.max(4, delay - 6)} y={14} style={{color: C.glow, fontFamily: sans, fontSize: 32, letterSpacing: 6, textTransform: 'uppercase', textShadow: '0 2px 16px rgba(0,0,0,.5)'}}>
          {eyebrow}
        </RevealFade>
      ) : null}

      {intro ? (
        // Grid-stack intro and caption in the same cell so the opening wish
        // dissolves directly into the first caption without a layout jump.
        <div style={{display: 'grid', placeItems: 'center', width: '100%'}}>
          <div style={{gridColumn: 1, gridRow: 1, opacity: introOpacity, textAlign: 'center', fontFamily: serif, fontSize: introSize, fontStyle: 'italic', lineHeight: 1.14, color: C.cream, textShadow: '0 6px 34px rgba(0,0,0,.55)'}}>
            {intro}
          </div>
          <RevealFade from={captionIn} style={{gridColumn: 1, gridRow: 1, textAlign: 'center', color: C.cream, fontFamily: serif, fontSize: captionSize, lineHeight: 1.15, fontStyle: 'italic', textShadow: '0 6px 34px rgba(0,0,0,.55)'}}>
            {caption}
          </RevealFade>
        </div>
      ) : (
        <RevealFade from={captionIn} style={{textAlign: 'center', color: C.cream, fontFamily: serif, fontSize: captionSize, lineHeight: 1.15, fontStyle: 'italic', textShadow: '0 6px 34px rgba(0,0,0,.55)'}}>
          {caption}
        </RevealFade>
      )}
    </>
  );

  return (
    <AbsoluteFill style={{opacity: sceneOpacity}}>
      <AbsoluteFill style={{background: C.ink}}>
        <KenBurns src={src} index={index} dur={dur} />
      </AbsoluteFill>
      <WarmOverlay heavyBottom={isPanel} />
      <LightLeak />

      {isPanel ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 88px',
            transform: `translateY(${panelY}px)`,
            opacity: panelReveal,
            background: 'linear-gradient(180deg, rgba(59,18,32,.5) 0%, rgba(42,16,22,.86) 62%, rgba(32,11,17,.92) 100%)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            borderRadius: '46px 46px 0 0',
            boxShadow: '0 -22px 60px rgba(0,0,0,.35)',
            borderTop: '1px solid rgba(255,247,242,.18)',
          }}
        >
          {textBlock}
        </div>
      ) : (
        <div style={{position: 'absolute', left: 90, right: 90, top: '27%', bottom: '30%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
          {textBlock}
        </div>
      )}
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

  // Photo scene count follows the uploaded images (capped by maxSlides). Every
  // image gets its own scene + caption, honouring the captionPerImage setting.
  const photoCount = Math.max(1, Math.min(photos.length || copy.photoMessages.length, maxSlides));

  // Reserve a clean branded outro (~15% of runtime, 2–5s) and a dedicated
  // closing-message beat, then pace the photo scenes at 2.5–3.5s each with the
  // opening and closing slides pinned to the full 3.5s. See heartfeltTiming.ts
  // for the allocation; the closing beat is sized from the actual message
  // length so the longest supported message always types out and reveals its
  // signature in full, and it absorbs any frames the per-slide cap leaves over.
  const trans = Math.round(fps * 0.4);
  const {slides, photoTotal, closingFrames} = planHeartfeltTiming({
    durationInFrames,
    fps,
    photoCount,
    closingMessage: copy.final,
    hasSignature: Boolean(copy.sender),
    trans,
  });

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
        const {from, dur: base} = slides[i];
        const dur = base + trans;
        const caption = copy.photoMessages[i] || copy.photoMessages[copy.photoMessages.length - 1] || copy.final;
        // Alternate the message treatment every scene; the opening scene uses
        // the full-screen overlay for a strong first impression.
        const variant: 'overlay' | 'panel' = i % 2 === 0 ? 'overlay' : 'panel';
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <Scene
              src={photos[i]}
              caption={caption}
              index={i}
              dur={dur}
              trans={trans}
              variant={variant}
              eyebrow={isFirst ? copy.eyebrow : undefined}
              intro={isFirst ? copy.intro : undefined}
            />
          </Sequence>
        );
      })}

      <BrandFooter visibleUntil={photoTotal} />

      {/* Dedicated closing-message beat — the second-to-last photo (see
          closingPhotoIndex: the opening message owns the first, and the last is
          skipped so the final slide doesn't run back-to-back on the same image),
          large typed final message in a focused overlay panel, separate from
          any caption. */}
      <Sequence from={photoTotal} durationInFrames={closingFrames + trans}>
        <ClosingMessageScene
          src={photos[closingPhotoIndex(photoCount)]}
          message={copy.final}
          signature={copy.sender ? `With love, ${copy.sender}` : undefined}
          dur={closingFrames + trans}
          trans={trans}
          palette={{ink: C.ink, cream: C.cream, accent: C.glow, overlayRgb: '42,16,22'}}
          fontFamilySerif={serif}
          fontFamilySans={sans}
        />
      </Sequence>

      <Sequence from={photoTotal + closingFrames} durationInFrames={durationInFrames - photoTotal - closingFrames}>
        <BrandOutro durationInFrames={durationInFrames - photoTotal - closingFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
