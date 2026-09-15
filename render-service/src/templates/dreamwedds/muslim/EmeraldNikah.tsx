import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadMontserrat} from '@remotion/google-fonts/Montserrat';
import {DreamWeddsWeddingProps, resolveDreamWeddsDetails} from '../types';

const {fontFamily: serif} = loadCormorant();
const {fontFamily: sans} = loadMontserrat();
const C = {emerald: '#063F32', deep: '#01271F', gold: '#D7B56D', paleGold: '#F1D9A1', ivory: '#FFF7E5'};

const FadeScene: React.FC<{duration: number; children: React.ReactNode}> = ({duration, children}) => {
  const frame = useCurrentFrame();
  const edge = Math.max(10, Math.min(20, Math.floor(duration / 4)));
  const opacity = interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

const Reveal: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({delay = 0, children, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const value = spring({frame: frame - delay, fps, config: {damping: 180, stiffness: 78}});
  return <div style={{opacity: value, transform: `translateY(${(1 - value) * 34}px) scale(${.97 + value * .03})`, ...style}}>{children}</div>;
};

const Background: React.FC<{closing?: boolean; dim?: number}> = ({closing = false, dim = .1}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.015, 1.075], {extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{overflow: 'hidden', background: C.deep}}>
    <Img src={staticFile(closing ? 'emerald-nikah-courtyard.png' : 'emerald-nikah-arch.png')} pauseWhenLoading style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`}} />
    <AbsoluteFill style={{background: `linear-gradient(180deg, rgba(0,25,20,${dim * .45}), rgba(0,31,24,${dim}) 55%, rgba(0,20,16,${Math.min(.55, dim + .16)}))`}} />
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

const Crescent: React.FC<{size?: number}> = ({size = 82}) => (
  <div style={{width: size, height: size, borderRadius: '50%', background: C.gold, position: 'relative', margin: '0 auto'}}>
    <div style={{position: 'absolute', width: size * .88, height: size * .88, borderRadius: '50%', background: C.emerald, left: size * .29, top: -size * .08}} />
  </div>
);

const Divider: React.FC = () => (
  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, margin: '30px auto'}}>
    <div style={{width: 150, height: 1, background: `linear-gradient(90deg, transparent, ${C.gold})`}} />
    <div style={{width: 12, height: 12, border: `2px solid ${C.gold}`, transform: 'rotate(45deg)'}} />
    <div style={{width: 150, height: 1, background: `linear-gradient(90deg, ${C.gold}, transparent)`}} />
  </div>
);

const Eyebrow: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{fontFamily: sans, fontSize: 23, fontWeight: 600, color: C.paleGold, letterSpacing: 7, textTransform: 'uppercase'}}>{children}</div>
);

const nameSize = (name: string) => name.length > 22 ? 70 : name.length > 15 ? 82 : 98;

const OpeningScene: React.FC<DreamWeddsWeddingProps> = () => <AbsoluteFill>
  <Background dim={.08} /><LanternGlow />
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '150px 120px 80px'}}>
    <Reveal><Crescent /></Reveal>
    <Reveal delay={12} style={{fontFamily: serif, fontSize: 50, color: C.ivory, marginTop: 52}}>Bismillah-ir-Rahman-ir-Rahim</Reveal>
    <Reveal delay={22}><Divider /></Reveal>
    <Reveal delay={30} style={{fontFamily: serif, fontSize: 92, color: C.ivory, fontWeight: 600, lineHeight: 1.02}}>A blessed<br/><span style={{color: C.gold, fontStyle: 'italic'}}>new beginning</span></Reveal>
  </AbsoluteFill>
</AbsoluteFill>;

const Portrait: React.FC<{src?: string; name: string; label: string; position: string}> = ({src, name, label, position}) => <div style={{width: 405, textAlign: 'center'}}>
  <div style={{height: 650, borderRadius: '210px 210px 18px 18px', overflow: 'hidden', border: `3px solid ${C.gold}`, boxShadow: '0 25px 70px rgba(0,0,0,.38)', background: C.deep, position: 'relative'}}>
    {src ? <Img src={src} pauseWhenLoading style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: position}} /> : <div style={{display: 'grid', placeItems: 'center', height: '100%', fontFamily: serif, fontSize: 150, color: C.gold}}>{name.charAt(0)}</div>}
    <div style={{position: 'absolute', inset: 12, border: '1px solid rgba(255,247,229,.62)', borderRadius: '198px 198px 12px 12px'}} />
  </div>
  <div style={{fontFamily: sans, fontSize: 20, letterSpacing: 6, color: C.gold, textTransform: 'uppercase', marginTop: 28}}>{label}</div>
  <div style={{fontFamily: serif, fontSize: nameSize(name) * .66, color: C.ivory, lineHeight: 1, marginTop: 12}}>{name}</div>
</div>;

const CoupleScene: React.FC<DreamWeddsWeddingProps> = (props) => {
  const data = resolveDreamWeddsDetails(props);
  return <AbsoluteFill><Background dim={.42} /><LanternGlow />
    <AbsoluteFill style={{padding: '125px 80px 110px', alignItems: 'center'}}>
      <Reveal style={{textAlign: 'center'}}><Eyebrow>With the blessings of Allah</Eyebrow></Reveal>
      <div style={{flex: 1, display: 'flex', gap: 50, alignItems: 'center', justifyContent: 'center'}}>
        <Reveal delay={10}><Portrait src={data.bride.imageUrl || props.photos?.[1]} name={data.bride.name} label="The Bride" position="42% center" /></Reveal>
        <Reveal delay={20}><Portrait src={data.groom.imageUrl || props.photos?.[2]} name={data.groom.name} label="The Groom" position="58% center" /></Reveal>
      </div>
      <Reveal delay={28} style={{fontFamily: serif, color: C.paleGold, fontSize: 38, fontStyle: 'italic'}}>Together with their families</Reveal>
    </AbsoluteFill>
  </AbsoluteFill>;
};

const NamesScene: React.FC<DreamWeddsWeddingProps> = (props) => {
  const data = resolveDreamWeddsDetails(props);
  return <AbsoluteFill><Background dim={.18} /><LanternGlow />
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '150px 100px 80px'}}>
      <Reveal><Eyebrow>Request the honour of your presence</Eyebrow></Reveal>
      <Reveal delay={12} style={{fontFamily: serif, color: C.ivory, fontSize: nameSize(data.bride.name), lineHeight: .94, marginTop: 55, textShadow: '0 4px 22px rgba(0,0,0,.55)'}}>{data.bride.name}</Reveal>
      <Reveal delay={19} style={{fontFamily: serif, color: C.gold, fontSize: 64, fontStyle: 'italic', margin: '22px 0'}}>&amp;</Reveal>
      <Reveal delay={26} style={{fontFamily: serif, color: C.ivory, fontSize: nameSize(data.groom.name), lineHeight: .94, textShadow: '0 4px 22px rgba(0,0,0,.55)'}}>{data.groom.name}</Reveal>
      <Reveal delay={34}><Divider /></Reveal>
      <Reveal delay={40} style={{fontFamily: serif, color: C.paleGold, fontSize: 47}}>as they begin their forever</Reveal>
    </AbsoluteFill>
  </AbsoluteFill>;
};

const EventScene: React.FC<DreamWeddsWeddingProps> = (props) => {
  const data = resolveDreamWeddsDetails(props);
  const date = data.event.formattedDate || data.formattedDate || props.eventDate;
  const venue = data.event.venue || props.venue.name || 'Venue to be announced';
  const city = data.event.city || props.venue.city;
  return <AbsoluteFill><Background dim={.14} /><LanternGlow />
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '150px 100px 70px'}}>
      <Reveal><Crescent size={62} /></Reveal>
      <Reveal delay={9} style={{fontFamily: serif, color: C.ivory, fontSize: 104, lineHeight: .96, fontWeight: 600, marginTop: 38}}>{data.event.title || 'Nikah Ceremony'}</Reveal>
      <Reveal delay={17}><Divider /></Reveal>
      <Reveal delay={23} style={{fontFamily: serif, color: C.ivory, fontSize: 48, lineHeight: 1.25}}>{date}</Reveal>
      <Reveal delay={30} style={{fontFamily: sans, color: C.paleGold, fontSize: 28, letterSpacing: 3, lineHeight: 1.5, marginTop: 30, maxWidth: 780}}>{venue}{city ? <><br/>{city}</> : null}</Reveal>
      <Reveal delay={38} style={{fontFamily: serif, color: C.ivory, fontSize: 42, fontStyle: 'italic', marginTop: 52}}>Your presence will make our joy complete</Reveal>
    </AbsoluteFill>
  </AbsoluteFill>;
};

const ClosingScene: React.FC<DreamWeddsWeddingProps> = (props) => {
  const data = resolveDreamWeddsDetails(props);
  return <AbsoluteFill><Background closing dim={.32} /><LanternGlow />
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '110px 110px 220px'}}>
      <Reveal><Eyebrow>Insha'Allah</Eyebrow></Reveal>
      <Reveal delay={10} style={{fontFamily: serif, color: C.ivory, fontSize: 68, lineHeight: 1.08, marginTop: 46}}>We look forward to<br/>celebrating with you</Reveal>
      <Reveal delay={20}><Divider /></Reveal>
      <Reveal delay={27} style={{fontFamily: serif, color: C.paleGold, fontSize: 62, fontStyle: 'italic', textShadow: '0 3px 18px rgba(0,0,0,.65)'}}>{data.bride.name} &amp; {data.groom.name}</Reveal>
      <Reveal delay={36} style={{fontFamily: sans, color: C.paleGold, fontSize: 20, letterSpacing: 8, textTransform: 'uppercase', marginTop: 70}}>DreamWedds</Reveal>
    </AbsoluteFill>
  </AbsoluteFill>;
};

export const EmeraldNikah: React.FC<DreamWeddsWeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const boundaries = [0, .18, .38, .59, .8, 1].map((part) => Math.round(part * durationInFrames));
  const volume = interpolate(frame, [0, fps, durationInFrames - fps * 2, durationInFrames], [0, .82, .82, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scenes = [OpeningScene, CoupleScene, NamesScene, EventScene, ClosingScene];
  return <AbsoluteFill style={{background: C.deep}}>
    {props.musicUrl ? <Audio src={props.musicUrl} volume={volume} /> : null}
    {scenes.map((Scene, index) => {
      const from = boundaries[index];
      const duration = boundaries[index + 1] - from;
      return <Sequence key={index} from={from} durationInFrames={duration}><FadeScene duration={duration}><Scene {...props} /></FadeScene></Sequence>;
    })}
  </AbsoluteFill>;
};
