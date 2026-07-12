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
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {WeddingProps} from './types';

const {fontFamily: playfair} = loadPlayfair();
const {fontFamily: inter} = loadInter();
const {fontFamily: cormorant} = loadCormorant();

const DEFAULT_DISPLAY_MESSAGE =
  "The moment we've all been waiting for — {{brideFirstName}} & {{groomFirstName}} invite you to witness their wedding vows{{#weddingDate}} on {{weddingDate}}{{/weddingDate}}{{#location}} in {{location}}{{/location}}.";

const plan = (df: number) => {
  const intro = Math.round(df * 0.1);
  const site1 = Math.round(df * 0.23);
  const site2 = Math.round(df * 0.23);
  const site3 = Math.round(df * 0.23);
  const outro = df - intro - site1 - site2 - site3;
  return {intro, site1, site2, site3, outro};
};

const SectionFade: React.FC<{duration: number; children: React.ReactNode}> = ({duration, children}) => {
  const frame = useCurrentFrame();
  const edge = Math.max(1, Math.min(10, Math.floor(duration / 2) - 1));
  const opacity = interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

const Rise: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  delay = 0,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - delay, fps, config: {damping: 200}});
  return <div style={{opacity: p, transform: `translateY(${(1 - p) * 34}px)`, ...style}}>{children}</div>;
};

// Cinematic camera rig: slow dolly + drift + subtle 3D tilt over the section
const Camera: React.FC<{
  duration: number;
  move: 'dollyIn' | 'panUp' | 'tiltDrift';
  children: React.ReactNode;
}> = ({duration, move, children}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, duration], [0, 1], {extrapolateRight: 'clamp'});
  const ease = t * t * (3 - 2 * t);
  let transform = '';
  if (move === 'dollyIn') {
    transform = `scale(${1.14 - ease * 0.12}) translateY(${(1 - ease) * 40}px) rotateX(${(1 - ease) * 3}deg)`;
  } else if (move === 'panUp') {
    transform = `scale(${1.06 + ease * 0.05}) translateY(${60 - ease * 130}px) rotateY(${-2 + ease * 4}deg)`;
  } else {
    transform = `scale(${1.04 + ease * 0.08}) translate(${(0.5 - ease) * 46}px, ${(ease - 0.4) * -50}px) rotateX(${ease * 2.5}deg) rotateY(${(0.5 - ease) * 3}deg)`;
  }
  return (
    <AbsoluteFill style={{perspective: 1400, justifyContent: 'center', alignItems: 'center'}}>
      <div style={{transform, transformStyle: 'preserve-3d'}}>{children}</div>
    </AbsoluteFill>
  );
};

// Sleek mobile browser frame
const BrowserFrame: React.FC<{url: string; dark?: boolean; children: React.ReactNode}> = ({
  url,
  dark,
  children,
}) => (
  <div
    style={{
      width: 900,
      height: 1580,
      borderRadius: 44,
      overflow: 'hidden',
      backgroundColor: dark ? '#17171C' : '#FFFFFF',
      boxShadow: '0 60px 140px rgba(0,0,0,0.45), 0 0 0 10px rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <div
      style={{
        height: 92,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '0 34px',
        backgroundColor: dark ? '#101014' : '#F4F1EC',
        borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        flexShrink: 0,
      }}
    >
      <div style={{display: 'flex', gap: 10}}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <div key={c} style={{width: 18, height: 18, borderRadius: '50%', backgroundColor: c}} />
        ))}
      </div>
      <div
        style={{
          flex: 1,
          height: 52,
          borderRadius: 26,
          backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: inter,
          fontSize: 24,
          color: dark ? 'rgba(255,255,255,0.7)' : '#6B6459',
          letterSpacing: 1,
        }}
      >
        <span style={{color: '#28C840', marginRight: 10, fontSize: 20}}>&#128274;</span>
        {url}
      </div>
    </div>
    <div style={{flex: 1, position: 'relative', overflow: 'hidden'}}>{children}</div>
  </div>
);

