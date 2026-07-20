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
import {ClosingMessageScene, estimateClosingContentFrames} from './ClosingMessageScene';

const {fontFamily: serif} = loadCormorant();
const {fontFamily: sans} = loadOutfit();

// Warm, emotional palette — soft cinematic, no party colours.
const C = {ink: '#160A0F', cream: '#FFF7EA', rose: '#D98774', wine: '#5E1A2E', amber: '#F1B56B', glow: '#FFD9A8'};

// Resolve copy with graceful fallbacks so no scene is ever blank.
const useCopy = (props: WeddingProps) => {
  const r: ResolvedCopy = props.resolved || {};
  const celebrant = r.celebrantName || props.couple?.partnerOne || 'You';
  const sender = r.senderName || '';
  const recipientTerm = r.recipientTerm || '';
  const occasionLabel = r.occasionLabel || '';
  const intro = r.introMessage || (occasionLabel ? `${occasionLabel} wishes, ${celebrant}` : `This one's for you, ${celebrant}`);
  const final = r.finalMessage || 'Here’s to you, today and always.';
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
  return {celebrant, sender, recipientTerm, occasionLabel, intro, final, photoMessages, eyebrow};
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
      style={{position: 'absolute', inset: '-7%', width: '114%', height: '114%', objectFit: 'cover', transform: `scale(${scale}) translate(${px}px, ${py}px)`, filter: 'saturate(.95) brightness(.93) contrast(1.03)'}}
    />
  );
};

// Warm readability overlay: bottom gradient for lower-third text + soft vignette.
const WarmOverlay: React.FC = () => (
  <>
    <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(22,10,15,.30) 0%, rgba(22,10,15,0) 26%, rgba(22,10,15,0) 46%, rgba(22,10,15,.78) 100%)'}} />
    <AbsoluteFill style={{background: 'radial-gradient(120% 80% at 50% 42%, rgba(0,0,0,0) 52%, rgba(20,7,12,.5) 100%)'}} />
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

// ---------- Text blocks ----------

const Caption: React.FC<{text: string; from?: number}> = ({text, from = 6}) => (
  <Reveal from={from} style={{position: 'absolute', left: 84, right: 84, bottom: 300, textAlign: 'center', color: C.cream, fontFamily: serif, fontSize: 84, lineHeight: 1.16, fontStyle: 'italic', textShadow: '0 6px 34px rgba(0,0,0,.55)'}}>
    {text}
  </Reveal>
);

const Eyebrow: React.FC<{text: string}> = ({text}) =>
  text ? (
    <Reveal from={4} y={14} style={{position: 'absolute', left: 84, right: 84, top: 150, textAlign: 'center', color: C.glow, fontFamily: sans, fontSize: 34, letterSpacing: 6, textTransform: 'uppercase', textShadow: '0 2px 16px rgba(0,0,0,.5)'}}>
      {text}
    </Reveal>
  ) : null;

// ---------- Scenes ----------

type SceneProps = {
  src?: string;
  caption: string;
  index: number;
  dur: number;
  trans: number;
  eyebrow?: string;
  intro?: string;
};

const PhotoScene: React.FC<SceneProps> = ({src, caption, index, dur, trans, eyebrow, intro}) => {
  const frame = useCurrentFrame();
  // Crossfade: fade the whole scene in and out over `trans` frames.
  const sceneOpacity = interpolate(frame, [0, trans, dur - trans, dur], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // First scene: play the opening wish, then dissolve into this photo's caption.
  // Floor at trans+19 so the interpolate keyframes below ([trans, trans+18,
  // introOut, introOut+16]) stay strictly increasing even when a very short
  // scene (e.g. a long closing message eating most of the budget) would
  // otherwise put dur*0.5 below trans+18.
  const introOut = Math.max(trans + 19, Math.round(dur * 0.5));
  const captionIn = intro ? Math.round(dur * 0.44) : 6;
  const introOpacity = intro ? interpolate(frame, [trans, trans + 18, introOut, introOut + 16], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;

  return (
    <AbsoluteFill style={{opacity: sceneOpacity}}>
      <AbsoluteFill style={{background: C.ink}}>
        <KenBurns src={src} index={index} dur={dur} />
      </AbsoluteFill>
      <WarmOverlay />
      <LightLeak />

      {eyebrow ? <Eyebrow text={eyebrow} /> : null}

      {intro ? (
        <div style={{opacity: introOpacity, position: 'absolute', left: 92, right: 92, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
          <div style={{fontFamily: serif, fontSize: 112, fontStyle: 'italic', lineHeight: 1.1, color: C.cream, textShadow: '0 6px 34px rgba(0,0,0,.55)'}}>{intro}</div>
        </div>
      ) : null}

      <Caption text={caption} from={captionIn} />
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

  // Photo scene count follows the uploaded images (capped by maxSlides). Every
  // image gets its own scene + caption, honouring the captionPerImage setting.
  const photoCount = Math.max(1, Math.min(photos.length || copy.photoMessages.length, maxSlides));

  // Reserve a clean branded outro (~15% of runtime, 2–5s) and a dedicated
  // closing-message beat, then split what's left evenly across the photo
  // scenes. The closing beat is sized from the actual message length (via
  // estimateClosingContentFrames) rather than a fixed proportion, so the
  // longest supported message always has enough room to fully type out and
  // reveal the signature before the crossfade to the outro begins.
  const trans = Math.round(fps * 0.4);
  const outroFrames = Math.min(Math.round(fps * 5), Math.max(Math.round(fps * 2), Math.round(durationInFrames * 0.15)));
  const closingFrames = Math.max(Math.round(fps * 1.2), estimateClosingContentFrames(copy.final, Boolean(copy.sender), trans));
  const photoTotal = durationInFrames - outroFrames - closingFrames;
  const sceneBase = Math.floor(photoTotal / photoCount);

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
        const from = i * sceneBase;
        const base = isLast ? photoTotal - from : sceneBase;
        // Overlap into the next scene (closing message, or outro) by `trans`.
        const dur = base + trans;
        const caption = copy.photoMessages[i] || copy.photoMessages[copy.photoMessages.length - 1] || copy.final;
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <PhotoScene
              src={photos[i]}
              caption={caption}
              index={i}
              dur={dur}
              trans={trans}
              eyebrow={isFirst ? copy.eyebrow : undefined}
              intro={isFirst ? copy.intro : undefined}
            />
          </Sequence>
        );
      })}

      <BrandFooter visibleUntil={photoTotal} />

      {/* Dedicated closing-message beat — the first photo again, large typed
          final message in a focused overlay panel, separate from any caption. */}
      <Sequence from={photoTotal} durationInFrames={closingFrames + trans}>
        <ClosingMessageScene
          src={photos[0]}
          message={copy.final}
          signature={copy.sender ? `With love, ${copy.sender}` : undefined}
          dur={closingFrames + trans}
          trans={trans}
          palette={{ink: C.ink, cream: C.cream, accent: C.glow, overlayRgb: '22,10,15'}}
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
