import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadOutfit} from '@remotion/google-fonts/Outfit';

const {fontFamily: serif} = loadCormorant();
const {fontFamily: sans} = loadOutfit();

// Premium, brand-wide closing screen — dark plum/burgundy with rose-gold and
// magenta light. Used as the final beat of every reel regardless of that
// reel's own palette, so InvitaVideos always signs off the same polished way.
const COL = {
  top: '#160812',
  mid1: '#3B1224',
  mid2: '#4A1A2C',
  bottom: '#0F050A',
  cream: '#FFF6EC',
  gold: '#F3C77A',
  blush: '#F3B6B0',
  magenta: '#E8447E',
  roseGold: '#D98F7B',
};

// The choreography below is authored against a 135-frame (4.5s @30fps)
// reference cut. `at()` rescales every beat proportionally so the same
// sequence of moments still reads correctly if a template hands this
// component a shorter or longer outro (e.g. 60 frames for a 10s reel).
const REFERENCE = 135;

type Beat = [number, number];

const useBeats = (durationInFrames: number) => {
  const at = (f: number) => (f / REFERENCE) * durationInFrames;
  return {
    at,
    bg: [at(0), at(14)] as Beat,
    glowBloom: [at(0), at(40)] as Beat,
    label: [at(5), at(18)] as Beat,
    logo: [at(14), at(34)] as Beat,
    subtitle: [at(32), at(48)] as Beat,
    flare: [at(46), at(60)] as Beat,
    website: [at(58), at(78)] as Beat,
    divider: [at(76), at(92)] as Beat,
    tagline: [at(84), at(99)] as Beat,
    sparkleWindow: [at(8), at(125)] as Beat,
    pulse: [at(99), at(119)] as Beat,
    hold: [at(119), at(135)] as Beat,
  };
};

// ---------- Layers ----------

const BackgroundGradient: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, beat, [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scale = interpolate(frame, beat, [0.96, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: COL.bottom}}>
      <div
        style={{
          position: 'absolute',
          inset: '-6%',
          opacity,
          transform: `scale(${scale})`,
          background: `linear-gradient(180deg, ${COL.top} 0%, ${COL.mid1} 38%, ${COL.mid2} 64%, ${COL.bottom} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const RadialGlow: React.FC<{beat: Beat; pulseFactor: number}> = ({beat, pulseFactor}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, beat, [0, 0.9], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scale = interpolate(frame, beat, [0.7, 1.15], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{opacity: opacity * pulseFactor, mixBlendMode: 'screen', pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${scale})`,
          background:
            'radial-gradient(38% 26% at 50% 37%, rgba(243,182,176,.55), transparent 62%), ' +
            'radial-gradient(46% 30% at 50% 40%, rgba(232,68,126,.28), transparent 68%), ' +
            'radial-gradient(50% 34% at 50% 42%, rgba(243,199,122,.22), transparent 72%)',
        }}
      />
    </AbsoluteFill>
  );
};

