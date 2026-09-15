import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadMontserrat} from '@remotion/google-fonts/Montserrat';
import {DreamWeddsWeddingProps, resolveDreamWeddsDetails} from '../types';

const {fontFamily: serif} = loadCormorant();
const {fontFamily: sans} = loadMontserrat();
const C = {wine: '#642840', plum: '#472033', rose: '#D99BA9', blush: '#F2D8D8', gold: '#D4AE67', ivory: '#FFF9F2'};

const FadeScene: React.FC<{duration: number; children: React.ReactNode}> = ({duration, children}) => {
  const frame = useCurrentFrame();
  const edge = Math.max(8, Math.min(18, Math.floor(duration / 4)));
  const opacity = interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

const Reveal: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({delay = 0, children, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const value = spring({frame: frame - delay, fps, config: {damping: 180, stiffness: 90}});
  return <div style={{opacity: value, transform: `translateY(${(1 - value) * 45}px)`, ...style}}>{children}</div>;
};

const PhotoBackground: React.FC<{src?: string; position?: string; shade?: number}> = ({src, position = 'center', shade = 0.38}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.04, 1.13], {extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{overflow: 'hidden', background: C.blush}}>
    {src ? <Img src={src} pauseWhenLoading style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: position, transform: `scale(${scale})`}} /> : null}
    <AbsoluteFill style={{background: `linear-gradient(180deg, rgba(50,20,34,${shade * .55}), rgba(50,20,34,${shade}) 58%, rgba(30,10,20,${Math.min(.82, shade + .2)}))`}} />
  </AbsoluteFill>;
};

const Petals: React.FC = () => {
  const frame = useCurrentFrame();
  const {height} = useVideoConfig();
  return <AbsoluteFill style={{overflow: 'hidden', pointerEvents: 'none'}}>
    {Array.from({length: 25}).map((_, i) => {
      const size = 12 + random(`rb-size-${i}`) * 22;
      const y = (random(`rb-y-${i}`) * (height + 400) + frame * (1.1 + random(`rb-speed-${i}`) * 1.4)) % (height + 300) - 150;
      return <div key={i} style={{position: 'absolute', left: random(`rb-x-${i}`) * 1080, top: y, width: size, height: size * .58, borderRadius: '80% 10% 80% 10%', background: i % 3 === 0 ? C.gold : C.rose, opacity: .18 + random(`rb-o-${i}`) * .28, transform: `rotate(${frame * (1 + random(`rb-r-${i}`) * 2) + i * 31}deg)`}} />;
    })}
  </AbsoluteFill>;
};

const OrnateFrame: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{position: 'relative', border: `3px solid ${C.gold}`, boxShadow: '0 30px 90px rgba(52,20,34,.28)', ...style}}>
    <div style={{position: 'absolute', inset: 13, border: '1px solid rgba(255,249,242,.8)', zIndex: 2, pointerEvents: 'none'}} />
    {children}
  </div>
);

const Eyebrow: React.FC<{children: React.ReactNode; light?: boolean}> = ({children, light = false}) => (
  <div style={{fontFamily: sans, fontSize: 25, fontWeight: 600, letterSpacing: 9, textTransform: 'uppercase', color: light ? C.ivory : C.wine}}>{children}</div>
);

const nameSize = (name: string) => name.length > 22 ? 72 : name.length > 16 ? 84 : 98;

const IntroScene: React.FC<DreamWeddsWeddingProps> = (props) => {
  const data = resolveDreamWeddsDetails(props);
  const src = data.banners[0] || props.photos?.[0];
  return <AbsoluteFill>
    <PhotoBackground src={src} shade={.46} />
    <Petals />
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', padding: '150px 92px 210px', textAlign: 'center'}}>
      <Reveal><Eyebrow light>Together with their families</Eyebrow></Reveal>
      <Reveal delay={10}><div style={{width: 180, height: 2, background: C.gold, margin: '34px auto'}} /></Reveal>
      <Reveal delay={18} style={{fontFamily: serif, fontSize: 112, lineHeight: 1.02, fontWeight: 600, color: C.ivory, textShadow: '0 5px 25px rgba(30,8,18,.6)'}}>
        A celebration<br/><span style={{fontStyle: 'italic', color: '#F7D9D5'}}>of forever</span>
      </Reveal>
    </AbsoluteFill>
  </AbsoluteFill>;
};

