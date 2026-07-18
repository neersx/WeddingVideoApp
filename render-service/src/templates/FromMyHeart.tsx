import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadOutfit} from '@remotion/google-fonts/Outfit';
import {WeddingProps, ResolvedCopy} from './types';

const {fontFamily: serif} = loadCormorant();
const {fontFamily: sans} = loadOutfit();

const C = {ink: '#1A0710', cream: '#FFF7EA', rose: '#D98774', wine: '#7A1E3A', amber: '#F1B56B'};

// Pull resolved copy with sensible fallbacks so the template never renders blank
// even if the user skipped optional message fields.
const useCopy = (props: WeddingProps) => {
  const r: ResolvedCopy = props.resolved || {};
  const celebrant = r.celebrantName || props.couple?.partnerOne || 'You';
  const sender = r.senderName || '';
  const recipientTerm = r.recipientTerm || '';
  const senderTerm = r.senderTerm || '';
  const intro = r.introMessage || `Happy Birthday, ${celebrant}`;
  const final = r.finalMessage || `Here's to you, today and always.`;
  const photoMessages = (r.photoMessages && r.photoMessages.length
    ? r.photoMessages
    : [
        `To my ${recipientTerm || 'favourite person'},`,
        'every moment with you is a gift.',
        'You make ordinary days feel golden.',
        'Thank you for being you.',
        'Happy birthday, with all my heart.',
      ]);
  return {celebrant, sender, recipientTerm, senderTerm, intro, final, photoMessages};
};

const Fade: React.FC<{children: React.ReactNode; duration?: number; delay?: number; style?: React.CSSProperties}> = ({children, duration = 24, delay = 0, style}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, duration], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const y = interpolate(frame - delay, [0, duration], [26, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <div style={{opacity, transform: `translateY(${y}px)`, ...style}}>{children}</div>;
};

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 900], [0, 10], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: 'radial-gradient(circle at 50% 18%, #7A1E3A 0%, #3A0E20 45%, #1A0710 100%)'}}>
      <AbsoluteFill style={{transform: `scale(1.1) translate(${drift}px, ${-drift}px)`, background: 'radial-gradient(ellipse at 25% 18%, rgba(255,224,170,.34), transparent 24%), radial-gradient(ellipse at 82% 30%, rgba(217,135,116,.3), transparent 26%), radial-gradient(ellipse at 50% 88%, rgba(20,7,12,.7), transparent 55%)', filter: 'blur(20px)'}} />
    </AbsoluteFill>
  );
};

const FloatingHearts: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const seed = i * 137;
        const x = (seed % 90) + 5;
        const rise = interpolate((frame + seed) % 300, [0, 300], [1200, -120]);
        const opacity = interpolate((frame + seed) % 300, [0, 40, 260, 300], [0, .5, .5, 0]);
        return <div key={i} style={{position: 'absolute', left: `${x}%`, top: rise, fontSize: 26 + (i % 3) * 12, opacity, color: C.rose}}>❤</div>;
      })}
    </AbsoluteFill>
  );
};

const BrandFooter: React.FC<{show: boolean}> = ({show}) => {
  const frame = useCurrentFrame();
  const opacity = show ? interpolate(frame, [0, 20], [0, .82], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
  return (
    <div style={{position: 'absolute', left: 66, right: 66, bottom: 76, display: 'flex', justifyContent: 'center', opacity, zIndex: 20}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderRadius: 40, background: 'rgba(20,7,12,.4)', backdropFilter: 'blur(12px)', color: C.cream, fontFamily: sans, fontSize: 22, letterSpacing: 1}}>
        <Img src={staticFile('logo.png')} style={{width: 112, height: 'auto', objectFit: 'contain'}} />
        <span>InvitaVideos.com</span>
      </div>
    </div>
  );
};

const Intro: React.FC<{intro: string; recipientTerm: string}> = ({intro, recipientTerm}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 14}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center', color: C.cream, padding: 90}}>
      {recipientTerm ? (
        <Fade style={{fontFamily: sans, color: C.amber, fontSize: 27, letterSpacing: 9, textTransform: 'uppercase'}}>To my {recipientTerm}</Fade>
      ) : null}
      <div style={{transform: `scale(${pop})`, marginTop: 34, fontFamily: serif, fontSize: 96, fontStyle: 'italic', lineHeight: 1.08, textShadow: '0 6px 30px rgba(0,0,0,.4)'}}>
        {intro}
      </div>
      <Fade delay={24} style={{marginTop: 40, fontSize: 60}}>❤️</Fade>
    </AbsoluteFill>
  );
};

