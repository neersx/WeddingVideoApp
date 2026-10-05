import React, { createContext, useContext, useEffect, useState } from 'react';
import { AbsoluteFill, Audio, Img, Sequence, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, cancelRender } from 'remotion';
import { DreamWeddsWeddingProps, resolveDreamWeddsDetails } from '../types';
import {resolveWeddingStyle} from '../styles';
import {StyleOrnaments} from '../StyleOrnaments';
// Adapted from DreamWedds' Charlotte & Liam 30-second 3D invitation sample.
// Motion uses a 30fps reference clock so 24fps and 30fps renders have the same pacing.
const useMotionFrame = () => useCurrentFrame() * 30 / useVideoConfig().fps;
const SceneContext = createContext<DreamWeddsWeddingProps | null>(null);
const useWedding = () => {
  const props = useContext(SceneContext);
  if (!props) throw new Error('Royal Blush requires wedding props');
  return {
    props,
    data: resolveDreamWeddsDetails(props)
  };
};
const field = (props: DreamWeddsWeddingProps, key: string) => typeof props.fields?.[key] === 'string' ? (props.fields[key] as string).trim() : '';
const fitName = (name: string, max = 78) => Math.max(42, Math.min(max, 1100 / Math.max(14, name.length)));
const useStyle = () => resolveWeddingStyle(useWedding().props);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const
};
const ease = (f: number) => spring({
  frame: f,
  fps: 30,
  config: {
    damping: 22,
    stiffness: 75,
    mass: 1.1
  }
});
const Eyebrow = ({
  children
}: {
  children: React.ReactNode;
}) => { const style = useStyle(); return <div style={{
  fontFamily: 'Arial',
  fontSize: 22,
  letterSpacing: style.letterSpacing,
  textTransform: 'uppercase',
  lineHeight: 1.5
}}>{children}</div>; };
function Backdrop() {
  const style = useStyle();
  const C = style.colors;
  const f = useMotionFrame();
  return <AbsoluteFill style={{
    background: `radial-gradient(ellipse at ${45 + Math.sin(f / 120) * 12}% 30%,${C.glow} 0%,${C.bg} 52%,${C.deep} 100%)`,
    overflow: 'hidden'
  }}>
 <StyleOrnaments style={style} frame={f} />
 {Array.from({
      length: 24
    }, (_, i) => <div key={i} style={{
      position: 'absolute',
      width: 3 + i % 4,
      height: 3 + i % 4,
      borderRadius: '50%',
      background: C.gold,
      opacity: .15 + i % 4 * .09,
      left: i * 163 % 1050 + Math.sin(f / 65 + i) * 16,
      top: (i * 277 + 1900 - f * (.22 + i % 3 * .12)) % 2100,
      boxShadow: `0 0 12px ${C.gold}`
    }} />)}
 <div style={{
      position: 'absolute',
      inset: 40,
      border: `1px solid ${C.gold}55`,
      borderRadius: 10
    }} />
 </AbsoluteFill>;
}
function Ring({
  index = 0
}: {
  index?: number;
}) {
  const style = useStyle();
  const C = style.colors;
  const f = useMotionFrame();
  return <div style={{
    position: 'absolute',
    width: 900 + index * 130,
    height: 900 + index * 130,
    left: 90 - index * 65,
    top: 450 - index * 65,
    border: `${index ? 1 : 2}px solid ${C.gold}55`,
    borderRadius: '50%',
    transform: `perspective(1500px) rotateX(${63 + Math.sin(f / 85) * 8}deg) rotateY(${Math.sin(f / 100) * 18}deg) rotateZ(${f * .12 + index * 45}deg)`,
    boxShadow: `0 0 40px ${C.gold}18`
  }} />;
}
function Shine() {
  const f = useMotionFrame();
  return <AbsoluteFill style={{
    pointerEvents: 'none',
    background: `linear-gradient(115deg,transparent ${-60 + f * 1.7}%,rgba(255,255,255,.15) ${-45 + f * 1.7}%,transparent ${-30 + f * 1.7}%)`
  }} />;
}
function Photo({
  src,
  position = 'center'
}: {
  src?: string;
  position?: string;
}) {
  const style = useStyle();
  const C = style.colors;
  return src ? <Img src={src} style={{
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: position,
    display: 'block'
  }} /> : <div style={{
    height: '100%',
    background: `linear-gradient(135deg,${C.bg},${C.gold})`
  }} />;
}
function Frame({
  children,
  style = {}
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const preset = useStyle();
  const C = preset.colors;
  return <div style={{
    position: 'absolute',
    border: `2px solid ${C.gold}`,
    padding: 12,
    background: C.paper,
    boxShadow: '0 35px 85px #0009,6px 5px 0 #796c4f',
    transformStyle: 'preserve-3d',
    boxSizing: 'border-box',
    ...style
  }}>{children}</div>;
}
function Caption({
  title,
  sub
}: {
  title: string;
  sub: string;
}) {
  const style = useStyle();
  const C = style.colors;
  const f = useMotionFrame();
  const p = ease(f - 12);
  return <div style={{
    position: 'absolute',
    left: 80,
    right: 80,
    bottom: 210,
    textAlign: 'center',
    opacity: p,
    transform: `translateY(${(1 - p) * 40}px)`,
    color: C.text
  }}><div style={{
      fontSize: fitName(title),
      lineHeight: 1.2,
      overflowWrap: 'anywhere'
    }}>{title}</div><div style={{
      fontFamily: 'Arial',
      fontSize: 25,
      marginTop: 28,
      letterSpacing: 3
    }}>{sub}</div></div>;
}
function Folio() {
  const style = useStyle();
  const C = style.colors;
  const {
    props,
    data
  } = useWedding();
  const names = `${data.bride.name} & ${data.groom.name}`;
  const f = useMotionFrame();
  const open = ease(f - 28);
  return <>
 <div style={{
      position: 'absolute',
      top: 170,
      width: '100%',
      textAlign: 'center',
      color: C.accent
    }}><Eyebrow>{style.copy.opening}</Eyebrow></div>
 <div style={{
      position: 'absolute',
      left: 110,
      top: 390,
      width: 860,
      height: 1160,
      perspective: 2000,
      transformStyle: 'preserve-3d',
      transform: `rotateX(${5 - Math.min(f, 130) * .03}deg)`
    }}>
  <div style={{
        position: 'absolute',
        inset: 0,
        background: C.paper,
        border: `3px solid ${C.gold}`,
        boxShadow: '0 45px 100px #0009',
        color: C.ink,
        textAlign: 'center',
        padding: '65px 30px',
        boxSizing: 'border-box'
      }}>
   <Eyebrow>Together with our families</Eyebrow><div style={{
          fontSize: fitName(names, 73),
          lineHeight: 1.2,
          overflowWrap: 'anywhere',
          marginTop: 35
        }}>{data.bride.name} <i>&</i> {data.groom.name}</div>
   <div style={{
          height: 430,
          marginTop: 50,
          overflow: 'hidden',
          boxShadow: '0 10px 30px #142d2625'
        }}><Photo src={field(props, 'socialImageUrl') || data.banners[0] || props.photos?.[0]} /></div>
   <div style={{
          fontSize: 35,
          marginTop: 55
        }}>{data.formattedDate || props.eventDate}</div><div style={{
          fontSize: 29,
          marginTop: 25
        }}>{data.event.venue || props.venue.name || 'Venue to be announced'}</div><div style={{
          fontFamily: 'Arial',
          fontSize: 22,
          marginTop: 20
        }}>{data.event.city || props.venue.city}</div>
  </div>
  {[false, true].map(right => <div key={String(right)} style={{
        position: 'absolute',
        top: 0,
        left: right ? 430 : 0,
        width: 430,
        height: 1160,
        transformOrigin: right ? 'right center' : 'left center',
        transform: `rotateY(${open * (right ? 145 : -145)}deg)`,
        backfaceVisibility: 'hidden',
        background: `linear-gradient(${right ? 225 : 135}deg,${C.glow},${C.deep})`,
        border: `2px solid ${C.gold}`,
        boxSizing: 'border-box',
        boxShadow: `inset 0 0 0 14px ${C.bg},inset 0 0 0 16px ${C.gold}88`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: C.accent
      }}>
    <div style={{
          position: 'absolute',
          inset: '90px 45px',
          border: `1px solid ${C.gold}88`,
          borderRadius: '220px 220px 0 0'
        }} />
    <div style={{
          fontSize: 165,
          fontStyle: 'italic'
        }}>{(right ? data.groom.name : data.bride.name).trim().charAt(0)}</div><Shine />
  </div>)}
 </div>
 <div style={{
      position: 'absolute',
      bottom: 195,
      width: '100%',
      textAlign: 'center',
      fontSize: 31,
      fontStyle: 'italic',
      color: C.text,
      opacity: interpolate(f, [30, 65], [0, 1], clamp)
    }}>A beautiful beginning awaits.</div>
 </>;
}
function Gallery() {
  const style = useStyle();
  const C = style.colors;
  const {
    props,
    data
  } = useWedding();
  const photos = props.photos || [];
  const f = useMotionFrame();
  const p = ease(f);
  return <>
 <Ring /><Ring index={1} />
 <div style={{
      position: 'absolute',
      inset: 0,
      perspective: 1800
    }}><div style={{
        position: 'absolute',
        inset: 0,
        transformStyle: 'preserve-3d',
        transform: `rotateY(${Math.sin(f / 65) * 8}deg) rotateX(${Math.sin(f / 90) * 3}deg)`
      }}>
 {[{
          src: data.banners[1] || photos[1] || photos[0],
          x: -45,
          y: 545,
          r: -15,
          z: -160
        }, {
          src: data.banners[2] || photos[2] || photos[0],
          x: 510,
          y: 505,
          r: 16,
          z: -130
        }, {
          src: data.banners[0] || photos[0],
          x: 165,
          y: 400,
          r: -2,
          z: 90
        }].map((v, i) => <Frame key={i} style={{
          left: v.x,
          top: v.y,
          width: i === 2 ? 750 : 610,
          height: i === 2 ? 930 : 880,
          transform: `translate3d(${(1 - p) * (i === 0 ? -180 : 180)}px,${(1 - p) * 160}px,${v.z - (1 - p) * 650}px) rotateY(${v.r}deg) rotateZ(${v.r / 3}deg)`,
          opacity: p
        }}><Photo src={v.src} /><Shine /></Frame>)}
 </div></div>
 <Caption title={`${data.bride.name} & ${data.groom.name}`} sub="A LIFETIME OF LITTLE ADVENTURES" />
 </>;
}
function Portrait({
  bride
}: {
  bride: boolean;
}) {
  const style = useStyle();
  const C = style.colors;
  const {
    data
  } = useWedding();
  const person = bride ? data.bride : data.groom;
  const f = useMotionFrame();
  const p = ease(f);
  const angle = (1 - p) * (bride ? -68 : 68) + Math.sin(f / 50) * (bride ? 4 : -4);
  return <>
 <div style={{
      position: 'absolute',
      top: 140,
      width: '100%',
      textAlign: 'center',
      color: C.accent
    }}><Eyebrow>{bride ? 'Meet the bride' : 'Meet the groom'}</Eyebrow></div><Ring />
 <div style={{
      position: 'absolute',
      inset: 0,
      perspective: 1800
    }}><Frame style={{
        left: 160,
        top: 285,
        width: 760,
        height: 1090,
        transform: `translateZ(${p * 80}px) rotateY(${angle}deg) rotateX(${(1 - p) * 9}deg)`,
        borderRadius: style.portraitRadius
      }}><div style={{
          position: 'relative',
          height: '100%',
          overflow: 'hidden',
          borderRadius: style.portraitRadius
        }}><Photo src={person.imageUrl} /><Shine /></div></Frame></div>
 <Caption title={person.name} sub={bride ? 'A KIND HEART. AN ADVENTUROUS SOUL.' : 'HER FAVOURITE PERSON. HER FOREVER.'} />
 </>;
}
function Event() {
  const style = useStyle();
  const C = style.colors;
  const {
    props,
    data
  } = useWedding();
  const time = field(props, 'eventTime');
  const f = useMotionFrame();
  const p = ease(f);
  return <>
 <div style={{
      position: 'absolute',
      top: 140,
      width: '100%',
      textAlign: 'center',
      color: C.accent
    }}><Eyebrow>{style.copy.event}</Eyebrow></div>
 <div style={{
      position: 'absolute',
      inset: 0,
      perspective: 2000
    }}><Frame style={{
        left: 115,
        top: 310,
        width: 850,
        height: 1310,
        padding: 24,
        transform: `translateZ(${30 + Math.sin(f / 70) * 15}px) rotateX(${(1 - p) * 58 + Math.sin(f / 100) * 2}deg) rotateY(${(1 - p) * -18}deg)`,
        transformOrigin: 'center bottom'
      }}>
 <div style={{
          height: 575,
          transform: 'translateZ(32px)',
          boxShadow: '0 18px 35px #142d2630'
        }}><Photo src={data.event.imageUrl || data.banners[0] || props.photos?.[0]} /></div>
 <div style={{
          textAlign: 'center',
          padding: '52px 25px',
          color: C.ink,
          transform: 'translateZ(55px)'
        }}><div style={{
            fontSize: fitName(data.event.title, 59),
            lineHeight: 1.2,
            overflowWrap: 'anywhere'
          }}>{data.event.title}</div><div style={{
            height: 1,
            width: 130,
            background: C.gold,
            margin: '36px auto'
          }} /><div style={{
            fontFamily: 'Arial',
            fontSize: 31,
            letterSpacing: 2
          }}>{data.event.formattedDate || data.formattedDate || props.eventDate}</div>{time ? <div style={{
            fontSize: 52,
            margin: '25px 0'
          }}>{time}</div> : <div style={{
            height: 35
          }} />}<div style={{
            fontSize: 36,
            overflowWrap: 'anywhere'
          }}>{data.event.venue || props.venue.name || 'Venue to be announced'}</div><div style={{
            fontFamily: 'Arial',
            fontSize: 25,
            marginTop: 24
          }}>{data.event.city || props.venue.city}</div></div><Shine />
 </Frame></div>
 </>;
}
function Invite() {
  const style = useStyle();
  const C = style.colors;
  const {
    props,
    data
  } = useWedding();
  const website = field(props, 'websiteUrl');
  const f = useMotionFrame();
  const p = ease(f);
  return <><Ring /><Ring index={1} /><div style={{
      position: 'absolute',
      inset: 0,
      perspective: 1800
    }}><div style={{
        position: 'absolute',
        left: 90,
        top: 390,
        width: 900,
        height: 1090,
        boxSizing: 'border-box',
        padding: '85px 55px',
        background: `linear-gradient(135deg,${C.glow},${C.bg})`,
        border: `1px solid ${C.gold}`,
        boxShadow: '0 30px 90px #0008',
        textAlign: 'center',
        color: C.text,
        transformStyle: 'preserve-3d',
        transform: `translateY(${(1 - p) * 200}px) translateZ(${p * 95}px) rotateX(${(1 - p) * 25}deg) rotateY(${Math.sin(f / 70) * 4}deg)`
      }}>
 <Eyebrow>With love, {data.bride.name} &amp; {data.groom.name}</Eyebrow><div style={{
          fontSize: 91,
          lineHeight: 1.2,
          margin: '55px 0',
          transform: 'translateZ(45px)'
        }}>We saved<br />you a place</div><div style={{
          fontSize: 34,
          lineHeight: 1.7,
          transform: 'translateZ(30px)'
        }}>{style.copy.invitation}</div><div style={{
          height: 1,
          width: 120,
          background: C.gold,
          margin: '48px auto'
        }} /><div style={{
          fontFamily: 'Arial',
          fontSize: 27,
          letterSpacing: 2
        }}>{data.event.formattedDate || data.formattedDate || props.eventDate}</div>{website ? <div style={{
          fontSize: 27,
          marginTop: 48,
          overflowWrap: 'anywhere'
        }}>{website}</div> : null}<Shine />
 </div></div></>;
}
function Closing() {
  const style = useStyle();
  const C = style.colors;
  const f = useMotionFrame();
  const p = ease(f);
  return <><Ring /><div style={{
      position: 'absolute',
      inset: 0,
      perspective: 1800,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      color: C.text
    }}><div style={{
        transform: `translateZ(${(1 - p) * -600}px) rotateY(${(1 - p) * 25}deg)`,
        opacity: p,
        textAlign: 'center'
      }}><Img src={staticFile('dreamwedds/logo.png')} style={{
          width: 800, background: '#102C26', borderRadius: 24, padding: 20
        }} /><div style={{
          fontSize: 36,
          fontStyle: 'italic',
          marginTop: 40
        }}>Your story. Beautifully shared.</div><div style={{
          fontFamily: 'Arial',
          fontSize: 22,
          letterSpacing: 5,
          marginTop: 35
        }}>DREAMWEDDS.COM</div></div></div></>;
}
const BrideScene = () => <Portrait bride />;
const GroomScene = () => <Portrait bride={false} />;
const scenes = [Folio, Gallery, BrideScene, GroomScene, Event, Invite, Closing];
const sceneSeconds = [0, 5, 10, 14, 18, 24, 28, 30];
export const RoyalBlushWedding: React.FC<DreamWeddsWeddingProps> = props => {
  const [handle] = useState(() => delayRender('Load Royal Blush invitation font'));
  useEffect(() => {
    const font = new FontFace('InvitationSerif', `url(${staticFile('dreamwedds/invitation-serif.woff2')})`);
    font.load().then(loaded => {
      document.fonts.add(loaded);
      continueRender(handle);
    }).catch(cancelRender);
  }, [handle]);
  const frame = useCurrentFrame();
  const {
    durationInFrames,
    fps
  } = useVideoConfig();
  const boundaries = sceneSeconds.map(seconds => Math.round(seconds / 30 * durationInFrames));
  const volume = interpolate(frame, [0, fps, durationInFrames - fps * 2, durationInFrames], [0, .65, .65, 0], clamp);
  return <SceneContext.Provider value={props}>
    <AbsoluteFill style={{
      fontFamily: resolveWeddingStyle(props).fontFamily,
      overflow: 'hidden'
    }}>
      <Backdrop />
      {props.musicUrl ? <Audio src={props.musicUrl} volume={volume} /> : null}
      {scenes.map((Scene, index) => <Sequence key={index} from={boundaries[index]} durationInFrames={boundaries[index + 1] - boundaries[index]}><Scene /></Sequence>)}
    </AbsoluteFill>
  </SceneContext.Provider>;
};
