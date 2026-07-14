import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadOutfit} from '@remotion/google-fonts/Outfit';
import {WeddingProps} from './types';

const {fontFamily: serif} = loadCormorant();
const {fontFamily: sans} = loadOutfit();
const C = {ink: '#241A18', cream: '#FFF7EA', amber: '#F1B56B', rose: '#D98774', brown: '#6B4438'};

const Fade: React.FC<{children: React.ReactNode; duration?: number; delay?: number; style?: React.CSSProperties}> = ({children, duration = 24, delay = 0, style}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, duration], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const y = interpolate(frame - delay, [0, duration], [24, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <div style={{opacity, transform: `translateY(${y}px)`, ...style}}>{children}</div>;
};

const WarmBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 900], [0, 8], {extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{overflow: 'hidden', background: 'radial-gradient(circle at 50% 22%, #9C6249 0%, #4B302A 43%, #1E1515 100%)'}}>
    <AbsoluteFill style={{transform: `scale(1.08) translate(${drift}px, ${-drift}px)`, background: 'radial-gradient(ellipse at 25% 18%, rgba(255,224,170,.42), transparent 22%), radial-gradient(ellipse at 85% 35%, rgba(244,166,121,.28), transparent 26%), radial-gradient(ellipse at 45% 85%, rgba(38,17,18,.64), transparent 55%)', filter: 'blur(18px)'}} />
    <AbsoluteFill style={{opacity: .16, backgroundImage: 'repeating-radial-gradient(circle at 20% 30%, rgba(255,255,255,.2) 0 1px, transparent 1px 4px)', backgroundSize: '7px 7px', mixBlendMode: 'soft-light'}} />
  </AbsoluteFill>;
};

const BrandFooter: React.FC<{show: boolean}> = ({show}) => {
  const frame = useCurrentFrame();
  const opacity = show ? interpolate(frame, [0, 20], [0, .82], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
  return <div style={{position: 'absolute', left: 66, right: 66, bottom: 76, display: 'flex', justifyContent: 'center', opacity, zIndex: 20}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderRadius: 40, background: 'rgba(20,12,12,.38)', backdropFilter: 'blur(12px)', color: C.cream, fontFamily: sans, fontSize: 22, letterSpacing: 1}}>
      <Img src={staticFile('logo.png')} style={{width: 112, height: 'auto', objectFit: 'contain'}} />
      <span>InvitaVideos.com</span>
    </div>
  </div>;
};

const Caption: React.FC<{children: React.ReactNode; delay?: number}> = ({children, delay = 0}) => <Fade delay={delay} style={{position: 'absolute', left: 72, right: 72, bottom: 230, textAlign: 'center', color: C.cream, fontFamily: serif, fontSize: 60, lineHeight: 1.08, textShadow: '0 5px 25px rgba(0,0,0,.38)'}}>{children}</Fade>;

const SinglePhoto: React.FC<{src?: string; duration: number; index: number}> = ({src, duration, index}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, Math.max(1, duration)], [1.08, 1], {extrapolateRight: 'clamp'});
  if (!src) return <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.amber, fontFamily: serif, fontSize: 150}}>{index + 1}</div>;
  return <Img src={src} pauseWhenLoading style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, filter: 'sepia(.16) saturate(.88) brightness(.9)'}} />;
};

const PhotoScene: React.FC<{src?: string; caption: string; duration: number; index: number}> = ({src, caption, duration, index}) => <AbsoluteFill>
  <div style={{position: 'absolute', inset: 55, overflow: 'hidden', borderRadius: 32, boxShadow: '0 28px 80px rgba(0,0,0,.35)', border: '1px solid rgba(255,247,234,.32)'}}><SinglePhoto src={src} duration={duration} index={index} /></div>
  <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(17,10,10,.08) 35%, rgba(17,10,10,.72) 100%)'}} />
  <Caption>{caption}</Caption>
</AbsoluteFill>;

const Montage: React.FC<{photos: string[]; duration: number}> = ({photos, duration}) => {
  const frame = useCurrentFrame();
  const list = photos.slice(2, 4);
  return <AbsoluteFill style={{padding: 62, justifyContent: 'center', gap: 22}}>
    <div style={{display: 'flex', height: 980, gap: 20}}>{[0, 1].map((i) => <div key={i} style={{flex: 1, overflow: 'hidden', borderRadius: 28, border: `1px solid rgba(255,247,234,.38)`, transform: `translateY(${i ? 40 : -25}px) rotate(${i ? 3 : -3}deg)`, boxShadow: '0 25px 60px rgba(0,0,0,.3)'}}><SinglePhoto src={list[i]} duration={duration} index={i + 2} /></div>)}</div>
    <Caption delay={12}>And a thousand more memories to make.</Caption>
    <div style={{position: 'absolute', top: 130, left: 80, color: C.amber, fontFamily: sans, fontSize: 24, letterSpacing: 8, textTransform: 'uppercase', opacity: .9}}>The moments that matter</div>
    <div style={{position: 'absolute', top: 110, right: 82, color: C.cream, fontFamily: serif, fontSize: 44, opacity: .8}}>{String(Math.min(4, Math.max(2, photos.length))).padStart(2, '0')} / 04</div>
  </AbsoluteFill>;
};

const Intro: React.FC = () => <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center', color: C.cream}}><Fade style={{fontFamily: serif, fontSize: 90, fontStyle: 'italic', lineHeight: 1.1}}>Another trip around<br /><span style={{color: C.amber}}>the sun... ☀️</span></Fade><Fade delay={18} style={{marginTop: 38, color: 'rgba(255,247,234,.72)', fontFamily: sans, fontSize: 25, letterSpacing: 8, textTransform: 'uppercase'}}>A birthday story</Fade></AbsoluteFill>;

