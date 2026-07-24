import {estimateClosingContentFrames} from './ClosingMessageScene';

// Per-slide pacing for the Heartfelt templates (From My Heart, Forever Special).
// Each photo slide aims for 2.5–3.5s — the exact figure follows how many images
// were uploaded — and the opening and closing slides always take the full 3.5s
// so the first impression and the final beat never feel clipped.
export const SLIDE_MIN_SECONDS = 2.5;
export const SLIDE_MAX_SECONDS = 3.5;
export const EDGE_SLIDE_SECONDS = 3.5;

// How long the closing-message beat may linger past what its text actually
// needs. Total runtime is fixed (10/20/30s), so when the slides can't use it
// all, something has to hold longer; this caps that hold before the surplus is
// pushed back onto the slides instead. Without it a 30s reel with 3 photos left
// the closing panel frozen for ~15s.
const CLOSING_EXTRA_HOLD_SECONDS = 3;

export type SlideTiming = {from: number; dur: number};

export type HeartfeltTiming = {
  // One entry per photo slide, in order. `dur` excludes the crossfade tail a
  // template adds when it builds the Sequence.
  slides: SlideTiming[];
  // Frame the closing-message beat starts on == total frames of photo slides.
  photoTotal: number;
  closingFrames: number;
  outroFrames: number;
};

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/**
 * Which photo the closing-message beat shows.
 *
 * The opening message owns the first photo, so the closing beat must not reuse
 * it. It takes the second-to-last photo rather than the last, so the final slide
 * doesn't run back-to-back with the closing beat on the same image.
 *
 * Below 3 photos there isn't a third distinct choice: with 2 we take the last
 * (index 1) because the second-to-last IS the opening photo, and with 1 the sole
 * photo has to serve both. The form enforces minImages: 3, so those are
 * defensive paths only.
 */
export const closingPhotoIndex = (photoCount: number) =>
  photoCount >= 3 ? photoCount - 2 : Math.max(0, photoCount - 1);

/**
 * Seconds each middle slide aims for, driven purely by the image count: fewer
 * photos can each breathe longer, more photos tighten toward the 2.5s floor.
 * 3 images -> 3.5s, 4 -> 3.0s, 5 -> 2.5s.
 */
const middleSlideSeconds = (photoCount: number) =>
  clamp(SLIDE_MAX_SECONDS - (photoCount - 3) * 0.5, SLIDE_MIN_SECONDS, SLIDE_MAX_SECONDS);

/** The slide budget this reel would use if runtime were unconstrained. */
const idealSlideFrames = (photoCount: number, fps: number) => {
  const edgeF = Math.round(EDGE_SLIDE_SECONDS * fps);
  const middleF = Math.round(middleSlideSeconds(photoCount) * fps);
  if (photoCount <= 2) return photoCount * edgeF;
  return 2 * edgeF + (photoCount - 2) * middleF;
};

/**
 * Split exactly `target` frames across `photoCount` slides.
 *
 * Edge slides (first and last) are pinned to EDGE_SLIDE_SECONDS and the middles
 * take middleSlideSeconds(); the two reconciliation passes then bend that shape
 * to fit `target` exactly, always sacrificing the middles before the edges.
 */