const HeartIcon: React.FC<{size?: number}> = ({size = 26}) => (
  <svg width={size} height={size * 0.92} viewBox="0 0 32 29" fill="none">
    <path
      d="M16 28C16 28 2 19.4 2 9.8C2 5 5.6 2 9.6 2C12.4 2 14.6 3.6 16 6C17.4 3.6 19.6 2 22.4 2C26.4 2 30 5 30 9.8C30 19.4 16 28 16 28Z"
      stroke={COL.gold}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const TopBrandLabel: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, beat, [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ty = interpolate(frame, beat, [15, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const letterSpacing = interpolate(frame, beat, [10, 6], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const lineW = interpolate(frame, beat, [0, 120], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const heartScale = interpolate(frame, beat, [0.8, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: '13%', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity}}>
      <div
        style={{
          transform: `translateY(${ty}px)`,
          fontFamily: sans,
          fontSize: 30,
          letterSpacing,
          textTransform: 'uppercase',
          color: COL.gold,
          textShadow: '0 0 18px rgba(243,199,122,.55)',
        }}
      >
        Made with love on
      </div>
      <div style={{marginTop: 18, display: 'flex', alignItems: 'center', gap: 16}}>
        <div style={{width: lineW, height: 1, background: `linear-gradient(90deg, transparent, ${COL.gold})`}} />
        <div style={{transform: `scale(${heartScale})`}}>
          <HeartIcon />
        </div>
        <div style={{width: lineW, height: 1, background: `linear-gradient(90deg, ${COL.gold}, transparent)`}} />
      </div>
    </div>
  );
};

const LogoHero: React.FC<{beat: Beat; pulseFactor: number}> = ({beat, pulseFactor}) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, beat, [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scale = interpolate(frame, beat, [0.9, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ty = interpolate(frame, beat, [20, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // Glow builds in during the reveal, then tracks the shared pulse/hold factor.
  const glowAlpha = Math.min(reveal, 1) * pulseFactor;

  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: '33%', display: 'flex', justifyContent: 'center', opacity: reveal, transform: `translateY(${ty}px) scale(${scale})`}}>
      <Img
        src={staticFile('logo.png')}
        style={{
          width: 660,
          height: 'auto',
          filter:
            `drop-shadow(0 0 6px rgba(255,255,255,${(0.4 * glowAlpha).toFixed(3)})) ` +
            `drop-shadow(0 0 16px rgba(255,80,160,${(0.36 * glowAlpha).toFixed(3)})) ` +
            `drop-shadow(0 0 34px rgba(255,150,90,${(0.26 * glowAlpha).toFixed(3)})) ` +
            `drop-shadow(0 0 58px rgba(243,199,122,${(0.18 * glowAlpha).toFixed(3)}))`,
        }}
      />
    </div>
  );
};

// "WEDDING STORIES IN MOTION" — sits directly under the logo, flanked by thin
// lines matching the top label's ornamental treatment, in a softer rose tone.
const SubtitleLine: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, beat, [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ty = interpolate(frame, beat, [10, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const lineW = interpolate(frame, beat, [0, 90], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: '49%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, opacity, transform: `translateY(${ty}px)`}}>
      <div style={{width: lineW, height: 1, background: `linear-gradient(90deg, transparent, ${COL.roseGold})`}} />
      <div style={{fontFamily: sans, fontSize: 22, letterSpacing: 5, textTransform: 'uppercase', color: COL.roseGold, whiteSpace: 'nowrap', textShadow: '0 0 14px rgba(217,143,123,.5)'}}>
        Wedding Stories in Motion
      </div>
      <div style={{width: lineW, height: 1, background: `linear-gradient(90deg, ${COL.roseGold}, transparent)`}} />
    </div>
  );
};

const CenterLensFlare: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const mid = beat[0] + (beat[1] - beat[0]) * 0.55;
  const scaleX = interpolate(frame, [beat[0], mid, beat[1]], [0, 1.2, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const opacity = interpolate(frame, [beat[0], beat[0] + (beat[1] - beat[0]) * 0.4, beat[1]], [0, 1, 0.6], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: '54%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity}}>
      {/* Soft wide haze behind the sharp streak — the cinematic "bloom" band. */}
      <div
        style={{
          position: 'absolute',
          width: '96%',
          height: 46,
          transform: `scaleX(${scaleX})`,
          background: `linear-gradient(90deg, transparent, rgba(255,150,120,.28), rgba(243,199,122,.32), rgba(255,150,120,.28), transparent)`,
          filter: 'blur(18px)',
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 46,
          height: 46,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,.95), rgba(243,199,122,.45) 50%, transparent 74%)',
          filter: 'blur(3px)',
        }}
      />
      <div
        style={{
          width: '94%',
          height: 3,
          transform: `scaleX(${scaleX})`,
          background: `linear-gradient(90deg, transparent, ${COL.cream}, ${COL.gold}, ${COL.cream}, transparent)`,
        }}
      />
    </div>
  );
};

const WebsiteText: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, beat, [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ty = interpolate(frame, beat, [14, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const blur = interpolate(frame, beat, [6, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '61%',
        textAlign: 'center',
        opacity,
        transform: `translateY(${ty}px)`,
        filter: `blur(${blur}px)`,
        fontFamily: sans,
        fontSize: 56,
        letterSpacing: 2,
        color: COL.cream,
        textShadow: '0 0 22px rgba(255,246,236,.35)',
      }}
    >
      InvitaVideos.com
    </div>
  );
};

const Divider: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const lineScale = interpolate(frame, beat, [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const diamondScale = interpolate(frame, beat, [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: '70%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16}}>
      <div style={{width: 150, height: 1, transform: `scaleX(${lineScale})`, background: `linear-gradient(90deg, transparent, ${COL.roseGold})`}} />
      <div style={{width: 9, height: 9, transform: `rotate(45deg) scale(${diamondScale})`, background: COL.gold, boxShadow: '0 0 10px rgba(243,199,122,.6)'}} />
      <div style={{width: 150, height: 1, transform: `scaleX(${lineScale})`, background: `linear-gradient(90deg, ${COL.roseGold}, transparent)`}} />
    </div>
  );
};

const Tagline: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, beat, [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ty = interpolate(frame, beat, [10, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '76%',
        textAlign: 'center',
        opacity,
        transform: `translateY(${ty}px)`,
        fontFamily: serif,
        fontStyle: 'italic',
        fontSize: 36,
        color: COL.blush,
      }}
    >
      Create your own reel in minutes
    </div>
  );
};

// Bold sweeping curves of light across the bottom ~30% of the frame — each
// curve stays constantly visible (matching a settled hero-frame look) while a
// brighter "comet" highlight continuously travels along it for motion.
const CURVES = [
  {
    id: 'a',
    d: 'M -100 420 C 150 460, 350 260, 550 300 C 750 340, 900 200, 1180 260',
    stops: [COL.magenta, COL.gold],
    coreWidth: 11,
    glowWidth: 64,
    coreOpacity: 0.85,
    glowOpacity: 0.42,
    speed: 1,
    dash: 160,
  },
  {
    id: 'b',
    d: 'M -100 360 C 150 400, 380 200, 580 240 C 780 280, 950 140, 1180 200',
    stops: [COL.roseGold, COL.blush],
    coreWidth: 8,
    glowWidth: 52,
    coreOpacity: 0.65,
    glowOpacity: 0.34,
    speed: -0.8,
    dash: 130,
  },
  {
    id: 'c',
    d: 'M -100 470 C 180 500, 380 320, 560 360 C 760 400, 920 260, 1180 320',
    stops: [COL.gold, COL.magenta],
    coreWidth: 9,
    glowWidth: 56,
    coreOpacity: 0.7,
    glowOpacity: 0.36,
    speed: 1.2,
    dash: 150,
  },
  {
    id: 'd',
    d: 'M -100 500 C 200 520, 420 400, 600 430 C 800 460, 950 360, 1180 400',
    stops: [COL.blush, 'transparent'],
    coreWidth: 6,
    glowWidth: 44,
    coreOpacity: 0.45,
    glowOpacity: 0.26,
    speed: -0.65,
    dash: 110,
  },
];

const BottomLightRibbons: React.FC<{durationInFrames: number}> = ({durationInFrames}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{overflow: 'hidden', pointerEvents: 'none', mixBlendMode: 'screen', bottom: 0, top: 'auto', height: '34%'}}>
      <svg width="100%" height="100%" viewBox="0 0 1080 560" preserveAspectRatio="none" style={{position: 'absolute', bottom: 0, left: 0}}>
        <defs>
          {CURVES.map((c) => (
            <linearGradient key={c.id} id={`grad-${c.id}`} x1="0" y1="0" x2="1080" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor={c.stops[0]} />
              <stop offset="100%" stopColor={c.stops[1]} />
            </linearGradient>
          ))}
        </defs>
        {CURVES.map((c) => {
          const dashOffset = -((frame / durationInFrames) * 900 * c.speed);
          return (
            <g key={c.id}>
              {/* Soft blurred glow pass */}
              <path d={c.d} stroke={`url(#grad-${c.id})`} strokeWidth={c.glowWidth} fill="none" opacity={c.glowOpacity} strokeLinecap="round" style={{filter: 'blur(22px)'}} />
              {/* Constantly-visible core line */}
              <path d={c.d} stroke={`url(#grad-${c.id})`} strokeWidth={c.coreWidth} fill="none" opacity={c.coreOpacity} strokeLinecap="round" />
              {/* Traveling bright highlight — the "flowing" motion */}
              <path
                d={c.d}
                stroke="rgba(255,250,240,.85)"
                strokeWidth={c.coreWidth + 1.5}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${c.dash} 2000`}
                strokeDashoffset={dashOffset}
                opacity={0.8}
              />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// A modest field of soft sparks riding near the light curves — never a dense
// particle wash. A few larger ones read as brighter twinkling stars.
const SPARK_SEEDS = Array.from({length: 16}).map((_, i) => ({
  x: (i * 31 + 7) % 100,
  y: 74 + ((i * 47 + 5) % 22),
  period: 44 + (i % 5) * 9,
  phase: (i * 17) % 40,
  size: i % 5 === 0 ? 5 : 2 + (i % 3),
  color: i % 3 === 0 ? COL.gold : i % 3 === 1 ? COL.cream : COL.blush,
}));

const SparkParticles: React.FC<{window: Beat}> = ({window}) => {
  const frame = useCurrentFrame();
  const windowFactor = interpolate(frame, [window[0], window[0] + 10, window[1] - 10, window[1]], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {SPARK_SEEDS.map((s, i) => {
        const cycle = ((frame + s.phase) % s.period) / s.period;
        const twinkle = Math.max(0, Math.sin(cycle * Math.PI));
        const big = s.size >= 5;
        const opacity = twinkle * (big ? 0.75 : 0.55) * windowFactor;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              borderRadius: '50%',
              background: s.color,
              opacity,
              boxShadow: `0 0 ${s.size * (big ? 3.2 : 2)}px ${s.color}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const BrandOutro: React.FC<{durationInFrames?: number}> = (props) => {
  const {durationInFrames: compDuration} = useVideoConfig();
  const frame = useCurrentFrame();
  const duration = props.durationInFrames || compDuration;
  const beats = useBeats(duration);

  // Glow pulse (frames ~90–115 of the reference cut): opacity 0.6 -> 1.0 -> 0.7,
  // then a gentle late-hold reduction so the last 20 frames settle rather than
  // simply stop.
  const pulseMid = beats.pulse[0] + (beats.pulse[1] - beats.pulse[0]) * 0.5;
  const pulseFactor = interpolate(frame, [beats.pulse[0], pulseMid, beats.pulse[1]], [0.6, 1.0, 0.7], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const holdFactor = interpolate(frame, beats.hold, [1, 0.85], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const glowFactor = frame < beats.pulse[0] ? 1 : pulseFactor * (frame > beats.hold[0] ? holdFactor : 1);

  return (
    <AbsoluteFill>
      <BackgroundGradient beat={beats.bg} />
      <RadialGlow beat={beats.glowBloom} pulseFactor={glowFactor} />
      <TopBrandLabel beat={beats.label} />
      <LogoHero beat={beats.logo} pulseFactor={glowFactor} />
      <SubtitleLine beat={beats.subtitle} />
      <CenterLensFlare beat={beats.flare} />
      <WebsiteText beat={beats.website} />
      <Divider beat={beats.divider} />
      <Tagline beat={beats.tagline} />
      <BottomLightRibbons durationInFrames={duration} />
      <SparkParticles window={beats.sparkleWindow} />
      {/* Vignette: darkens the edges without ever flattening the gradient. */}
      <AbsoluteFill style={{background: 'radial-gradient(120% 85% at 50% 48%, transparent 58%, rgba(0,0,0,.38) 100%)', pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