// Animated cursor that travels to a point then clicks (ripple)
const Cursor: React.FC<{
  from: {x: number; y: number};
  to: {x: number; y: number};
  start: number;
  clickAt: number;
  dark?: boolean;
}> = ({from, to, start, clickAt, dark}) => {
  const frame = useCurrentFrame();
  if (frame < start) return null;
  const travel = interpolate(frame, [start, clickAt], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const e = travel * travel * (3 - 2 * travel);
  const x = from.x + (to.x - from.x) * e;
  const y = from.y + (to.y - from.y) * e;
  const clicked = frame >= clickAt;
  const press = clicked ? interpolate(frame, [clickAt, clickAt + 6], [0.7, 1], {extrapolateRight: 'clamp'}) : 1;
  const ripple = clicked
    ? interpolate(frame, [clickAt, clickAt + 16], [0, 1], {extrapolateRight: 'clamp'})
    : 0;
  const fadeOut = interpolate(frame, [clickAt + 10, clickAt + 22], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{position: 'absolute', left: x, top: y, zIndex: 50, pointerEvents: 'none', opacity: fadeOut}}>
      {ripple > 0 && ripple < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: -40 * ripple,
            top: -40 * ripple,
            width: 80 * ripple,
            height: 80 * ripple,
            borderRadius: '50%',
            border: `3px solid ${dark ? '#D4AF37' : '#B4405F'}`,
            opacity: 1 - ripple,
          }}
        />
      ) : null}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          backgroundColor: dark ? 'rgba(255,255,255,0.9)' : 'rgba(20,20,20,0.85)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
          transform: `scale(${press})`,
        }}
      />
    </div>
  );
};

