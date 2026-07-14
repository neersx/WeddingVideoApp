import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadOutfit} from '@remotion/google-fonts/Outfit';
import {WeddingProps, sectionPlan} from './types';
import {Rise, SceneFade} from './TemplateMotion';

const {fontFamily: serif} = loadCormorant();
const {fontFamily: sans} = loadOutfit();
const C = {emerald: '#0D3028', ruby: '#741E35', gold: '#D6B56D', cream: '#FFF4D6'};

const PalaceBackground: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: `radial-gradient(circle at 50% 32%, #315E4D 0%, ${C.emerald} 48%, #061813 100%)`}}>
      <AbsoluteFill style={{opacity: 0.16, backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 34px, #EBCF8B 35px 36px), repeating-linear-gradient(-45deg, transparent 0 34px, #EBCF8B 35px 36px)'}} />
      <div style={{position: 'absolute', left: 92, right: 92, top: 120, bottom: 120, border: `3px solid ${C.gold}`, borderRadius: '480px 480px 28px 28px', boxShadow: 'inset 0 0 80px rgba(214,181,109,.2)'}} />
      <div style={{position: 'absolute', left: 122, right: 122, top: 150, bottom: 150, border: '1px solid rgba(255,244,214,.45)', borderRadius: '450px 450px 20px 20px'}} />
      {Array.from({length: 22}).map((_, i) => (
        <div key={i} style={{position: 'absolute', left: random(`rp-x-${i}`) * 1080, top: (random(`rp-y-${i}`) * 1920 + frame * (0.35 + random(`rp-s-${i}`))) % 1960 - 40, width: 5 + random(`rp-z-${i}`) * 8, height: 5 + random(`rp-z-${i}`) * 8, borderRadius: 99, background: C.gold, opacity: 0.22 + random(`rp-o-${i}`) * 0.45, boxShadow: `0 0 16px ${C.gold}`}} />
      ))}
    </AbsoluteFill>
  );
};

const Crest: React.FC<WeddingProps> = ({couple}) => (
  <div style={{width: 190, height: 190, border: `2px solid ${C.gold}`, transform: 'rotate(45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 70px', background: 'rgba(6,24,19,.48)'}}>
    <div style={{transform: 'rotate(-45deg)', color: C.cream, fontFamily: serif, fontSize: 80}}>{couple.partnerOne.charAt(0)}<span style={{color: C.gold}}>&amp;</span>{couple.partnerTwo.charAt(0)}</div>
  </div>
);

const Hero: React.FC<WeddingProps> = (props) => (
  <AbsoluteFill style={{justifyContent: 'center', textAlign: 'center', padding: 150}}>
    <Rise><Crest {...props} /></Rise>
    <Rise delay={10} style={{fontFamily: sans, color: C.gold, fontSize: 26, letterSpacing: 11, textTransform: 'uppercase'}}>Together with their families</Rise>
    <Rise delay={18} style={{fontFamily: serif, color: C.cream, fontSize: 112, lineHeight: 1.04, marginTop: 45}}>{props.couple.partnerOne}<div style={{fontSize: 58, fontStyle: 'italic', color: C.gold, margin: 12}}>and</div>{props.couple.partnerTwo}</Rise>
    <Rise delay={30} style={{fontFamily: sans, color: C.cream, fontSize: 35, marginTop: 55}}>{props.eventDate || 'Save the date'}<div style={{color: C.gold, marginTop: 14}}>{props.venue.name}{props.venue.city ? ` · ${props.venue.city}` : ''}</div></Rise>
  </AbsoluteFill>
);

const Message: React.FC<WeddingProps> = (props) => (
  <AbsoluteFill style={{justifyContent: 'center', padding: 145, textAlign: 'center'}}>
    <Rise style={{borderTop: `2px solid ${C.gold}`, borderBottom: `2px solid ${C.gold}`, padding: '90px 20px'}}>
      <div style={{fontFamily: sans, color: C.gold, fontSize: 25, letterSpacing: 10, textTransform: 'uppercase'}}>A royal celebration</div>
      <div style={{fontFamily: serif, color: C.cream, fontSize: 65, lineHeight: 1.35, fontStyle: 'italic', marginTop: 48}}>{props.message || 'Your presence will make our celebration complete.'}</div>
    </Rise>
  </AbsoluteFill>
);

const Photo: React.FC<WeddingProps & {duration: number}> = (props) => {
  const frame = useCurrentFrame();
  const src = props.photos?.[0];
  return <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: 105}}>{src ? <div style={{width: 800, height: 1190, padding: 18, border: `3px solid ${C.gold}`, background: C.cream, boxShadow: '0 35px 90px rgba(0,0,0,.45)'}}><Img src={src} pauseWhenLoading style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${interpolate(frame, [0, props.duration], [1.08, 1])})`}} /></div> : <Crest {...props} />}</AbsoluteFill>;
};

const Events: React.FC<WeddingProps> = (props) => (
  <AbsoluteFill style={{justifyContent: 'center', padding: 130}}>
    <Rise style={{fontFamily: serif, color: C.cream, fontSize: 80, textAlign: 'center', marginBottom: 65}}>Wedding Festivities</Rise>
    {(props.schedule?.length ? props.schedule : [{name: 'Wedding', time: props.eventDate || 'Save the date'}]).slice(0, 4).map((item, i) => <Rise key={`${item.name}-${i}`} delay={i * 7} style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(214,181,109,.5)', padding: '35px 8px', color: C.cream, fontFamily: sans, fontSize: 34}}><span style={{fontFamily: serif, fontSize: 57}}>{item.name}</span><span style={{color: C.gold, textAlign: 'right'}}>{item.time}</span></Rise>)}
  </AbsoluteFill>
);

export const RoyalPalace: React.FC<WeddingProps> = (props) => {
  const {durationInFrames, fps} = useVideoConfig();
  const plan = sectionPlan(durationInFrames);
  const frame = useCurrentFrame();
  const starts = [0, plan.intro, plan.intro + plan.message, plan.intro + plan.message + plan.photos, durationInFrames - plan.finale];
  const volume = interpolate(frame, [0, fps, durationInFrames - fps, durationInFrames], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: C.emerald}}>{props.musicUrl ? <Audio src={props.musicUrl} volume={volume} /> : null}<PalaceBackground /><Sequence durationInFrames={plan.intro}><SceneFade duration={plan.intro}><Hero {...props} /></SceneFade></Sequence><Sequence from={starts[1]} durationInFrames={plan.message}><SceneFade duration={plan.message}><Message {...props} /></SceneFade></Sequence><Sequence from={starts[2]} durationInFrames={plan.photos}><SceneFade duration={plan.photos}><Photo {...props} duration={plan.photos} /></SceneFade></Sequence><Sequence from={starts[3]} durationInFrames={plan.schedule}><SceneFade duration={plan.schedule}><Events {...props} /></SceneFade></Sequence><Sequence from={starts[4]} durationInFrames={plan.finale}><SceneFade duration={plan.finale}><Hero {...props} /></SceneFade></Sequence></AbsoluteFill>;
};
