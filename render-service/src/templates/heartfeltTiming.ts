// Per-slide pacing for the Heartfelt templates (From My Heart, Forever Special).
//
// Layout is N photo slides then a branded outro — nothing else. The FIRST and
// LAST slides are the opening and closing (their image message is the opening /
// closing text), so they're pinned longer: a 4s target, never under 3.5s while
// runtime allows. Middle slides take 2.5–3.5s, fewer photos breathing longer.
export const SLIDE_MIN_SECONDS = 2.5;
export const SLIDE_MAX_SECONDS = 3.5;
// Opening/closing slides: aim for 4s, never drop below 3.5s unless the reel is
// too short to give every slide its minimum (only 10s reels — see the deficit
// fallback in allocateSlideFrames).
export const EDGE_TARGET_SECONDS = 4.0;
export const EDGE_MIN_SECONDS = 3.5;

export type SlideTiming = {from: number; dur: number};

export type HeartfeltTiming = {
  // One entry per photo slide, in order. `dur` excludes the crossfade tail a
  // template adds when it builds the Sequence.
  slides: SlideTiming[];
  // Total frames of photo slides == the frame the branded outro starts on.
  photoTotal: number;
  outroFrames: number;
};

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/**
 * Seconds each middle slide aims for, driven purely by the image count: fewer
 * photos can each breathe longer, more photos tighten toward the 2.5s floor.
 * 3 images -> 3.5s, 4 -> 3.0s, 5 -> 2.5s.
 */
const middleSlideSeconds = (photoCount: number) =>
  clamp(SLIDE_MAX_SECONDS - (photoCount - 3) * 0.5, SLIDE_MIN_SECONDS, SLIDE_MAX_SECONDS);

/**
 * Split exactly `budget` frames across `photoCount` slides.
 *
 * Edges (first/last) start at EDGE_TARGET_SECONDS and middles at
 * middleSlideSeconds(); the reconciliation passes then bend that shape to fit
 * `budget` exactly, always sacrificing (or growing) the middles before the
 * edges so the opening and closing keep their emphasis.
 */
const allocateSlideFrames = (budget: number, photoCount: number, fps: number): number[] => {
  const minF = Math.round(SLIDE_MIN_SECONDS * fps);
  const maxF = Math.round(SLIDE_MAX_SECONDS * fps);
  const edgeTargetF = Math.round(EDGE_TARGET_SECONDS * fps);
  const edgeMinF = Math.round(EDGE_MIN_SECONDS * fps);
  const middleF = Math.round(middleSlideSeconds(photoCount) * fps);

  const middleIdx: number[] = [];
  const edgeIdx: number[] = [];
  const lengths = new Array<number>(photoCount).fill(0);
  for (let i = 0; i < photoCount; i++) {
    const isEdge = i === 0 || i === photoCount - 1;
    lengths[i] = isEdge ? edgeTargetF : middleF;
    (isEdge ? edgeIdx : middleIdx).push(i);
  }

  // Leftover single frames from integer division go to edges first, so a
  // rounding remainder can never leave an edge a frame shorter than a middle.
  const spareOrder = [...edgeIdx, ...middleIdx];

  let diff = budget - sum(lengths);

  // --- Surplus: grow the middles up to the 3.5s cap first. ---
  for (const i of middleIdx) {
    if (diff <= 0) break;
    const add = Math.min(maxF - lengths[i], diff);
    lengths[i] += add;
    diff -= add;
  }
  // Still surplus: every middle is capped and the edges want to stay longest, so
  // spread the rest evenly (edges keep their head start, so stay >= middles).
  if (diff > 0) {
    const each = Math.floor(diff / photoCount);
    for (let i = 0; i < photoCount; i++) lengths[i] += each;
    diff -= each * photoCount;
    for (let i = 0; diff > 0; i++) {
      lengths[spareOrder[i % photoCount]] += 1;
      diff -= 1;
    }
  }

  // --- Deficit: shave the middles toward 2.5s, edges untouched. ---
  for (const i of middleIdx) {
    if (diff >= 0) break;
    const cut = Math.min(lengths[i] - minF, -diff);
    lengths[i] -= cut;
    diff += cut;
  }
  // Still short: pull the edges down toward their 3.5s minimum before anything
  // drops below the emphasis floor.
  for (const i of edgeIdx) {
    if (diff >= 0) break;
    const cut = Math.min(lengths[i] - edgeMinF, -diff);
    lengths[i] -= cut;
    diff += cut;
  }
  // Still short: the runtime genuinely can't hold the minimums (a 10s reel).
  // Scale everything down proportionally so the reel stays its requested length
  // rather than overrunning — edges stay proportionally largest.
  if (diff < 0) {
    const total = sum(lengths);
    const scale = budget / total;
    for (let i = 0; i < photoCount; i++) lengths[i] = Math.max(1, Math.floor(lengths[i] * scale));
    let drift = budget - sum(lengths);
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
 * Plan the Heartfelt timeline: photo slides then a branded outro, together
 * filling `durationInFrames` exactly. The photo slides consume everything the
 * outro doesn't, paced by allocateSlideFrames.
 */
export const planHeartfeltTiming = ({
  durationInFrames,
  fps,
  photoCount,
}: {
  durationInFrames: number;
  fps: number;
  photoCount: number;
}): HeartfeltTiming => {
  const outroFrames = Math.min(Math.round(fps * 5), Math.max(Math.round(fps * 2), Math.round(durationInFrames * 0.15)));
  // Never let the outro starve the slides of at least a frame each.
  const slideBudget = Math.max(photoCount, durationInFrames - outroFrames);

  const lengths = allocateSlideFrames(slideBudget, photoCount, fps);

  const slides: SlideTiming[] = [];
  let cursor = 0;
  for (const dur of lengths) {
    slides.push({from: cursor, dur});
    cursor += dur;
  }

  return {slides, photoTotal: cursor, outroFrames};
};
