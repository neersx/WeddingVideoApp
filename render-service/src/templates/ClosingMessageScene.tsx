import React from 'react';
import {AbsoluteFill, Img, interpolate, useCurrentFrame} from 'remotion';

// Reference length used to size the typography — the closing message must
// stay large and comfortably legible even at this length, so shorter
// messages (the common case) always look intentionally big, not just "fit".
// "Happy Birthday, my love. I choose you today, tomorrow, and in every
// beautiful chapter still to come. ❤️" — 105 characters.
const REFERENCE_LENGTH = 105;

// Shared timing constants — used both to size this scene's own animation and
// (via estimateClosingFrames) to size the Sequence a template wraps it in, so
// the two can never drift out of sync and cut the reveal off early.
const PANEL_IN_GAP = 4; // panel starts shortly after the incoming crossfade
const TYPING_START_GAP = 8; // pause after the panel settles, before typing begins
const TYPING_RATE = 0.5; // frames per character
const TYPING_MIN = 30;
const TYPING_MAX = 60;
const SIGNATURE_GAP = 8; // pause after typing finishes, before the signature fades in
const SIGNATURE_REVEAL = 16;
const HOLD_AFTER = 16; // clean hold once everything is fully visible, before crossfade out

const typingFramesFor = (length: number) => Math.min(TYPING_MAX, Math.max(TYPING_MIN, Math.round(length * TYPING_RATE)));

// The minimum local-duration (excluding the crossfade tail) this scene needs
// to type out `message` and, if present, reveal `signature` before it's safe
// to start fading to the next scene.
export const estimateClosingContentFrames = (message: string, hasSignature: boolean, trans: number) => {
  const panelIn = Math.max(trans + PANEL_IN_GAP, 14);
  const typingStart = panelIn + TYPING_START_GAP;
  const typingFrames = typingFramesFor(message.length);
  const typingEnd = typingStart + typingFrames;
  if (!hasSignature) return typingEnd + HOLD_AFTER;
  const signatureEnd = typingEnd + SIGNATURE_GAP + SIGNATURE_REVEAL;
  return signatureEnd + HOLD_AFTER;
};

export type ClosingScenePalette = {
  ink: string;
  cream: string;
  accent: string;
  overlayRgb: string; // "r,g,b" for the panel scrim
};

type Props = {
  src?: string;
  message: string;
  signature?: string;
  dur: number;
  trans: number;
  palette: ClosingScenePalette;
  fontFamilySerif: string;
  fontFamilySans: string;
};

// A dedicated, focused "closing message" screen — the caller supplies the photo
// (Heartfelt templates pass the second-to-last one: the opening message owns the
// first, and the last would repeat the slide immediately before this), a dark
// inset overlay panel at ~70% opacity (padded well off every edge), and
// the message typed out large and centered rather than sharing a scene with
// a per-photo caption.
export const ClosingMessageScene: React.FC<Props> = ({src, message, signature, dur, trans, palette, fontFamilySerif, fontFamilySans}) => {
  const frame = useCurrentFrame();

  // Crossfade with the scenes before/after, same pattern as every other scene.
  const sceneOpacity = interpolate(frame, [0, trans, dur - trans, dur], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // Slow, steady zoom — no direction alternation needed, this is a single
  // standalone beat rather than one of a sequence of alternating photos.
  const zoom = interpolate(frame, [0, dur], [1.04, 1.14], {extrapolateRight: 'clamp'});

  // The panel rises/fades in just after the crossfade settles.
  const panelIn = Math.max(trans + PANEL_IN_GAP, 14);
  const panelReveal = interpolate(frame, [panelIn, panelIn + 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const panelY = interpolate(panelReveal, [0, 1], [18, 0]);

  // Typewriter reveal: duration scales with message length but is clamped so
  // very short messages don't type instantly and very long ones don't drag.
  // These offsets mirror estimateClosingContentFrames() exactly, so a template
  // that sizes its Sequence from that estimate always has enough room here.
  const typingStart = panelIn + TYPING_START_GAP;
  const typingFrames = typingFramesFor(message.length);
  const visibleChars = Math.floor(
    interpolate(frame, [typingStart, typingStart + typingFrames], [0, message.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
  );
  const typingDone = frame >= typingStart + typingFrames;
  const shown = message.slice(0, visibleChars);
  const cursorVisible = !typingDone && Math.floor(frame / 8) % 2 === 0;

  // Font size is tuned against the 105-character reference message so it
  // wraps into a comfortable ~4 lines inside the panel; shorter messages
  // simply take fewer lines at the same large, confident size.
  const lengthRatio = Math.min(1, message.length / REFERENCE_LENGTH);
  const fontSize = Math.round(interpolate(lengthRatio, [0, 1], [78, 60]));

  const signatureFrom = typingStart + typingFrames + SIGNATURE_GAP;
  const signatureOpacity = interpolate(frame, [signatureFrom, signatureFrom + SIGNATURE_REVEAL], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{opacity: sceneOpacity}}>
      <AbsoluteFill style={{background: palette.ink, overflow: 'hidden'}}>
        {src ? (
          <Img
            src={src}
            pauseWhenLoading
            style={{position: 'absolute', inset: '-6%', width: '112%', height: '112%', objectFit: 'cover', transform: `scale(${zoom})`, filter: 'saturate(.9) brightness(.8) contrast(1.02)'}}
          />
        ) : null}
      </AbsoluteFill>

      {/* Base vignette so the panel isn't the only thing keeping text readable. */}
      <AbsoluteFill style={{background: `radial-gradient(120% 90% at 50% 50%, transparent 40%, rgba(${palette.overlayRgb},.55) 100%)`}} />

      {/* Inset overlay panel — padded well off every corner, ~70% opacity. */}
      <div
        style={{
          position: 'absolute',
          left: 76,
          right: 76,
          top: 260,
          bottom: 300,
          borderRadius: 40,
          opacity: panelReveal,
          transform: `translateY(${panelY}px)`,
          background: `rgba(${palette.overlayRgb},0.7)`,
          boxShadow: '0 30px 90px rgba(0,0,0,.4)',
          border: `1px solid rgba(255,255,255,.08)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 58px',
        }}
      >
        <div
          style={{
            fontFamily: fontFamilySerif,
            fontStyle: 'italic',
            fontSize,
            lineHeight: 1.28,
            textAlign: 'center',
            color: palette.cream,
            textShadow: '0 6px 30px rgba(0,0,0,.5)',
          }}
        >
          {shown}
          <span style={{opacity: cursorVisible ? 1 : 0, color: palette.accent}}>|</span>
        </div>

        {signature ? (
          <div
            style={{
              marginTop: 34,
              opacity: signatureOpacity,
              fontFamily: fontFamilySans,
              fontSize: 34,
              letterSpacing: 1,
              color: palette.accent,
              textShadow: '0 3px 18px rgba(0,0,0,.5)',
            }}
          >
            {signature}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