const Portrait: React.FC<{src?: string; name: string; align: 'left' | 'right'; label: string}> = ({src, name, align, label}) => (
  <div style={{width: 430, textAlign: 'center'}}>
    <OrnateFrame style={{height: 720, borderRadius: '220px 220px 20px 20px', overflow: 'hidden', background: C.blush}}>
      {src ? <Img src={src} pauseWhenLoading style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${align} center`}} /> : <div style={{height: '100%', display: 'grid', placeItems: 'center', fontFamily: serif, color: C.wine, fontSize: 130}}>{name.charAt(0)}</div>}
    </OrnateFrame>
    <div style={{fontFamily: sans, color: C.gold, marginTop: 38, textTransform: 'uppercase', letterSpacing: 8, fontSize: 22}}>{label}</div>
    <div style={{fontFamily: serif, color: C.plum, marginTop: 12, fontWeight: 600, fontSize: nameSize(name), lineHeight: .95}}>{name}</div>
  </div>
);

const CoupleScene: React.FC<DreamWeddsWeddingProps> = (props) => {
  const data = resolveDreamWeddsDetails(props);
  return <AbsoluteFill style={{background: `radial-gradient(circle at 50% 35%, #FFFDF8 0%, ${C.blush} 76%, #E9BFC4 100%)`, padding: '130px 70px'}}>
    <Petals />
    <Reveal style={{textAlign: 'center'}}><Eyebrow>Meet the couple</Eyebrow></Reveal>
    <div style={{flex: 1, display: 'flex', gap: 55, alignItems: 'center', justifyContent: 'center'}}>
      <Reveal delay={8}><Portrait src={data.bride.imageUrl || props.photos?.[1]} name={data.bride.name} align="left" label="The Bride" /></Reveal>
      <Reveal delay={18}><Portrait src={data.groom.imageUrl || props.photos?.[2]} name={data.groom.name} align="right" label="The Groom" /></Reveal>
    </div>
    <div style={{textAlign: 'center', color: C.gold, fontFamily: serif, fontSize: 54}}>❦</div>
  </AbsoluteFill>;
};

const NamesScene: React.FC<DreamWeddsWeddingProps> = (props) => {
  const data = resolveDreamWeddsDetails(props);
  const src = data.storyImageUrl || props.photos?.[4] || data.banners[2] || props.photos?.[0];
  return <AbsoluteFill>
    <PhotoBackground src={src} shade={.52} />
    <Petals />
    <AbsoluteFill style={{justifyContent: 'center', textAlign: 'center', padding: 90}}>
      <Reveal><Eyebrow light>Two hearts · one beautiful beginning</Eyebrow></Reveal>
      <Reveal delay={12} style={{fontFamily: serif, color: C.ivory, fontSize: nameSize(data.bride.name) + 20, fontWeight: 600, lineHeight: .98, marginTop: 56, textShadow: '0 5px 28px rgba(35,10,20,.8)'}}>{data.bride.name}</Reveal>
      <Reveal delay={20} style={{fontFamily: serif, color: C.gold, fontSize: 68, fontStyle: 'italic', margin: '18px 0'}}>&amp;</Reveal>
      <Reveal delay={28} style={{fontFamily: serif, color: C.ivory, fontSize: nameSize(data.groom.name) + 20, fontWeight: 600, lineHeight: .98, textShadow: '0 5px 28px rgba(35,10,20,.8)'}}>{data.groom.name}</Reveal>
    </AbsoluteFill>
  </AbsoluteFill>;
};

const EventScene: React.FC<DreamWeddsWeddingProps> = (props) => {
  const data = resolveDreamWeddsDetails(props);
  const src = data.event.imageUrl || props.photos?.[3] || data.banners[1] || data.banners[0];
  return <AbsoluteFill>
    <PhotoBackground src={src} shade={.56} />
    <Petals />
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: 90, textAlign: 'center'}}>
      <Reveal style={{background: 'rgba(73,25,46,.76)', border: `2px solid ${C.gold}`, padding: '90px 70px', width: 850, boxShadow: '0 35px 100px rgba(20,5,12,.45)'}}>
        <Eyebrow light>You are invited to the</Eyebrow>
        <div style={{fontFamily: serif, fontSize: 112, lineHeight: 1.05, color: C.ivory, fontWeight: 600, margin: '40px 0 34px'}}>{data.event.title}</div>
        <div style={{height: 2, width: 210, background: C.gold, margin: '0 auto 32px'}} />
        <div style={{fontFamily: sans, fontSize: 38, letterSpacing: 3, color: '#F9DED9'}}>{data.event.formattedDate || data.formattedDate || props.eventDate}</div>
      </Reveal>
    </AbsoluteFill>
  </AbsoluteFill>;
};

