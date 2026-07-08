export const FPS = 30;

export type ScheduleItem = {name: string; time: string};

export type WeddingProps = {
  couple: {partnerOne: string; partnerTwo: string};
  eventDate: string;
  venue: {name: string; city: string};
  message?: string;
  photos?: string[];
  musicUrl?: string | null;
  schedule?: ScheduleItem[];
  durationInSeconds?: number;
};

export const defaultProps: WeddingProps = {
  couple: {partnerOne: 'Aisha', partnerTwo: 'Rohan'},
  eventDate: 'November 21, 2026',
  venue: {name: 'The Leela Palace', city: 'Udaipur'},
  message: 'Together with their families, they invite you to celebrate the beginning of their forever.',
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