const Invitation: React.FC<WeddingProps> = (props) => <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center', color: C.cream, padding: 80}}><Fade style={{fontFamily: sans, color: C.amber, fontSize: 29, letterSpacing: 9, textTransform: 'uppercase'}}>So let's celebrate</Fade><Fade delay={15} style={{fontFamily: serif, fontSize: 152, lineHeight: .95, marginTop: 42, fontStyle: 'italic'}}>{props.couple.partnerOne} <span style={{color: C.amber}}>✨</span></Fade><Fade delay={30} style={{fontFamily: sans, fontSize: 28, color: 'rgba(255,247,234,.8)', marginTop: 54, letterSpacing: 3}}>A day made for joy, laughter and love</Fade></AbsoluteFill>;

const DetailsCard: React.FC<WeddingProps> = (props) => <AbsoluteFill style={{justifyContent: 'center', padding: 96}}><Fade style={{padding: '92px 54px', textAlign: 'center', borderRadius: 34, background: 'rgba(255,247,234,.94)', color: C.ink, boxShadow: '0 30px 90px rgba(0,0,0,.28)', border: `1px solid ${C.amber}`}}><div style={{fontFamily: sans, color: C.brown, fontSize: 23, letterSpacing: 9, textTransform: 'uppercase'}}>Save the date</div><div style={{fontFamily: serif, fontSize: 78, marginTop: 35}}>{props.eventDate || 'Your special day'}</div><div style={{height: 1, background: C.rose, opacity: .45, margin: '42px 80px'}} /><div style={{fontFamily: sans, fontSize: 40, fontWeight: 600}}>{props.venue.name || 'The Celebration'}<div style={{fontSize: 31, color: C.brown, marginTop: 12}}>{props.venue.city || 'With the people we love'}</div></div></Fade></AbsoluteFill>;

const Outro: React.FC<WeddingProps> = (props) => { const frame = useCurrentFrame(); const logoOpacity = interpolate(frame, [20, 42], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}); const logoScale = interpolate(frame, [20, 50], [.82, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}); return <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(145deg, #28191A, #6A4138 55%, #B87962)', color: C.cream}}><Fade style={{fontFamily: sans, fontSize: 27, letterSpacing: 8, textTransform: 'uppercase'}}>Love this reel?</Fade><Fade delay={12} style={{fontFamily: serif, fontSize: 66, marginTop: 28}}>Create yours in minutes</Fade><Img src={staticFile('logo.png')} style={{width: 570, height: 'auto', marginTop: 92, opacity: logoOpacity, transform: `scale(${logoScale})`, filter: 'drop-shadow(0 0 24px rgba(255,221,173,.38))'}} /><div style={{fontFamily: sans, fontSize: 43, letterSpacing: 4, marginTop: 55, opacity: interpolate(frame, [42, 58], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>InvitaVideos.com</div><div style={{fontFamily: sans, fontSize: 21, letterSpacing: 5, marginTop: 20, color: 'rgba(255,247,234,.72)'}}>Create · Personalize · Share</div><div style={{position: 'absolute', bottom: 80, fontFamily: serif, fontSize: 30, opacity: .8}}>{props.couple.partnerOne}'s Birthday</div></AbsoluteFill>; };

export const BirthdayEra: React.FC<WeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const photos = props.photos || [];
  const at = (seconds: number) => Math.min(durationInFrames, Math.round(seconds * fps));
  const outroStart = Math.max(0, durationInFrames - at(3));
  const musicVolume = interpolate(frame, [0, fps, Math.max(fps, durationInFrames - fps), durationInFrames], [0, .92, .92, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: C.ink, fontFamily: sans}}>{props.musicUrl ? <Audio src={props.musicUrl} volume={musicVolume} /> : null}<WarmBackground /><Sequence from={0} durationInFrames={at(4)}><Intro /></Sequence><Sequence from={at(4)} durationInFrames={at(5)}><PhotoScene src={photos[0]} caption="Another year of smiles." duration={at(5)} index={0} /></Sequence><Sequence from={at(9)} durationInFrames={at(4)}><PhotoScene src={photos[1]} caption="Another year of stories." duration={at(4)} index={1} /></Sequence><Sequence from={at(13)} durationInFrames={at(4)}><Montage photos={photos} duration={at(4)} /></Sequence><Sequence from={at(17)} durationInFrames={at(4)}><Invitation {...props} /></Sequence><Sequence from={at(21)} durationInFrames={Math.max(1, outroStart - at(21))}><DetailsCard {...props} /></Sequence><Sequence from={Math.max(at(26), outroStart - at(1))} durationInFrames={Math.max(1, outroStart - Math.max(at(26), outroStart - at(1)))}><AbsoluteFill style={{justifyContent: 'center', textAlign: 'center', color: C.cream}}><div style={{fontFamily: serif, fontSize: 66}}>Come for the celebration.</div><div style={{fontFamily: serif, fontSize: 66, color: C.amber, marginTop: 24}}>Leave with memories. ❤️</div></AbsoluteFill></Sequence><Sequence from={outroStart} durationInFrames={Math.max(1, durationInFrames - outroStart)}><Outro {...props} /></Sequence><BrandFooter show={frame >= fps && frame < outroStart} /></AbsoluteFill>;
};