const NavBar: React.FC<{items: string[]; brand: string; dark?: boolean; accent: string; startDelay?: number}> = ({
  items,
  brand,
  dark,
  accent,
  startDelay = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '38px 52px',
      }}
    >
      <Rise delay={startDelay}>
        <div
          style={{
            fontFamily: playfair,
            fontSize: 38,
            fontStyle: 'italic',
            color: dark ? '#F5EFE2' : '#26211A',
          }}
        >
          {brand}
        </div>
      </Rise>
      <div style={{display: 'flex', gap: 34}}>
        {items.map((it, i) => {
          const p = spring({frame: frame - startDelay - 6 - i * 4, fps, config: {damping: 200}});
          return (
            <div
              key={it}
              style={{
                fontFamily: inter,
                fontSize: 23,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: dark ? 'rgba(245,239,226,0.85)' : '#4C453B',
                opacity: p,
                transform: `translateY(${(1 - p) * -18}px)`,
                borderBottom: i === 0 ? `3px solid ${accent}` : '3px solid transparent',
                paddingBottom: 6,
              }}
            >
              {it}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PhotoOrFallback: React.FC<{src?: string; style: React.CSSProperties; fallback: string; kenBurns?: boolean}> = ({
  src,
  style,
  fallback,
  kenBurns,
}) => {
  const frame = useCurrentFrame();
  const scale = kenBurns ? 1.05 + (frame / 900) * 0.12 : 1;
  if (!src) {
    return <div style={{...style, background: fallback}} />;
  }
  return (
    <div style={{...style, overflow: 'hidden'}}>
      <Img
        src={src}
        pauseWhenLoading
        style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`}}
      />
    </div>
  );
};

// ---------- SITE 1: Classic Ivory ----------
const SiteClassic: React.FC<WeddingProps & {sectionDuration: number}> = (props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const clickAt = Math.round(props.sectionDuration * 0.62);
  const rsvped = frame >= clickAt + 4;
  const toastP = spring({frame: frame - clickAt - 6, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{backgroundColor: '#FBF7F0'}}>
      <NavBar
        brand={`${props.couple.partnerOne} & ${props.couple.partnerTwo}`}
        items={['Home', 'Story', 'RSVP']}
        accent="#B08D57"
        startDelay={4}
      />
      <div style={{padding: '10px 52px 0'}}>
        <Rise delay={14}>
          <PhotoOrFallback
            src={props.photos?.[0]}
            kenBurns
            fallback="linear-gradient(135deg, #E8DCC8 0%, #D9C6A5 100%)"
            style={{width: '100%', height: 620, borderRadius: 24}}
          />
        </Rise>
      </div>
      <div style={{textAlign: 'center', padding: '54px 60px 0'}}>
        <Rise delay={22}>
          <div style={{fontFamily: inter, fontSize: 22, letterSpacing: 10, textTransform: 'uppercase', color: '#B08D57'}}>
            We're Getting Married
          </div>
        </Rise>
        <Rise delay={28}>
          <div style={{fontFamily: playfair, fontSize: 92, fontStyle: 'italic', color: '#26211A', lineHeight: 1.1, marginTop: 24}}>
            {props.couple.partnerOne}
            <span style={{color: '#B08D57'}}> &amp; </span>
            {props.couple.partnerTwo}
          </div>
        </Rise>
        <Rise delay={36}>
          <div style={{fontFamily: cormorant, fontSize: 40, color: '#4C453B', marginTop: 26}}>
            {props.eventDate} &middot; {props.venue.city}
          </div>
        </Rise>
        <Rise delay={42}>
          <div style={{display: 'flex', justifyContent: 'center', marginTop: 46}}>
            <div
              style={{
                padding: '26px 84px',
                borderRadius: 999,
                backgroundColor: rsvped ? '#2E7D32' : '#26211A',
                color: '#FBF7F0',
                fontFamily: inter,
                fontSize: 30,
                letterSpacing: 6,
                textTransform: 'uppercase',
                transform: `scale(${frame >= clickAt && frame < clickAt + 5 ? 0.94 : 1})`,
                transition: 'none',
              }}
            >
              {rsvped ? 'See You There ✓' : 'RSVP Now'}
            </div>
          </div>
        </Rise>
        {rsvped ? (
          <div
            style={{
              marginTop: 34,
              opacity: toastP,
              transform: `translateY(${(1 - toastP) * 20}px)`,
              display: 'inline-block',
              padding: '16px 36px',
              borderRadius: 14,
              backgroundColor: '#EFE7D8',
              fontFamily: cormorant,
              fontSize: 30,
              color: '#6B5E43',
            }}
          >
            Your RSVP has been received with love
          </div>
        ) : null}
      </div>
      <Cursor from={{x: 720, y: 1360}} to={{x: 452, y: 1218}} start={Math.round(clickAt * 0.55)} clickAt={clickAt} />
    </AbsoluteFill>
  );
};

// ---------- SITE 2: Botanical Garden with live countdown ----------
const Flip: React.FC<{value: string; label: string; delay: number}> = ({value, label, delay}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - delay, fps, config: {damping: 200}});
  return (
    <div style={{textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 30}px)`}}>
      <div
        style={{
          width: 172,
          height: 190,
          borderRadius: 20,
          backgroundColor: '#31473A',
          color: '#F2F5EE',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: playfair,
          fontSize: 84,
          boxShadow: '0 18px 40px rgba(49,71,58,0.35)',
        }}
      >
        {value}
      </div>
      <div style={{fontFamily: inter, fontSize: 22, letterSpacing: 5, textTransform: 'uppercase', color: '#5C7360', marginTop: 16}}>
        {label}
      </div>
    </div>
  );
};

const Leaf: React.FC<{x: number; y: number; rotate: number; size: number; flip?: boolean}> = ({x, y, rotate, size, flip}) => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame / 22) * 4;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `rotate(${rotate + sway}deg) ${flip ? 'scaleX(-1)' : ''}`,
        opacity: 0.5,
      }}
    >
      <path d="M50 5 C80 30 85 70 50 95 C15 70 20 30 50 5 Z" fill="#7A9B76" />
      <line x1="50" y1="10" x2="50" y2="90" stroke="#5C7360" strokeWidth="2" />
    </svg>
  );
};

