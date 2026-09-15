export const FPS = 30;

export type ScheduleItem = {name: string; time: string};

export type TimelineScreen = {
  backgroundImage?: string;
  title?: string;
  message?: string;
};

export type TimelineMoment = TimelineScreen & {monthYear?: string};

export type TimelineData = {
  opening: TimelineScreen;
  items: TimelineMoment[];
  closing: TimelineScreen;
};

export type ResolvedCopy = {
  celebrantName?: string;
  senderName?: string;
  recipientTerm?: string;
  senderTerm?: string;
  recipientPronoun?: string;
  relationshipLabel?: string;
  occasion?: string;
  occasionLabel?: string;
  introMessage?: string;
  finalMessage?: string;
  photoMessages?: string[];
  timeline?: TimelineData;
};

export type ThemeAssetPlacement = {
  id: string;
  assetId: string;
  assetType: 'image' | 'video';
  mimeType?: string;
  url: string;
  layer: 'base' | 'background' | 'midground' | 'foreground' | 'overlay' | 'watermark';
  zIndex?: number;
  opacity?: number;
  blendMode?: React.CSSProperties['mixBlendMode'];
  behavior?: 'stack' | 'replace';
  layout?: {
    fit?: React.CSSProperties['objectFit'];
    positionX?: number;
    positionY?: number;
    scale?: number;
    rotation?: number;
  };
  timing?: {
    startOffsetSeconds?: number;
    endOffsetSeconds?: number | null;
    loop?: boolean;
  };
  animation?: {
    preset?: 'none' | 'fade-in' | 'slow-zoom' | 'float-up' | 'slow-drift' | 'petal-fall' | 'rotate-slow';
    speed?: number;
    intensity?: number;
  };
};

export type ResolvedTheme = {
  version?: number;
  assetIds?: string[];
  screens?: Record<string, {
    role: 'first' | 'center' | 'last';
    layers: Partial<Record<ThemeAssetPlacement['layer'], ThemeAssetPlacement[]>>;
  }>;
};

export type WeddingProps = {
  couple: {partnerOne: string; partnerTwo: string};
  eventDate: string;
  venue: {name: string; city: string};
  message?: string;
  displayMessage?: string;
  photos?: string[];
  musicUrl?: string | null;
  schedule?: ScheduleItem[];
  tags?: string[];
  durationInSeconds?: number;
  // Frame rate for this render. Free videos use a lower fps to cut render cost;
  // when unset, the composition's default (FPS) applies. Templates must read the
  // effective rate from useVideoConfig().fps — never the FPS constant — so their
  // pacing and audio stay in sync when this changes.
  fps?: number;
  // Data-driven categories (e.g. "From My Heart"): the raw field bag, the
  // category name, and backend-resolved, token-substituted copy.
  category?: string;
  fields?: Record<string, unknown>;
  resolved?: ResolvedCopy;
  // Template settings resolved by the backend (maxImages, maxSlides, durations,
  // captionPerImage, plus message capability entries).
  settings?: {
    minImages?: number;
    maxImages?: number;
    maxSlides?: number;
    durations?: number[];
    captionPerImage?: boolean;
    [key: string]: unknown;
  };
  // Published theme assets resolved by the backend into stable per-screen
  // layers. Optional so every existing render payload remains valid.
  theme?: ResolvedTheme;
  templateVersion?: number;
  qualityProfile?: Record<string, unknown>;
};

export const defaultProps: WeddingProps = {
  couple: {partnerOne: 'Aisha', partnerTwo: 'Rohan'},
  eventDate: 'November 21, 2026',
  venue: {name: 'The Leela Palace', city: 'Udaipur'},
  message: 'Together with our families, we invite you to celebrate the beginning of our forever bond.',
  displayMessage:
    "The moment we've all been waiting for — {{brideFirstName}} & {{groomFirstName}} invite you to witness their wedding vows{{#weddingDate}} on {{weddingDate}}{{/weddingDate}}{{#location}} in {{location}}{{/location}}.",
  photos: [],
  musicUrl: null,
  schedule: [
    {name: 'Haldi', time: '10:00 AM'},
    {name: 'Sangeet', time: '7:00 PM'},
    {name: 'Wedding', time: '11:30 AM'},
  ],
  durationInSeconds: 30,
};

export const sectionPlan = (durationInFrames: number) => {
  const intro = Math.round(durationInFrames * 0.18);
  const message = Math.round(durationInFrames * 0.18);
  const photos = Math.round(durationInFrames * 0.3);
  const schedule = Math.round(durationInFrames * 0.17);
  const finale = durationInFrames - intro - message - photos - schedule;
  return {intro, message, photos, schedule, finale};
};