const allocateSlideFrames = (target: number, photoCount: number, fps: number): number[] => {
  const minF = Math.round(SLIDE_MIN_SECONDS * fps);
  const maxF = Math.round(SLIDE_MAX_SECONDS * fps);
  const edgeF = Math.round(EDGE_SLIDE_SECONDS * fps);
  const middleF = Math.round(middleSlideSeconds(photoCount) * fps);

  const middleIdx: number[] = [];
  const edgeIdx: number[] = [];
  const lengths = new Array<number>(photoCount).fill(0);
  for (let i = 0; i < photoCount; i++) {
    const isEdge = i === 0 || i === photoCount - 1;
    lengths[i] = isEdge ? edgeF : middleF;
    (isEdge ? edgeIdx : middleIdx).push(i);
  }

  // Order used when handing out leftover frames from integer division. Edges go
  // first so a rounding remainder can never leave an edge slide a frame shorter
  // than a middle one.
  const spareOrder = [...edgeIdx, ...middleIdx];

  let diff = target - sum(lengths);

  // --- Surplus: grow the middles toward 3.5s first. ---
  for (const i of middleIdx) {
    if (diff <= 0) break;
    const add = Math.min(maxF - lengths[i], diff);
    lengths[i] += add;
    diff -= add;
  }
  // Still surplus — every slide is already at the 3.5s cap. Runtime is fixed, so
  // spread the rest evenly rather than freezing the closing panel on one photo.
  if (diff > 0) {
    const each = Math.floor(diff / photoCount);
    for (let i = 0; i < photoCount; i++) lengths[i] += each;
    diff -= each * photoCount;
    for (let i = 0; diff > 0; i++) {
      lengths[spareOrder[i % photoCount]] += 1;
      diff -= 1;
    }
  }

  // --- Deficit: shave the middles back toward 2.5s, edges untouched. ---
  for (const i of middleIdx) {
    if (diff >= 0) break;
    const cut = Math.min(lengths[i] - minF, -diff);
    lengths[i] -= cut;
    diff += cut;
  }
  // Still over budget — the runtime genuinely cannot hold 2.5s per slide (a 10s
  // reel, once the outro and closing beat are reserved). Scale everything down
  // proportionally so the reel stays the requested length instead of overrunning.
  if (diff < 0) {
    const total = sum(lengths);
    const scale = target / total;
    for (let i = 0; i < photoCount; i++) lengths[i] = Math.max(1, Math.floor(lengths[i] * scale));
    let drift = target - sum(lengths);
    for (let i = 0; drift !== 0 && i < photoCount * 3; i++) {
      const idx = spareOrder[i % photoCount];
      if (drift > 0) {
        lengths[idx] += 1;
        drift -= 1;
      } else if (lengths[idx] > 1) {
        lengths[idx] -= 1;
        drift += 1;
      }
    }
  }

  return lengths;
};

/**
 * Plan the whole Heartfelt timeline: photo slides, then the closing-message
 * beat, then the branded outro — together filling `durationInFrames` exactly.
 *
 * The closing beat is sized from the actual message length (so the longest
 * supported message always types out and reveals its signature in full) and may
 * hold up to CLOSING_EXTRA_HOLD_SECONDS longer; beyond that, spare runtime goes
 * back to the slides.
 */
export const planHeartfeltTiming = ({
  durationInFrames,
  fps,
  photoCount,
  closingMessage,
  hasSignature,
  trans,
}: {
  durationInFrames: number;
  fps: number;
  photoCount: number;
  closingMessage: string;
  hasSignature: boolean;
  trans: number;
}): HeartfeltTiming => {
  const outroFrames = Math.min(Math.round(fps * 5), Math.max(Math.round(fps * 2), Math.round(durationInFrames * 0.15)));
  const closingMin = Math.max(Math.round(fps * 1.2), estimateClosingContentFrames(closingMessage, hasSignature, trans));
  const closingMax = closingMin + Math.round(fps * CLOSING_EXTRA_HOLD_SECONDS);

  // Slides may use anywhere from photoMin (closing takes its full extra hold) to
  // photoMax (closing takes only what its text needs). Never below one frame
  // each, however tight the runtime.
  const photoMax = Math.max(photoCount, durationInFrames - outroFrames - closingMin);
  const photoMin = Math.max(photoCount, Math.min(photoMax, durationInFrames - outroFrames - closingMax));

  const target = clamp(idealSlideFrames(photoCount, fps), photoMin, photoMax);
  const lengths = allocateSlideFrames(target, photoCount, fps);

  const slides: SlideTiming[] = [];
  let cursor = 0;
  for (const dur of lengths) {
    slides.push({from: cursor, dur});
    cursor += dur;
  }

  const photoTotal = cursor;
  // The closing beat takes the remainder, keeping the total exactly
  // durationInFrames.
  const closingFrames = durationInFrames - outroFrames - photoTotal;

  return {slides, photoTotal, closingFrames, outroFrames};
};
