import React from 'react';
import {AbsoluteFill, Img, Video, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {ResolvedTheme, ThemeAssetPlacement} from './types';

const BACK_LAYERS: ThemeAssetPlacement['layer'][] = ['base', 'background', 'midground'];
const FRONT_LAYERS: ThemeAssetPlacement['layer'][] = ['foreground', 'overlay', 'watermark'];

const animationTransform = (placement: ThemeAssetPlacement, frame: number, duration: number) => {
  const preset = placement.animation?.preset || 'none';
  const speed = Math.max(0.1, Number(placement.animation?.speed || 1));
  const intensity = Math.max(0, Number(placement.animation?.intensity || 1));
  const progress = duration > 1 ? Math.min(1, frame / duration) : 0;
  const baseScale = Number(placement.layout?.scale || 1);
  const rotation = Number(placement.layout?.rotation || 0);
  let x = 0;
  let y = 0;
  let scale = baseScale;
  let rotate = rotation;
  if (preset === 'slow-zoom') scale += progress * 0.08 * intensity * speed;
  if (preset === 'float-up') y = interpolate(progress, [0, 1], [30 * intensity, -30 * intensity]);
  if (preset === 'slow-drift') x = interpolate(progress, [0, 1], [-22 * intensity, 22 * intensity]);
  if (preset === 'petal-fall') {
    y = interpolate(progress, [0, 1], [-80 * intensity, 100 * intensity]);
    x = Math.sin(frame * 0.025 * speed) * 24 * intensity;
  }
  if (preset === 'rotate-slow') rotate += progress * 8 * intensity * speed;
  return `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotate}deg)`;
};

const ThemeAsset: React.FC<{placement: ThemeAssetPlacement; durationInFrames: number}> = ({placement, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const start = Math.max(0, Number(placement.timing?.startOffsetSeconds || 0) * fps);
  const configuredEnd = placement.timing?.endOffsetSeconds;
  const end = configuredEnd == null ? durationInFrames : Math.min(durationInFrames, Number(configuredEnd) * fps);
  if (frame < start || frame > end) return null;
  const fade = placement.animation?.preset === 'fade-in'
    ? interpolate(frame - start, [0, Math.max(1, fps * 0.6)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 1;
  const layout = placement.layout || {};
  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: layout.fit || 'cover',
    objectPosition: `${layout.positionX ?? 50}% ${layout.positionY ?? 50}%`,
    transform: animationTransform(placement, frame - start, Math.max(1, end - start)),
  };
  return (
    <AbsoluteFill style={{zIndex: placement.zIndex || 0, opacity: (placement.opacity ?? 1) * fade, mixBlendMode: placement.blendMode || 'normal', overflow: 'hidden'}}>
      {placement.assetType === 'video'
        ? <Video src={placement.url} muted loop={placement.timing?.loop !== false} style={style} />
        : <Img src={placement.url} pauseWhenLoading style={style} />}
    </AbsoluteFill>
  );
};

const LayerSet: React.FC<{placements: ThemeAssetPlacement[]; durationInFrames: number}> = ({placements, durationInFrames}) => (
  <>
    {[...placements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map((placement) => (
      <ThemeAsset key={placement.id} placement={placement} durationInFrames={durationInFrames} />
    ))}
  </>
);

export const ThemeScreen: React.FC<{
  theme?: ResolvedTheme;
  screenId: string;
  durationInFrames: number;
  children: React.ReactNode;
}> = ({theme, screenId, durationInFrames, children}) => {
  const layers = theme?.screens?.[screenId]?.layers || {};
  const collect = (names: ThemeAssetPlacement['layer'][]) => names.flatMap((name) => layers[name] || []);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{zIndex: 0}}>
        <LayerSet placements={collect(BACK_LAYERS)} durationInFrames={durationInFrames} />
      </AbsoluteFill>
      <AbsoluteFill style={{zIndex: 1}}>{children}</AbsoluteFill>
      <AbsoluteFill style={{zIndex: 2}}>
        <LayerSet placements={collect(FRONT_LAYERS)} durationInFrames={durationInFrames} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
