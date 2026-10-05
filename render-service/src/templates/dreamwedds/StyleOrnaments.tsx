import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {WeddingStyle} from './styles';

/** Vector scenery stays sharp at any render size and requires no external assets. */
export const StyleOrnaments: React.FC<{style: WeddingStyle; frame: number}> = ({style, frame}) => {
  const {gold, accent} = style.colors;
  const sway = Math.sin(frame / 100) * 5;
  const flower = (x: number, y: number, size: number, key: string) => (
    <g key={key} transform={`translate(${x} ${y}) rotate(${sway})`}>
      {Array.from({length: 8}, (_, i) => <ellipse key={i} cy={-size * .6} rx={size * .3} ry={size * .65} transform={`rotate(${i * 45})`} fill={style.motif === 'palace' ? '#E9A238' : style.colors.paper} stroke={gold} strokeWidth={1.5} />)}
      <circle r={size * .22} fill={gold} />
    </g>
  );
  return <AbsoluteFill style={{pointerEvents: 'none'}}>
    <svg viewBox="0 0 1080 1920" width="100%" height="100%" fill="none" aria-hidden>
      {style.motif === 'palace' && <g stroke={gold} opacity={.45}>
        <path d="M65 1850V460Q65 310 220 310Q250 185 390 210Q540 45 690 210Q830 185 860 310Q1015 310 1015 460V1850" strokeWidth={3}/>
        {[85, 995].map(x => <g key={x}><path d={`M${x} 440V1810`} strokeWidth={18} opacity={.3}/>{Array.from({length: 9}, (_, i) => flower(x, 480 + i * 150, 18, String(i)))}</g>)}
        <path d="M160 100Q540 350 920 100" strokeWidth={2}/>
        {Array.from({length: 11}, (_, i) => flower(180 + i * 72, 110 + Math.sin(i / 10 * Math.PI) * 120, 15, `garland-${i}`))}
      </g>}
      {(style.motif === 'garden' || style.motif === 'floral') && <g opacity={.65}>
        {[false, true].map(right => <g key={String(right)} transform={right ? 'translate(1080 1920) rotate(180)' : undefined}>
          <path d="M25 1030Q155 680 80 430Q-10 180 320 40" stroke={accent} strokeWidth={3}/>
          {Array.from({length: 13}, (_, i) => <g key={i} transform={`translate(${75 + Math.sin(i / 2) * 35} ${160 + i * 65}) rotate(${i % 2 ? -35 : 35})`}>
            <ellipse cx={i % 2 ? 22 : -22} rx={32} ry={11} fill={accent} opacity={.45}/>
          </g>)}
          {flower(100, 220, 34, 'rose-one')}{flower(80, 680, 26, 'rose-two')}{flower(220, 90, 28, 'rose-three')}
        </g>)}
      </g>}
      {style.motif === 'arches' && <g stroke={gold} opacity={.4}>
        {[0, 1, 2].map(i => <path key={i} d={`M${60 + i * 28} 1840V610Q${60 + i * 28} 370 540 ${100 + i * 45}Q${1020 - i * 28} 370 ${1020 - i * 28} 610V1840`} strokeWidth={2}/>)}
        {[150, 930].map(x => <g key={x} transform={`translate(${x} 0)`}><path d="M0 0V185"/><path d="M0 180L-28 212V270L0 290L28 270V212Z" fill={gold} fillOpacity={.15}/><path d="M-28 220H28M-28 260H28M0 180V290"/></g>)}
        {Array.from({length: 8}, (_, i) => <path key={i} d={`M${150 + i * 110} 1780l30 30-30 30-30-30Z`}/>)}
      </g>}
      {style.motif === 'lotus' && <g stroke={gold} strokeWidth={2} opacity={.4}>
        {[240, 1660].map(y => <g key={y} transform={`translate(540 ${y})`}>
          {[-60, -30, 0, 30, 60].map(angle => <path key={angle} d="M0 60Q-105-45 0-180Q105-45 0 60Z" transform={`rotate(${angle} 0 60)`} fill={gold} fillOpacity={.07}/>)}
          <path d="M-330 110Q0 150 330 110M-240 145Q0 180 240 145"/>
        </g>)}
      </g>}
    </svg>
  </AbsoluteFill>;
};
