export const FPS = 30;

export type ScheduleItem = {name: string; time: string};

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
};

export const defaultProps: WeddingProps = {
  couple: {partnerOne: 'Aisha', partnerTwo: 'Rohan'},
  eventDate: 'November 21, 2026',
  venue: {name: 'The Leela Palace', city: 'Udaipur'},
  message: 'Together with their families, they invite you to celebrate the beginning of their forever.',
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
