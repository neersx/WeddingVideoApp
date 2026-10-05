import type {DreamWeddsWeddingProps} from './types';

export type WeddingStyle = {
  id: string;
  label: string;
  motif: 'palace' | 'garden' | 'arches' | 'lotus' | 'floral' | 'rings';
  colors: {bg: string; deep: string; glow: string; gold: string; paper: string; ink: string; text: string; accent: string};
  fontFamily: string;
  letterSpacing: number;
  portraitRadius: string;
  copy: {opening: string; event: string; invitation: string};
};

const base: Omit<WeddingStyle, 'id' | 'label' | 'motif' | 'colors'> = {
  fontFamily: 'InvitationSerif, Georgia, serif', letterSpacing: 6,
  portraitRadius: '370px 370px 12px 12px',
  copy: {opening: 'An invitation to our forever', event: 'The day we say I do', invitation: 'Join us for love, laughter and a beautiful beginning.'},
};
export const WEDDING_STYLES: Record<string, WeddingStyle> = {
  'indian-royal': {
    ...base, id: 'indian-royal', label: 'Indian Royal', motif: 'palace',
    colors: {bg: '#661F30', deep: '#2D0D1A', glow: '#9B4050', gold: '#E6B85C', paper: '#FFF2D8', ink: '#4D1828', text: '#FFF2D8', accent: '#F3CB76'},
    copy: {...base.copy, opening: 'Together with our families', event: 'A celebration of love and togetherness'},
  },
  'english-garden': {
    ...base, id: 'english-garden', label: 'English Garden', motif: 'garden',
    fontFamily: 'Georgia, InvitationSerif, serif', letterSpacing: 4,
    portraitRadius: '300px 300px 18px 18px',
    colors: {bg: '#E8EBDD', deep: '#CFD8C7', glow: '#FFFCF3', gold: '#8B7547', paper: '#FFFCF4', ink: '#304638', text: '#304638', accent: '#4E654C'},
    copy: {...base.copy, opening: 'Together in love', event: 'The day we exchange our vows'},
  },
  'emerald-arches': {
    ...base, id: 'emerald-arches', label: 'Emerald Arches', motif: 'arches',
    portraitRadius: '420px 420px 12px 12px',
    colors: {bg: '#103C36', deep: '#061F20', glow: '#2F6457', gold: '#D7BD80', paper: '#FFF5DE', ink: '#153F35', text: '#FFF5DE', accent: '#E8CF95'},
    copy: {...base.copy, opening: 'Together with our families', event: 'A beautiful union, a new beginning'},
  },
  'lotus-serenity': {
    ...base, id: 'lotus-serenity', label: 'Lotus Serenity', motif: 'lotus',
    letterSpacing: 5, portraitRadius: '160px 160px 18px 18px',
    colors: {bg: '#49364F', deep: '#241D31', glow: '#7C5C79', gold: '#E2BF7D', paper: '#FFF4E5', ink: '#453149', text: '#FFF4E5', accent: '#F0CE9A'},
    copy: {...base.copy, opening: 'With love and gratitude', event: 'A joyful beginning together'},
  },
  'neutral-romance': {
    ...base, id: 'neutral-romance', label: 'Neutral Romance', motif: 'floral',
    portraitRadius: '80px', letterSpacing: 4,
    colors: {bg: '#EEDDE0', deep: '#DBC2CB', glow: '#FFF7EF', gold: '#92704C', paper: '#FFFAF3', ink: '#573846', text: '#573846', accent: '#76505C'},
  },
  'forest-gold': {
    ...base, id: 'forest-gold', label: 'Forest Gold', motif: 'rings',
    colors: {bg: '#102C26', deep: '#071C18', glow: '#34564A', gold: '#C4B181', paper: '#F4EFE3', ink: '#102C26', text: '#F4EFE3', accent: '#C4B181'},
  },
};
const clean = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase().replace(/[_\s]+/g, '-') : '';
const traditionStyles: Record<string, string> = {
  hindu: 'indian-royal', hinduism: 'indian-royal',
  christian: 'english-garden', christianity: 'english-garden', catholic: 'english-garden', anglican: 'english-garden', protestant: 'english-garden',
  muslim: 'emerald-arches', islam: 'emerald-arches', islamic: 'emerald-arches', nikah: 'emerald-arches',
  buddhist: 'lotus-serenity', buddhism: 'lotus-serenity',
  secular: 'neutral-romance', civil: 'neutral-romance', interfaith: 'neutral-romance',
};
const cultureStyles: Record<string, string> = {
  ...traditionStyles, indian: 'indian-royal', india: 'indian-royal',
  english: 'english-garden', british: 'english-garden', 'english-christian': 'english-garden',
};

/** Explicit preset > tradition > culture > neutral. Uses raw metadata, never demo defaults. */
export const resolveWeddingStyle = (props: Pick<DreamWeddsWeddingProps, 'fields' | 'dreamwedds'>): WeddingStyle => {
  const fields = props.fields ?? {};
  const nested = props.dreamwedds ?? fields.dreamwedds;
  const details = nested && typeof nested === 'object' ? nested as Record<string, unknown> : {};
  const override = clean(fields.videoStyle || details.videoStyle);
  if (Object.prototype.hasOwnProperty.call(WEDDING_STYLES, override)) return WEDDING_STYLES[override];
  const tradition = clean(fields.weddingTradition || details.tradition || details.weddingTradition);
  const culture = clean(fields.weddingCulture || details.culture || details.weddingCulture);
  // A known denomination within labels such as "Tamil Hindu" is also supported.
  const byTradition = Object.prototype.hasOwnProperty.call(traditionStyles, tradition) ? traditionStyles[tradition]
    : tradition.split('-').map(part => Object.prototype.hasOwnProperty.call(traditionStyles, part) ? traditionStyles[part] : undefined).find(Boolean);
  const byCulture = Object.prototype.hasOwnProperty.call(cultureStyles, culture) ? cultureStyles[culture] : undefined;
  return WEDDING_STYLES[byTradition || byCulture || 'neutral-romance'];
};