const PhotoScene: React.FC<{src?: string; caption: string; duration: number; index: number}> = ({src, caption, duration, index}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, Math.max(1, duration)], [1.09, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 55, overflow: 'hidden', borderRadius: 32, boxShadow: '0 28px 80px rgba(0,0,0,.4)', border: '1px solid rgba(255,247,234,.3)'}}>
        {src ? (
          <Img src={src} pauseWhenLoading style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, filter: 'saturate(.94) brightness(.92)'}} />
        ) : (
          <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.wine, color: C.amber, fontFamily: serif, fontSize: 160}}>{index + 1}</div>
        )}
      </div>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(17,7,12,.05) 40%, rgba(17,7,12,.78) 100%)'}} />
      <Fade delay={6} style={{position: 'absolute', left: 78, right: 78, bottom: 210, textAlign: 'center', color: C.cream, fontFamily: serif, fontSize: 62, lineHeight: 1.12, textShadow: '0 5px 25px rgba(0,0,0,.45)'}}>
        {caption}
      </Fade>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{final: string; sender: string; senderTerm: string}> = ({final, sender, senderTerm}) => {
  const frame = useCurrentFrame();
  const logoOpacity = interpolate(frame, [18, 40], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const signoff = sender ? `With love, your ${senderTerm || 'friend'} ${sender}` : 'With all my love';
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(145deg, #2A0E1B, #7A1E3A 60%, #D98774)', color: C.cream, padding: 80}}>
      <Fade style={{fontFamily: serif, fontSize: 72, fontStyle: 'italic', lineHeight: 1.1}}>{final}</Fade>
      <Fade delay={16} style={{marginTop: 40, fontFamily: sans, fontSize: 30, letterSpacing: 2, color: 'rgba(255,247,234,.9)'}}>{signoff}</Fade>
      <Img src={staticFile('logo.png')} style={{width: 480, height: 'auto', marginTop: 76, opacity: logoOpacity}} />
      <div style={{fontFamily: sans, fontSize: 22, letterSpacing: 5, marginTop: 26, opacity: .75}}>Create · Personalize · Share</div>
    </AbsoluteFill>
  );
};

export const FromMyHeart: React.FC<WeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const copy = useCopy(props);
  const photos = props.photos || [];
  const at = (seconds: number) => Math.min(durationInFrames, Math.round(seconds * fps));

  // Distribute available photos across the middle of the reel.
  const introEnd = at(4);
  const outroStart = Math.max(introEnd + fps, durationInFrames - at(4));
  const photoCount = Math.max(1, Math.min(photos.length || copy.photoMessages.length, 5));
  const photoSpan = Math.max(1, outroStart - introEnd);
  const per = Math.floor(photoSpan / photoCount);

  const musicVolume = interpolate(frame, [0, fps, Math.max(fps, durationInFrames - fps), durationInFrames], [0, .9, .9, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: C.ink, fontFamily: sans}}>
      {props.musicUrl ? <Audio src={props.musicUrl} volume={musicVolume} /> : null}
      <Background />
      <FloatingHearts />

      <Sequence from={0} durationInFrames={introEnd}>
        <Intro intro={copy.intro} recipientTerm={copy.recipientTerm} />
      </Sequence>

      {Array.from({length: photoCount}).map((_, i) => {
        const from = introEnd + i * per;
        const dur = i === photoCount - 1 ? Math.max(1, outroStart - from) : per;
        const caption = copy.photoMessages[i] || copy.photoMessages[copy.photoMessages.length - 1] || '';
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <PhotoScene src={photos[i]} caption={caption} duration={dur} index={i} />
          </Sequence>
        );
      })}

      <Sequence from={outroStart} durationInFrames={Math.max(1, durationInFrames - outroStart)}>
        <Outro final={copy.final} sender={copy.sender} senderTerm={copy.senderTerm} />
      </Sequence>

      <BrandFooter show={frame >= fps && frame < outroStart} />
    </AbsoluteFill>
  );
};