const SiteBotanical: React.FC<WeddingProps & {sectionDuration: number}> = (props) => {
  const frame = useCurrentFrame();
  const secs = Math.max(0, 59 - Math.floor(frame / 6) % 60);
  return (
    <AbsoluteFill style={{backgroundColor: '#F2F5EE'}}>
      <Leaf x={-30} y={140} rotate={-40} size={220} />
      <Leaf x={740} y={90} rotate={35} size={190} flip />
      <Leaf x={700} y={1180} rotate={140} size={240} />
      <Leaf x={-40} y={1260} rotate={-130} size={200} flip />
      <NavBar
        brand={`${props.couple.partnerOne.charAt(0)} & ${props.couple.partnerTwo.charAt(0)}`}
        items={['Details', 'Gallery', 'Registry']}
        accent="#7A9B76"
        startDelay={4}
      />
      <div style={{textAlign: 'center', padding: '30px 60px 0'}}>
        <Rise delay={12}>
          <div style={{fontFamily: cormorant, fontSize: 36, fontStyle: 'italic', color: '#5C7360'}}>
            Down the garden path to forever
          </div>
        </Rise>
        <Rise delay={18}>
          <div style={{fontFamily: playfair, fontSize: 96, color: '#31473A', lineHeight: 1.12, marginTop: 20}}>
            {props.couple.partnerOne}
            <br />
            <span style={{fontStyle: 'italic', fontSize: 60, color: '#7A9B76'}}>and</span>
            <br />
            {props.couple.partnerTwo}
          </div>
        </Rise>
      </div>
      <div style={{padding: '54px 60px 0'}}>
        <Rise delay={28}>
          <PhotoOrFallback
            src={props.photos?.[1] ?? props.photos?.[0]}
            kenBurns
            fallback="linear-gradient(135deg, #C9D8C5 0%, #A8BFA3 100%)"
            style={{width: '100%', height: 460, borderRadius: '240px 240px 24px 24px'}}
          />
        </Rise>
      </div>
      <div style={{textAlign: 'center', marginTop: 56}}>
        <Rise delay={34}>
          <div style={{fontFamily: inter, fontSize: 24, letterSpacing: 8, textTransform: 'uppercase', color: '#31473A'}}>
            Counting down to {props.eventDate}
          </div>
        </Rise>
        <div style={{display: 'flex', justifyContent: 'center', gap: 30, marginTop: 36}}>
          <Flip value="128" label="Days" delay={40} />
          <Flip value="14" label="Hours" delay={45} />
          <Flip value="32" label="Minutes" delay={50} />
          <Flip value={String(secs).padStart(2, '0')} label="Seconds" delay={55} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- SITE 3: Editorial Dark with self-typing RSVP ----------
const SiteEditorial: React.FC<WeddingProps & {sectionDuration: number}> = (props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const typed = 'Yes, I will be there!';
  const typeStart = Math.round(props.sectionDuration * 0.42);
  const chars = Math.max(0, Math.min(typed.length, Math.floor((frame - typeStart) / 2)));
  const clickAt = typeStart + typed.length * 2 + 10;
  const sent = frame >= clickAt + 4;
  const sentP = spring({frame: frame - clickAt - 4, fps, config: {damping: 200}});
  const gallery = (props.photos ?? []).slice(0, 3);
  const drift = interpolate(frame, [0, props.sectionDuration], [0, -160]);
  return (
    <AbsoluteFill style={{backgroundColor: '#101014'}}>
      <NavBar
        brand={`${props.couple.partnerOne.toUpperCase()} — ${props.couple.partnerTwo.toUpperCase()}`}
        items={['Editorial', 'RSVP']}
        accent="#D4AF37"
        dark
        startDelay={4}
      />
      <div style={{padding: '20px 52px 0'}}>
        <Rise delay={12}>
          <div style={{fontFamily: inter, fontSize: 22, letterSpacing: 12, textTransform: 'uppercase', color: '#D4AF37'}}>
            The Wedding Issue — {props.eventDate}
          </div>
        </Rise>
        <Rise delay={18}>
          <div
            style={{
              fontFamily: playfair,
              fontSize: 110,
              color: '#F5EFE2',
              lineHeight: 1.02,
              marginTop: 24,
              textTransform: 'uppercase',
              letterSpacing: -2,
            }}
          >
            {props.couple.partnerOne}
            <br />
            <span style={{fontStyle: 'italic', color: '#D4AF37', textTransform: 'none'}}>weds</span>{' '}
            {props.couple.partnerTwo}
          </div>
        </Rise>
        <Rise delay={26}>
          <div style={{fontFamily: cormorant, fontSize: 34, color: 'rgba(245,239,226,0.75)', marginTop: 22}}>
            {props.venue.name}, {props.venue.city}
          </div>
        </Rise>
      </div>
      <div style={{marginTop: 48, overflow: 'hidden'}}>
        <div style={{display: 'flex', gap: 24, paddingLeft: 52, transform: `translateX(${drift}px)`, width: 2000}}>
          {(gallery.length ? gallery : [undefined, undefined, undefined]).map((src, i) => (
            <PhotoOrFallback
              key={i}
              src={src}
              fallback={`linear-gradient(160deg, ${['#2A2A33', '#3A3226', '#22262E'][i % 3]} 0%, #17171C 100%)`}
              style={{width: 380, height: 480, borderRadius: 18, flexShrink: 0}}
            />
          ))}
        </div>
      </div>
      <div style={{padding: '52px 52px 0'}}>
        <Rise delay={34}>
          <div style={{fontFamily: inter, fontSize: 22, letterSpacing: 6, textTransform: 'uppercase', color: 'rgba(245,239,226,0.6)', marginBottom: 18}}>
            RSVP
          </div>
          <div
            style={{
              borderRadius: 16,
              border: '1px solid rgba(212,175,55,0.4)',
              backgroundColor: 'rgba(255,255,255,0.04)',
              padding: '30px 34px',
              fontFamily: cormorant,
              fontSize: 38,
              color: '#F5EFE2',
              minHeight: 104,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {typed.slice(0, chars)}
            <span
              style={{
                display: 'inline-block',
                width: 3,
                height: 44,
                backgroundColor: '#D4AF37',
                marginLeft: 6,
                opacity: Math.floor(frame / 12) % 2 === 0 ? 1 : 0,
              }}
            />
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 28, marginTop: 28}}>
            <div
              style={{
                padding: '22px 70px',
                backgroundColor: sent ? '#2E7D32' : '#D4AF37',
                color: '#101014',
                fontFamily: inter,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: 5,
                textTransform: 'uppercase',
                borderRadius: 6,
                transform: `scale(${frame >= clickAt && frame < clickAt + 5 ? 0.94 : 1})`,
              }}
            >
              {sent ? 'Sent ✓' : 'Send RSVP'}
            </div>
            {sent ? (
              <div style={{fontFamily: cormorant, fontSize: 30, color: '#D4AF37', opacity: sentP}}>
                We can't wait to celebrate with you
              </div>
            ) : null}
          </div>
        </Rise>
      </div>
      <Cursor from={{x: 760, y: 1440}} to={{x: 220, y: 1388}} start={clickAt - 24} clickAt={clickAt} dark />
    </AbsoluteFill>
  );
};

// ---------- Intro ----------
const Intro: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const line = spring({frame: frame - 4, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{backgroundColor: '#0E0D0B', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 90}}>
      <Rise delay={2}>
        <div style={{fontFamily: inter, fontSize: 26, letterSpacing: 14, textTransform: 'uppercase', color: '#B08D57'}}>
          Introducing
        </div>
      </Rise>
      <Rise delay={8}>
        <div style={{fontFamily: playfair, fontSize: 96, fontStyle: 'italic', color: '#F5EFE2', marginTop: 34, lineHeight: 1.15}}>
          Your love story,
          <br />
          beautifully online
        </div>
      </Rise>
      <div style={{width: 320 * line, height: 2, backgroundColor: '#B08D57', marginTop: 50}} />
      <Rise delay={16}>
        <div style={{fontFamily: cormorant, fontSize: 38, color: 'rgba(245,239,226,0.7)', marginTop: 40}}>
          Three signature styles. One unforgettable website.
        </div>
      </Rise>
    </AbsoluteFill>
  );
};

const firstName = (name: string) => (name || '').trim().split(/\s+/)[0] || name || '';

const locationText = (venue: WeddingProps['venue']) =>
  [venue?.name, venue?.city].filter(Boolean).join(', ');

const resolveDisplayMessage = (props: WeddingProps) => {
  const values: Record<string, string> = {
    brideFirstName: firstName(props.couple.partnerOne),
    groomFirstName: firstName(props.couple.partnerTwo),
    weddingDate: props.eventDate || '',
    location: locationText(props.venue),
  };
  const template = props.displayMessage?.trim() || DEFAULT_DISPLAY_MESSAGE;
  return template
    .replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, content) =>
      values[key] ? content : ''
    )
    .replace(/\{\{(\w+)\}\}/g, (_match, key) => values[key] || '')
    .replace(/\s+/g, ' ')
    .trim();
};

