import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadOutfit} from '@remotion/google-fonts/Outfit';
import {WeddingProps} from './types';

const {fontFamily: serif} = loadCormorant();
const {fontFamily: sans} = loadOutfit();
const C = {black: '#0D0A09', brown: '#2C1A15', ivory: '#FFF7EA', gold: '#D9AE65', amber: '#A96D3F', muted: 'rgba(255,247,234,.72)'};

const Fade: React.FC<{children: React.ReactNode; delay?: number; duration?: number; style?: React.CSSProperties}> = ({children, delay = 0, duration = 24, style}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, duration], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const y = interpolate(frame - delay, [0, duration], [22, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <div style={{opacity, transform: `translateY(${y}px)`, ...style}}>{children}</div>;
};

const FilmBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const lightX = interpolate(frame, [0, 900], [-25, 115], {extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{overflow: 'hidden', background: `radial-gradient(circle at 50% 35%, #59382B 0%, ${C.brown} 44%, ${C.black} 100%)`}}>
    <AbsoluteFill style={{transform: `translateX(${lightX - 50}%)`, width: '120%', background: 'linear-gradient(105deg, transparent 36%, rgba(240,183,99,.3) 47%, rgba(255,226,165,.1) 52%, transparent 62%)', filter: 'blur(24px)', opacity: .8}} />
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 14% 16%, rgba(255,211,151,.36), transparent 22%), radial-gradient(ellipse at 82% 78%, rgba(126,65,43,.32), transparent 32%)', filter: 'blur(20px)'}} />
    <AbsoluteFill style={{opacity: .13, backgroundImage: 'repeating-radial-gradient(circle at 20% 30%, rgba(255,255,255,.3) 0 1px, transparent 1px 5px)', backgroundSize: '8px 8px', mixBlendMode: 'soft-light'}} />
    <AbsoluteFill style={{boxShadow: 'inset 0 0 180px rgba(0,0,0,.65)'}} />
  </AbsoluteFill>;
};

const GoldReflection: React.FC<{delay?: number}> = ({delay = 0}) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame - delay, [0, 100], [-35, 135], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', opacity: .7, mixBlendMode: 'screen'}}><div style={{position: 'absolute', top: -100, bottom: -100, left: `${x}%`, width: 190, transform: 'rotate(16deg)', background: 'linear-gradient(90deg, transparent, rgba(247,205,126,.5), rgba(255,245,202,.13), transparent)', filter: 'blur(18px)'}} /></div>;
};

const BrandFooter: React.FC<{visible: boolean}> = ({visible}) => { const frame = useCurrentFrame(); const opacity = visible ? interpolate(frame, [0, 18], [0, .82], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0; return <div style={{position: 'absolute', left: 68, right: 68, bottom: 72, display: 'flex', justifyContent: 'center', zIndex: 30, opacity}}><div style={{display: 'flex', alignItems: 'center', gap: 13, padding: '9px 18px', borderRadius: 40, background: 'rgba(8,6,5,.4)', backdropFilter: 'blur(12px)', color: C.ivory, fontFamily: sans, fontSize: 21, letterSpacing: 1}}><Img src={staticFile('logo.png')} style={{width: 110, height: 'auto'}} /><span>InvitaVideos.com</span></div></div>; };

const Photo: React.FC<{src?: string; fallback?: string; duration: number}> = ({src, fallback, duration}) => { const frame = useCurrentFrame(); const scale = interpolate(frame, [0, Math.max(1, duration)], [1.11, 1.01], {extrapolateRight: 'clamp'}); return src ? <Img src={src} pauseWhenLoading style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, filter: 'sepia(.18) saturate(.82) brightness(.83)'}} /> : <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontFamily: serif, fontSize: 130}}>{fallback || 'G'}</div>; };

