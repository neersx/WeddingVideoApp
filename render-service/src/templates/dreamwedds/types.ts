import {defaultProps, WeddingProps} from '../types';

export type DreamWeddsPerson = {name: string; imageUrl?: string};

export type DreamWeddsDetails = {
  source: 'dreamwedds';
  culture: 'indian' | 'christian' | 'buddhist' | 'muslim';
  template: string;
  weddingId?: string | number | null;
  title: string;
  bride: DreamWeddsPerson;
  groom: DreamWeddsPerson;
  date: string;
  formattedDate: string;
  event: {
    title: string;
    date: string;
    formattedDate: string;
    imageUrl?: string;
    venue: string;
    city: string;
    address: string;
  };
  banners: string[];
  storyImageUrl?: string;
  closingImageUrl?: string;
};

export type DreamWeddsWeddingProps = WeddingProps & {
  dreamwedds?: DreamWeddsDetails;
};

const fallbackDetails: DreamWeddsDetails = {
  source: 'dreamwedds',
  culture: 'indian',
  template: 'dreamwedds-royal-blush',
  weddingId: null,
  title: 'Aisha & Rohan',
  bride: {name: 'Aisha', imageUrl: ''},
  groom: {name: 'Rohan', imageUrl: ''},
  date: '2026-11-21',
  formattedDate: '21 November 2026',
  event: {
    title: 'Grand Wedding',
    date: '2026-11-21',
    formattedDate: '21 November 2026',
    imageUrl: '',
    venue: 'The Leela Palace',
    city: 'Udaipur',
    address: '',
  },
  banners: [],
  storyImageUrl: '',
  closingImageUrl: '',
};

const formatWeddingDate = (value: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}).format(parsed);
};

export const defaultDreamWeddsProps: DreamWeddsWeddingProps = {
  ...defaultProps,
  fields: {dreamwedds: fallbackDetails},
  dreamwedds: fallbackDetails,
};

export const resolveDreamWeddsDetails = (props: DreamWeddsWeddingProps): DreamWeddsDetails => {
  const nested = props.fields?.dreamwedds;
  const details = (props.dreamwedds ?? (nested && typeof nested === 'object' ? nested : null)) as Partial<DreamWeddsDetails> | null;
  const photos = props.photos ?? [];
  const eventTitle = typeof props.fields?.eventTitle === 'string' ? props.fields.eventTitle : 'Wedding Celebration';
  if (!details) {
    return {
      ...fallbackDetails,
      title: `${props.couple.partnerOne} & ${props.couple.partnerTwo}`,
      bride: {name: props.couple.partnerOne, imageUrl: photos[1] || photos[0]},
      groom: {name: props.couple.partnerTwo, imageUrl: photos[2] || photos[1] || photos[0]},
      date: props.eventDate,
      formattedDate: formatWeddingDate(props.eventDate),
      event: {
        ...fallbackDetails.event,
        title: eventTitle,
        date: props.eventDate,
        formattedDate: props.schedule?.[0]?.time || formatWeddingDate(props.eventDate),
        imageUrl: photos[3] || photos[0],
        venue: props.venue.name,
        city: props.venue.city,
      },
      banners: photos,
      storyImageUrl: photos[4] || photos[0],
      closingImageUrl: photos.at(-1) || photos[0],
    };
  }

  return {
    ...fallbackDetails,
    ...details,
    bride: {...fallbackDetails.bride, ...(details.bride ?? {}), name: details.bride?.name || props.couple.partnerOne, imageUrl: details.bride?.imageUrl || photos[1] || photos[0]},
    groom: {...fallbackDetails.groom, ...(details.groom ?? {}), name: details.groom?.name || props.couple.partnerTwo, imageUrl: details.groom?.imageUrl || photos[2] || photos[1] || photos[0]},
    event: {
      ...fallbackDetails.event,
      ...(details.event ?? {}),
      title: details.event?.title || eventTitle,
      formattedDate: details.event?.formattedDate || details.formattedDate || props.eventDate,
      venue: details.event?.venue || props.venue.name,
      city: details.event?.city || props.venue.city,
      imageUrl: details.event?.imageUrl || photos[3] || photos[0],
    },
    banners: Array.isArray(details.banners) && details.banners.some(Boolean) ? details.banners.filter(Boolean) : photos,
    storyImageUrl: details.storyImageUrl || photos[4] || photos[0],
    closingImageUrl: details.closingImageUrl || photos.at(-1) || photos[0],
  };
};