// ---------- Outro: typed message + DreamWedds logo ----------
const Outro: React.FC<{duration: number; props: WeddingProps}> = ({duration, props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const message = resolveDisplayMessage(props);
  const typedChars = Math.floor(
    interpolate(frame, [8, Math.max(24, duration - 82)], [0, message.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const visibleMessage = message.slice(0, typedChars);
  const showCursor = typedChars < message.length || frame % 18 < 9;
  const coupleName = `${firstName(props.couple.partnerOne)} & ${firstName(props.couple.partnerTwo)}`;
  const accentReveal = spring({frame: frame - 2, fps, config: {damping: 180}});
  const glowDrift = interpolate(frame, [0, duration], [-18, 18], {extrapolateRight: 'clamp'});
  const footerReveal = spring({frame: frame - Math.max(18, duration - 76), fps, config: {damping: 200}});
  const backgroundPhoto = props.photos?.[0];
  const backgroundScale = 1.06 + interpolate(frame, [0, duration], [0, 0.08], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(circle at 18% 12%, rgba(232,178,157,0.24), transparent 30%), radial-gradient(circle at 86% 82%, rgba(176,141,87,0.18), transparent 34%), linear-gradient(135deg, #171312 0%, #0E0D0B 48%, #211718 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: '78px 86px 70px',
        overflow: 'hidden',
      }}
    >
      {backgroundPhoto ? (
        <Img
          src={backgroundPhoto}
          pauseWhenLoading
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${backgroundScale})`,
            filter: 'saturate(0.8) contrast(0.92)',
            opacity: 0.72,
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          zIndex: 1,
          background:
            'linear-gradient(180deg, rgba(16,10,12,0.58) 0%, rgba(18,11,13,0.3) 35%, rgba(12,9,10,0.78) 100%), linear-gradient(90deg, rgba(28,13,17,0.45), rgba(20,12,13,0.08) 50%, rgba(24,14,12,0.5))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          zIndex: 1,
          width: 860,
          height: 860,
          borderRadius: '50%',
          border: '1px solid rgba(242,208,171,0.18)',
          transform: `translate(${glowDrift}px, -24px) rotate(${frame * 0.025}deg)`,
          boxShadow: '0 0 0 34px rgba(242,208,171,0.025), 0 0 120px rgba(218,151,128,0.12)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          zIndex: 1,
          top: 66,
          left: 74,
          width: 170,
          height: 170,
          borderRadius: '50%',
          border: '1px solid rgba(212,175,55,0.5)',
          opacity: accentReveal,
          transform: `rotate(${frame * -0.12}deg) scale(${0.9 + accentReveal * 0.1})`,
        }}
      >
        <div style={{position: 'absolute', top: -3, left: '50%', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#D4AF37'}} />
      </div>
      <div
        style={{
          position: 'absolute',
          zIndex: 1,
          right: 82,
          bottom: 92,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'rgba(220,158,137,0.11)',
          filter: 'blur(2px)',
        }}
      />

      <Rise delay={4} style={{width: '100%', maxWidth: 1030, zIndex: 2}}>
        <div
          style={{
            position: 'relative',
            minHeight: 570,
            padding: '66px 78px 72px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            border: '1px solid rgba(245,239,226,0.2)',
            borderRadius: 36,
            background: 'linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.035))',
            boxShadow: '0 34px 100px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{fontFamily: inter, fontSize: 21, fontWeight: 700, letterSpacing: 7, textTransform: 'uppercase', color: '#D4AF37', marginBottom: 38}}>
            A new chapter begins
          </div>
          <div style={{width: 88, height: 1, backgroundColor: '#D4AF37', marginBottom: 42, opacity: accentReveal}} />
          <div
            style={{
              maxWidth: 860,
              color: '#FFF8ED',
              fontFamily: playfair,
              fontSize: 66,
              fontWeight: 700,
              lineHeight: 1.22,
              letterSpacing: -0.5,
              textShadow: '0 12px 40px rgba(0,0,0,0.32)',
            }}
          >
            {visibleMessage}
            <span style={{color: '#E4B955', opacity: showCursor ? 1 : 0, fontFamily: inter, fontWeight: 400}}>|</span>
          </div>
          <div style={{fontFamily: cormorant, fontSize: 30, fontStyle: 'italic', color: 'rgba(255,248,237,0.65)', marginTop: 42}}>
            with love, laughter, and a lifetime ahead
          </div>
        </div>
      </Rise>

      <div
        style={{
          position: 'absolute',
          bottom: 48,
          left: 86,
          right: 86,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 34,
          opacity: footerReveal,
          transform: `translateY(${(1 - footerReveal) * 18}px)`,
          zIndex: 3,
        }}
      >
        <div style={{height: 1, width: 160, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.7))'}} />
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7}}>
          <Img
            src={staticFile('logo.png')}
            style={{
              width: 205,
              height: 78,
              objectFit: 'contain',
              filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.36))',
            }}
          />
          <div
            style={{
              color: 'rgba(255,248,237,0.78)',
              fontFamily: inter,
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: 2.2,
              lineHeight: 1.3,
              textTransform: 'uppercase',
            }}
          >
            Created with love by DreamWedds for {coupleName}
          </div>
        </div>
        <div style={{height: 1, width: 160, background: 'linear-gradient(90deg, rgba(212,175,55,0.7), transparent)'}} />
      </div>
    </AbsoluteFill>
  );
};

const StageBackdrop: React.FC<{colors: [string, string]}> = ({colors}) => (
  <AbsoluteFill style={{background: `radial-gradient(circle at 50% 30%, ${colors[0]} 0%, ${colors[1]} 70%)`}} />
);

export const Showcase: React.FC<WeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const p = plan(durationInFrames);
  const frame = useCurrentFrame();
  const musicVolume = interpolate(
    frame,
    [0, fps, durationInFrames - 2 * fps, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );
  const url = `dreamwedds.com/${props.couple.partnerOne.toLowerCase()}-${props.couple.partnerTwo.toLowerCase()}`;

  return (
    <AbsoluteFill style={{backgroundColor: '#0E0D0B', fontFamily: inter}}>
      {props.musicUrl ? <Audio src={props.musicUrl} volume={musicVolume} /> : null}

      <Sequence durationInFrames={p.intro}>
        <SectionFade duration={p.intro}>
          <Intro duration={p.intro} />
        </SectionFade>
      </Sequence>

      <Sequence from={p.intro} durationInFrames={p.site1}>
        <SectionFade duration={p.site1}>
          <StageBackdrop colors={['#3B342A', '#0E0D0B']} />
          <Camera duration={p.site1} move="dollyIn">
            <BrowserFrame url={url}>
              <SiteClassic {...props} sectionDuration={p.site1} />
            </BrowserFrame>
          </Camera>
        </SectionFade>
      </Sequence>

      <Sequence from={p.intro + p.site1} durationInFrames={p.site2}>
        <SectionFade duration={p.site2}>
          <StageBackdrop colors={['#26332A', '#0B0F0C']} />
          <Camera duration={p.site2} move="panUp">
            <BrowserFrame url={url}>
              <SiteBotanical {...props} sectionDuration={p.site2} />
            </BrowserFrame>
          </Camera>
        </SectionFade>
      </Sequence>

      <Sequence from={p.intro + p.site1 + p.site2} durationInFrames={p.site3}>
        <SectionFade duration={p.site3}>
          <StageBackdrop colors={['#2A2416', '#0B0A08']} />
          <Camera duration={p.site3} move="tiltDrift">
            <BrowserFrame url={url} dark>
              <SiteEditorial {...props} sectionDuration={p.site3} />
            </BrowserFrame>
          </Camera>
        </SectionFade>
      </Sequence>

      <Sequence from={p.intro + p.site1 + p.site2 + p.site3} durationInFrames={p.outro}>
        <SectionFade duration={p.outro}>
          <Outro duration={p.outro} props={props} />
        </SectionFade>
      </Sequence>
    </AbsoluteFill>
  );
};