const PhotoReveal: React.FC<{src?: string; label: string; title: React.ReactNode; duration: number}> = ({src, label, title, duration}) => <AbsoluteFill><div style={{position: 'absolute', inset: 45, overflow: 'hidden', border: '1px solid rgba(217,174,101,.5)', boxShadow: '0 28px 80px rgba(0,0,0,.4)'}}><Photo src={src} duration={duration} /><GoldReflection /></div><AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,.1) 30%, rgba(0,0,0,.75) 100%)'}} /><Fade style={{position: 'absolute', left: 74, right: 74, bottom: 250, color: C.muted, fontFamily: sans, fontSize: 22, letterSpacing: 8, textTransform: 'uppercase'}}>{label}</Fade><Fade delay={12} style={{position: 'absolute', left: 72, right: 72, bottom: 150, color: C.ivory, fontFamily: serif, fontSize: 88, lineHeight: .98, textShadow: '0 8px 30px rgba(0,0,0,.4)'}}>{title}</Fade></AbsoluteFill>;

const SceneOne: React.FC = () => <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center', color: C.ivory}}><Fade style={{fontFamily: sans, fontSize: 25, letterSpacing: 12, textTransform: 'uppercase'}}>Some moments</Fade><Fade delay={20} style={{fontFamily: serif, fontSize: 102, lineHeight: 1.02, marginTop: 38}}>deserve to glow<div style={{height: 2, width: 250, background: C.gold, margin: '44px auto 0'}} /></Fade><GoldReflection /></AbsoluteFill>;

const SceneThree: React.FC<{photos: string[]}> = ({photos}) => { const frame = useCurrentFrame(); const phrase = frame < 42 ? 'A little more light' : frame < 90 ? 'A little more magic' : 'Another beautiful year'; const index = frame < 42 ? 1 : frame < 90 ? 2 : 1; return <AbsoluteFill style={{padding: 62}}><div style={{position: 'absolute', inset: 62, overflow: 'hidden', display: 'flex', gap: 15}}><div style={{flex: 1}}><Photo src={photos[1] || photos[0]} duration={120} fallback="2" /></div><div style={{flex: 1, marginTop: 80}}><Photo src={photos[2] || photos[0]} duration={120} fallback="3" /></div><GoldReflection delay={index * 12} /></div><AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(13,10,9,.06), rgba(13,10,9,.78))'}} /><Fade style={{position: 'absolute', bottom: 190, left: 70, right: 70, color: C.ivory, textAlign: 'center', fontFamily: serif, fontSize: 73, fontStyle: 'italic'}}>{phrase}</Fade></AbsoluteFill>; };

const SceneFour: React.FC<WeddingProps & {src?: string}> = ({src, ...props}) => <AbsoluteFill><div style={{position: 'absolute', inset: 0}}><Photo src={src} duration={150} fallback="4" /><AbsoluteFill style={{background: 'radial-gradient(circle at 50% 40%, transparent 0%, rgba(8,5,4,.74) 100%)'}} /><GoldReflection /></div><Fade style={{position: 'absolute', top: 280, left: 72, right: 72, color: C.gold, fontFamily: sans, fontSize: 24, letterSpacing: 10, textTransform: 'uppercase'}}>Here's to</Fade><Fade delay={14} style={{position: 'absolute', top: 390, left: 70, right: 70, color: C.ivory, fontFamily: serif, fontSize: 126, lineHeight: .88}}>another<br /><span style={{color: C.gold}}>beautiful year</span></Fade><Fade delay={28} style={{position: 'absolute', bottom: 250, left: 72, right: 72, color: C.muted, fontFamily: serif, fontSize: 34, fontStyle: 'italic'}}>and memories still waiting to be made</Fade></AbsoluteFill>;

const Invitation: React.FC<WeddingProps> = (props) => <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: 82, textAlign: 'center', color: C.ivory}}><div style={{position: 'absolute', inset: 72, border: `1px solid ${C.gold}`}} /><Fade style={{fontFamily: sans, fontSize: 23, letterSpacing: 8, textTransform: 'uppercase', color: C.gold}}>You are warmly invited</Fade><Fade delay={13} style={{fontFamily: serif, fontSize: 72, marginTop: 45}}>to celebrate</Fade><Fade delay={25} style={{fontFamily: serif, fontSize: 94, marginTop: 22, color: C.gold, fontStyle: 'italic'}}>{props.couple.partnerOne}'s birthday</Fade><div style={{position: 'absolute', bottom: 160, fontFamily: sans, color: C.muted, fontSize: 22, letterSpacing: 5}}>A GOLDEN HOUR CELEBRATION</div></AbsoluteFill>;

