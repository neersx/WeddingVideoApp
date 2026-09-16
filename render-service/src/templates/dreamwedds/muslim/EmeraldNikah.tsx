import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadMontserrat} from '@remotion/google-fonts/Montserrat';
import {DreamWeddsWeddingProps, resolveDreamWeddsDetails} from '../types';

const {fontFamily: serif} = loadCormorant();
const {fontFamily: sans} = loadMontserrat();
const C = {emerald: '#063F32', deep: '#01271F', gold: '#D7B56D', paleGold: '#F1D9A1', ivory: '#FFF7E5'};

const FadeScene: React.FC<{duration: number; children: React.ReactNode}> = ({duration, children}) => {
  const frame = useCurrentFrame();
  const edge = Math.max(10, Math.min(18, Math.floor(duration / 5)));
  const opacity = interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

const Reveal: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({delay = 0, children, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const value = spring({frame: frame - delay, fps, config: {damping: 180, stiffness: 78}});
  return <div style={{opacity: value, transform: `translateY(${(1 - value) * 38}px)`, ...style}}>{children}</div>;
};

const BoldReveal: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({delay = 0, children, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const value = spring({frame: frame - delay, fps, config: {damping: 13, stiffness: 92, mass: .8}});
  const glow = interpolate(value, [0, .65, 1], [0, 1, .35]);
  return <div style={{
    opacity: value,
    clipPath: `inset(${(1 - value) * 48}% 0 ${(1 - value) * 48}% 0)`,
    transform: `translateY(${(1 - value) * 54}px) scale(${.82 + value * .18})`,
    textShadow: `0 5px 28px rgba(0,0,0,.72), 0 0 ${32 * glow}px rgba(215,181,109,${.38 * glow})`,
    ...style,
  }}>{children}</div>;
};

const Background: React.FC<{closing?: boolean; dim?: number}> = ({closing = false, dim = .1}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.01, 1.07], {extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{overflow: 'hidden', background: C.deep}}>
    <Img src={staticFile(closing ? 'emerald-nikah-courtyard.png' : 'emerald-nikah-arch.png')} pauseWhenLoading style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`}} />
    <AbsoluteFill style={{background: `linear-gradient(180deg, rgba(0,25,20,${dim * .45}), rgba(0,31,24,${dim}) 55%, rgba(0,20,16,${Math.min(.62, dim + .18)}))`}} />
  </AbsoluteFill>;
};

const LanternGlow: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
    {Array.from({length: 18}).map((_, index) => {
      const x = random(`en-x-${index}`) * 100;
      const y = (random(`en-y-${index}`) * 100 + frame * (.008 + random(`en-speed-${index}`) * .014)) % 110;
      const size = 3 + random(`en-size-${index}`) * 8;
      const opacity = .2 + Math.sin(frame / 13 + index) * .12;
      return <div key={index} style={{position: 'absolute', left: `${x}%`, top: `${y}%`, width: size, height: size, borderRadius: '50%', background: C.paleGold, opacity, boxShadow: `0 0 ${size * 3}px ${C.gold}`}} />;
    })}
  </AbsoluteFill>;
};

const Crescent: React.FC<{size?: number}> = ({size = 96}) => <div style={{width: size, height: size, borderRadius: '50%', background: C.gold, position: 'relative', margin: '0 auto'}}>
  <div style={{position: 'absolute', width: size * .88, height: size * .88, borderRadius: '50%', background: C.emerald, left: size * .29, top: -size * .08}} />
</div>;

const Divider: React.FC<{wide?: boolean}> = ({wide = false}) => <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, margin: '34px auto'}}>
  <div style={{width: wide ? 210 : 155, height: 2, background: `linear-gradient(90deg, transparent, ${C.gold})`}} />
  <div style={{width: 14, height: 14, border: `2px solid ${C.gold}`, transform: 'rotate(45deg)'}} />
  <div style={{width: wide ? 210 : 155, height: 2, background: `linear-gradient(90deg, ${C.gold}, transparent)`}} />
</div>;

const Eyebrow: React.FC<{children: React.ReactNode}> = ({children}) => <div style={{fontFamily: sans, fontSize: 29, fontWeight: 700, color: C.paleGold, letterSpacing: 7, textTransform: 'uppercase', lineHeight: 1.35}}>{children}</div>;
const nameSize = (name: string) => name.length > 24 ? 80 : name.length > 17 ? 94 : 112;
const eventSize = (name: string) => name.length > 24 ? 92 : name.length > 16 ? 108 : 128;

const OpeningScene: React.FC<DreamWeddsWeddingProps> = () => <AbsoluteFill>
  <Background dim={.06} /><LanternGlow />
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '130px 76px 70px'}}>
    <Reveal><Crescent size={108} /></Reveal>
    <BoldReveal delay={10} style={{fontFamily: serif, fontSize: 62, color: C.ivory, fontWeight: 700, marginTop: 58, whiteSpace: 'nowrap'}}>Bismillah-ir-Rahman-ir-Rahim</BoldReveal>
    <Reveal delay={20}><Divider wide /></Reveal>
    <BoldReveal delay={28} style={{fontFamily: serif, fontSize: 126, color: C.ivory, fontWeight: 700, lineHeight: .94}}>A blessed<br/><span style={{color: C.gold, fontStyle: 'italic'}}>new beginning</span></BoldReveal>
  </AbsoluteFill>
</AbsoluteFill>;

const FullPhoto: React.FC<{src?: string; fallbackClosing?: boolean; children?: React.ReactNode}> = ({src, fallbackClosing = false, children}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.03, 1.115], {extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: C.deep, padding: '170px 54px'}}>
    <div style={{height: '100%', border: `3px solid ${C.gold}`, borderRadius: '300px 300px 24px 24px', overflow: 'hidden', position: 'relative', boxShadow: '0 34px 100px rgba(0,0,0,.48)'}}>
      <Img src={src || staticFile(fallbackClosing ? 'emerald-nikah-courtyard.png' : 'emerald-nikah-arch.png')} pauseWhenLoading style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', transform: `scale(${scale})`}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,28,22,.78) 0%, rgba(0,25,20,.16) 28%, rgba(0,20,16,.08) 58%, rgba(0,22,17,.78) 100%)'}} />
      <div style={{position: 'absolute', inset: 15, border: '1px solid rgba(255,247,229,.7)', borderRadius: '286px 286px 16px 16px'}} />
      {children}
    </div>
  </AbsoluteFill>;
};

const CouplePhotoScene: React.FC<DreamWeddsWeddingProps & {photo?: string}> = ({photo, ...props}) => {
  const data = resolveDreamWeddsDetails(props);
  return <FullPhoto src={photo}><LanternGlow />
    <AbsoluteFill style={{alignItems: 'center', textAlign: 'center', padding: '160px 65px 120px', justifyContent: 'space-between'}}>
      <div>
        <BoldReveal style={{fontFamily: serif, fontSize: nameSize(data.bride.name), color: C.ivory, fontWeight: 700, lineHeight: .86}}>{data.bride.name}</BoldReveal>
        <BoldReveal delay={8} style={{fontFamily: serif, fontSize: 66, color: C.gold, fontWeight: 700, fontStyle: 'italic', lineHeight: 1.05, margin: '8px 0'}}>&amp;</BoldReveal>
        <BoldReveal delay={15} style={{fontFamily: serif, fontSize: nameSize(data.groom.name), color: C.ivory, fontWeight: 700, lineHeight: .86}}>{data.groom.name}</BoldReveal>
        <Reveal delay={24}><Divider wide /></Reveal>
      </div>
      <Reveal delay={30}><Eyebrow>With the blessings of Allah<br/>and our families</Eyebrow></Reveal>
    </AbsoluteFill>
  </FullPhoto>;
};

const EventScene: React.FC<DreamWeddsWeddingProps> = (props) => {
  const data = resolveDreamWeddsDetails(props);
  const title = data.event.title || 'Nikah Ceremony';
  const date = data.event.formattedDate || data.formattedDate || props.eventDate;
  const venue = data.event.venue || props.venue.name || 'Venue to be announced';
  const city = data.event.city || props.venue.city;
  return <AbsoluteFill><Background dim={.12} /><LanternGlow />
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '120px 66px 70px'}}>
      <Reveal><Crescent size={78} /></Reveal>
      <BoldReveal delay={8} style={{fontFamily: serif, color: C.ivory, fontSize: eventSize(title), lineHeight: .86, fontWeight: 700, marginTop: 40, maxWidth: 940}}>{title}</BoldReveal>
      <Reveal delay={17}><Divider wide /></Reveal>
      <BoldReveal delay={23} style={{fontFamily: serif, color: C.ivory, fontSize: 62, lineHeight: 1.16, fontWeight: 700, maxWidth: 950}}>{date}</BoldReveal>
      <BoldReveal delay={31} style={{fontFamily: serif, color: C.paleGold, fontSize: 52, fontWeight: 700, lineHeight: 1.2, marginTop: 34, maxWidth: 900}}>{venue}{city ? <><br/><span style={{fontSize: 43}}>{city}</span></> : null}</BoldReveal>
      <Reveal delay={42} style={{fontFamily: serif, color: C.ivory, fontSize: 45, fontStyle: 'italic', marginTop: 56}}>Your presence will make our joy complete</Reveal>
    </AbsoluteFill>
  </AbsoluteFill>;
};

const GalleryScene: React.FC<{src: string; index: number}> = ({src, index}) => <FullPhoto src={src}>
  <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center', padding: '120px 70px 150px'}}>
    <BoldReveal style={{fontFamily: serif, color: C.ivory, fontSize: 72, lineHeight: 1, fontWeight: 700}}>{index % 2 === 0 ? 'Two hearts, one promise' : 'A journey blessed with love'}</BoldReveal>
    <Reveal delay={18}><Divider /></Reveal>
  </AbsoluteFill>
</FullPhoto>;

const ClosingScene: React.FC<DreamWeddsWeddingProps & {photo?: string}> = ({photo, ...props}) => {
  const data = resolveDreamWeddsDetails(props);
  return <FullPhoto src={photo} fallbackClosing>
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '160px 65px 120px'}}>
      <Reveal><Eyebrow>We request the honour<br/>of your presence</Eyebrow></Reveal>
      <Reveal delay={10}><Divider wide /></Reveal>
      <BoldReveal delay={18} style={{fontFamily: serif, color: C.ivory, fontSize: 82, lineHeight: .98, fontWeight: 700, marginTop: 18}}>We look forward to<br/>celebrating with you</BoldReveal>
      <BoldReveal delay={30} style={{fontFamily: serif, color: C.paleGold, fontSize: 62, lineHeight: 1, fontWeight: 700, fontStyle: 'italic', marginTop: 54}}>{data.bride.name} &amp; {data.groom.name}</BoldReveal>
      <Reveal delay={42} style={{fontFamily: sans, color: C.paleGold, fontSize: 25, fontWeight: 700, letterSpacing: 9, textTransform: 'uppercase', marginTop: 76}}>DreamWedds</Reveal>
    </AbsoluteFill>
  </FullPhoto>;
};

const uniquePhotos = (props: DreamWeddsWeddingProps) => {
  const data = resolveDreamWeddsDetails(props);
  return Array.from(new Set([...(props.photos || []), data.storyImageUrl, data.event.imageUrl, data.closingImageUrl].filter((value): value is string => Boolean(value)))).slice(0, 8);
};

export const EmeraldNikah: React.FC<DreamWeddsWeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const photos = uniquePhotos(props);
  const couplePhoto = photos[0];
  const maxGalleryScreens = Math.max(0, Math.floor((durationInFrames / fps - 30) / 4));
  const galleryPhotos = photos.slice(1, 1 + maxGalleryScreens);
  const openingDuration = Math.round(6 * fps);
  const coupleDuration = Math.round(8 * fps);
  const eventDuration = Math.round(8 * fps);
  const galleryDuration = Math.round(4 * fps);
  const galleryTotal = galleryPhotos.length * galleryDuration;
  const closingFrom = openingDuration + coupleDuration + eventDuration + galleryTotal;
  const closingDuration = Math.max(Math.round(4 * fps), durationInFrames - closingFrom);
  const volume = interpolate(frame, [0, fps, durationInFrames - fps * 2, durationInFrames], [0, .82, .82, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: C.deep}}>
    {props.musicUrl ? <Audio src={props.musicUrl} volume={volume} /> : null}
    <Sequence from={0} durationInFrames={openingDuration}><FadeScene duration={openingDuration}><OpeningScene {...props} /></FadeScene></Sequence>
    <Sequence from={openingDuration} durationInFrames={coupleDuration}><FadeScene duration={coupleDuration}><CouplePhotoScene {...props} photo={couplePhoto} /></FadeScene></Sequence>
    <Sequence from={openingDuration + coupleDuration} durationInFrames={eventDuration}><FadeScene duration={eventDuration}><EventScene {...props} /></FadeScene></Sequence>
    {galleryPhotos.map((src, index) => {
      const from = openingDuration + coupleDuration + eventDuration + index * galleryDuration;
      return <Sequence key={`${src}-${index}`} from={from} durationInFrames={galleryDuration}><FadeScene duration={galleryDuration}><GalleryScene src={src} index={index} /></FadeScene></Sequence>;
    })}
    <Sequence from={closingFrom} durationInFrames={closingDuration}><FadeScene duration={closingDuration}><ClosingScene {...props} photo={photos.at(-1)} /></FadeScene></Sequence>
  </AbsoluteFill>;
};