const VenueScene: React.FC<DreamWeddsWeddingProps> = (props) => {
  const data = resolveDreamWeddsDetails(props);
  const src = data.closingImageUrl || data.banners.at(-1) || props.photos?.at(-1);
  return <AbsoluteFill>
    <PhotoBackground src={src} shade={.58} />
    <Petals />
    <AbsoluteFill style={{justifyContent: 'flex-end', padding: '120px 90px 180px', textAlign: 'center', alignItems: 'center'}}>
      <Reveal><Eyebrow light>Save the date</Eyebrow></Reveal>
      <Reveal delay={10} style={{fontFamily: serif, color: C.ivory, fontSize: 78, fontWeight: 600, lineHeight: 1.08, marginTop: 38, maxWidth: 900}}>{data.event.venue || props.venue.name || 'Venue to be announced'}</Reveal>
      {data.event.city || props.venue.city ? <Reveal delay={16} style={{fontFamily: sans, color: '#F8DDD9', fontSize: 34, letterSpacing: 5, marginTop: 24}}>{data.event.city || props.venue.city}</Reveal> : null}
      <Reveal delay={22}><div style={{width: 170, height: 2, background: C.gold, margin: '42px auto 34px'}} /></Reveal>
      <Reveal delay={28} style={{fontFamily: serif, color: C.ivory, fontSize: 50, fontStyle: 'italic'}}>We cannot wait to celebrate with you</Reveal>
      <Reveal delay={36} style={{fontFamily: sans, color: C.gold, fontSize: 22, textTransform: 'uppercase', letterSpacing: 8, marginTop: 65}}>DreamWedds</Reveal>
    </AbsoluteFill>
  </AbsoluteFill>;
};

export const RoyalBlushWedding: React.FC<DreamWeddsWeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const boundaries = [0, 5, 11, 17, 24, 30].map((seconds) => Math.round(seconds * fps));
  const volume = interpolate(frame, [0, fps, durationInFrames - fps * 2, durationInFrames], [0, .82, .82, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scenes = [IntroScene, CoupleScene, NamesScene, EventScene, VenueScene];
  return <AbsoluteFill style={{background: C.ivory}}>
    {props.musicUrl ? <Audio src={props.musicUrl} volume={volume} /> : null}
    {scenes.map((Scene, index) => {
      const from = boundaries[index];
      const duration = index === scenes.length - 1 ? durationInFrames - from : boundaries[index + 1] - from;
      return <Sequence key={index} from={from} durationInFrames={duration}><FadeScene duration={duration}><Scene {...props} /></FadeScene></Sequence>;
    })}
  </AbsoluteFill>;
};