const Details: React.FC<WeddingProps> = (props) => <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: 90, color: C.ivory, textAlign: 'center'}}><Fade style={{fontFamily: serif, fontSize: 78}}>{props.eventDate || 'The date to remember'}</Fade><div style={{width: 300, height: 1, background: C.gold, margin: '50px auto'}} /><Fade delay={15} style={{fontFamily: sans, fontSize: 39, letterSpacing: 2}}>{props.venue.name || 'A beautiful celebration'}</Fade><Fade delay={27} style={{fontFamily: serif, color: C.gold, fontSize: 49, marginTop: 18}}>{props.venue.city || 'With the people we love'}</Fade>{props.message && props.message.length < 90 ? <Fade delay={38} style={{fontFamily: serif, fontSize: 29, fontStyle: 'italic', color: C.muted, marginTop: 72}}>{props.message}</Fade> : null}</AbsoluteFill>;

const Outro: React.FC = () => { const frame = useCurrentFrame(); const logoOpacity = interpolate(frame, [24, 45], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}); const logoScale = interpolate(frame, [24, 54], [.82, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}); return <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: 'linear-gradient(145deg, #120D0B, #4A2E22 54%, #9A6544)', color: C.ivory}}><Fade style={{fontFamily: sans, fontSize: 24, letterSpacing: 8, textTransform: 'uppercase'}}>Create your moment</Fade><Img src={staticFile('logo.png')} style={{width: 570, height: 'auto', marginTop: 88, opacity: logoOpacity, transform: `scale(${logoScale})`, filter: 'drop-shadow(0 0 26px rgba(255,214,137,.4))'}} /><Fade delay={38} style={{fontFamily: sans, fontSize: 43, letterSpacing: 4, marginTop: 58}}>InvitaVideos.com</Fade><Fade delay={52} style={{fontFamily: serif, fontSize: 30, color: C.muted, marginTop: 21}}>Beautiful stories, made in minutes.</Fade></AbsoluteFill>; };

export const GoldenHour: React.FC<WeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const photos = props.photos?.length ? props.photos : [];
  const at = (seconds: number) => Math.min(durationInFrames, Math.round(seconds * fps));
  const outroStart = Math.min(durationInFrames, at(27));
  const volume = interpolate(frame, [0, fps, Math.max(fps, durationInFrames - fps), durationInFrames], [0, .9, .9, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: C.black}}>{props.musicUrl ? <Audio src={props.musicUrl} volume={volume} /> : null}<FilmBackdrop /><Sequence from={at(0)} durationInFrames={Math.max(1, at(3.5))}><SceneOne /></Sequence><Sequence from={at(3.5)} durationInFrames={Math.max(1, at(4.5) - at(3.5))}><PhotoReveal src={photos[0]} label="This moment" title={<>belongs to<br /><span style={{color: C.gold}}>{props.couple.partnerOne}</span></>} duration={at(4.5)} /></Sequence><Sequence from={at(8)} durationInFrames={Math.max(1, at(13) - at(8))}><SceneThree photos={photos} /></Sequence><Sequence from={at(13)} durationInFrames={Math.max(1, at(18) - at(13))}><SceneFour src={photos[3] || photos[0]} {...props} /></Sequence><Sequence from={at(18)} durationInFrames={Math.max(1, at(23) - at(18))}><Invitation {...props} /></Sequence><Sequence from={at(23)} durationInFrames={Math.max(1, outroStart - at(23))}><Details {...props} /></Sequence><Sequence from={outroStart} durationInFrames={Math.max(1, durationInFrames - outroStart)}><Outro /></Sequence><BrandFooter visible={frame >= at(2) && frame < outroStart} /></AbsoluteFill>;
};
