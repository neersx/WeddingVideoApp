import { Platform, StyleSheet } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export const API = process.env.EXPO_PUBLIC_API_URL || 'https://invitavideos.com/api';
// Native Google Sign-In only needs the WEB client ID — it's the audience the
// idToken is issued for. The Android/iOS client IDs stay in Google Cloud
// Console for SHA-1/bundle-ID verification but aren't referenced in JS.
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
export const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
export const DISABLE_GOOGLE_AUTH = ['1', 'true', 'yes', 'on'].includes((process.env.EXPO_PUBLIC_DISABLE_GOOGLE_AUTH || '').toLowerCase());

if (!DISABLE_GOOGLE_AUTH) {
  GoogleSignin.configure({
    webClientId: GOOGLE_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    offlineAccess: false,
  });
}

export const STEPS = [
  { key: 'Details', title: 'Style & details', caption: 'Pick a template, then add names, date and a personal message.' },
  { key: 'Photos', title: 'Your photos', caption: 'Add up to 8 photos — portrait shots look best.' },
  { key: 'Music', title: 'Set the mood', caption: 'Pick a soundtrack, then render your video.' },
];

export const CATEGORY_ICONS = { Wedding: '💍', Engagement: '💐', Birthday: '🎂' };
export const CATEGORY_TYPE_LABELS = { invitation: 'Invitation', personal: 'Personal' };

// Default wedding event schedule — mirrors the web frontend (frontend/src/App.js).
export const WEDDING_SCHEDULE = [
  { name: 'Haldi', time: '10:00 AM' },
  { name: 'Sangeet', time: '7:00 PM' },
  { name: 'Wedding', time: '11:30 AM' },
];

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Design tokens — shared across every component so iOS and Android render identically.
export const palette = {
  bg: '#120C1D',
  surface: '#1D152B',
  surfaceRaised: '#251B36',
  border: '#352947',
  borderStrong: '#4A3A61',
  gold: '#E9B872',
  goldDeep: '#C9932F',
  coral: '#D97757',
  text: '#F7F3FB',
  textSoft: '#B7ABC8',
  textMuted: '#847795',
  success: '#6FD695',
  danger: '#FF9B9B',
};

export function absoluteVideoUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const origin = API.replace(/\/api\/?$/, '');
  return `${origin}${value.startsWith('/') ? value : `/${value}`}`;
}

export async function json(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.detail || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return body;
}

export function decodeJwtExp(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64).split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    );
    return JSON.parse(json).exp || null;
  } catch {
    return null;
  }
}

// Google ID tokens expire ~1h after sign-in. Treat as expired 30s early.
export function isCredentialExpired(token) {
  if (!token) return true;
  const exp = decodeJwtExp(token);
  if (!exp) return false;
  return Date.now() >= exp * 1000 - 30000;
}

export async function uploadPhoto(photo) {
  const file = new File(photo.uri);
  const form = new FormData();
  form.append('file', file);
  const response = await expoFetch(`${API}/upload`, { method: 'POST', body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || `Photo upload failed (${response.status})`);
  return body;
}

export async function normalizePhotoForRender(photo) {
  const identity = `${photo.fileName || ''} ${photo.mimeType || ''} ${photo.uri || ''}`.toLowerCase();
  const isHeic = identity.includes('image/heic') || identity.includes('image/heif') || /\.(heic|heif)(?:$|\?)/.test(identity);
  if (!isHeic) return photo;
  const context = ImageManipulator.manipulate(photo.uri);
  const rendered = await context.renderAsync();
  const converted = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  const originalName = photo.fileName || 'photo.heic';
  return {
    ...photo,
    uri: converted.uri,
    fileName: originalName.replace(/\.(heic|heif)$/i, '.jpg'),
    mimeType: 'image/jpeg',
  };
}

export const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 6 },
});

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 20, paddingBottom: 48, paddingTop: Platform.OS === 'android' ? 44 : 12 },

  // Header
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 22 },
  // Light plate behind the wordmark — the logo's purple "Invita" is unreadable on the dark bg.
  brandPlate: { backgroundColor: '#FFF8F0', borderRadius: 15, paddingVertical: 3, paddingHorizontal: 10, ...cardShadow },
  brandLogo: { width: 140, height: 40 },
  brand: { color: palette.gold, fontSize: 19, fontWeight: '800', letterSpacing: 0.8, flex: 1 },
  avatarChip: { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.surfaceRaised, borderWidth: 1, borderColor: palette.borderStrong, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.gold, fontWeight: '800', fontSize: 14 },

  // Progress + steps
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: palette.surfaceRaised, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: palette.gold },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 24 },
  stepItem: { alignItems: 'center', gap: 6, flex: 1 },
  stepDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: palette.coral, borderColor: palette.coral },
  stepDotDone: { backgroundColor: palette.surfaceRaised, borderColor: palette.gold },
  stepNumber: { color: palette.textMuted, fontWeight: '700', fontSize: 13 },
  stepNumberActive: { color: palette.text },
  stepLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '600' },
  stepLabelActive: { color: palette.text },

  title: { color: palette.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: palette.textSoft, fontSize: 15, lineHeight: 21, marginTop: 6, marginBottom: 22 },
  sectionTitle: { color: palette.text, fontSize: 17, fontWeight: '700', marginBottom: 12 },

  // Category chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 24, paddingVertical: 10, paddingHorizontal: 16 },
  chipActive: { backgroundColor: palette.coral, borderColor: palette.coral },
  chipIcon: { fontSize: 14 },
  chipText: { color: palette.textSoft, fontWeight: '700', fontSize: 14 },
  chipTextActive: { color: '#fff' },

  // Dynamic-form select options (e.g. relationship picker)
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 14 },
  optionChipActive: { backgroundColor: palette.coral, borderColor: palette.coral },
  optionChipText: { color: palette.textSoft, fontWeight: '600', fontSize: 14 },
  optionChipTextActive: { color: '#fff' },

  // Per-photo caption inputs
  captionSection: { marginTop: 20 },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  captionThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: palette.surface },

  // Template cards
  templateList: { paddingRight: 8, paddingBottom: 8 },
  templateCard: { width: 220, marginRight: 14, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1.5, borderColor: palette.border, overflow: 'hidden', ...cardShadow },
  templateSelected: { borderColor: palette.gold, backgroundColor: palette.surfaceRaised },
  swatchRow: { flexDirection: 'row', height: 64 },
  swatch: { flex: 1 },
  templateBody: { padding: 14 },
  templateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  templateName: { color: palette.text, fontSize: 16, fontWeight: '800', flex: 1 },
  checkBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: palette.gold, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  checkBadgeText: { color: palette.bg, fontWeight: '900', fontSize: 12 },
  templateDesc: { color: palette.textSoft, fontSize: 12.5, lineHeight: 17, marginTop: 6, minHeight: 34 },
  templateFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  templateTag: { color: palette.coral, fontSize: 11, fontWeight: '700', backgroundColor: 'rgba(217,119,87,0.14)', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' },
  templateCount: { color: palette.textMuted, fontSize: 11 },

  // Form
  card: { backgroundColor: palette.surface, borderRadius: 18, borderWidth: 1, borderColor: palette.border, padding: 16, ...cardShadow },
  fieldRow: { flexDirection: 'row', gap: 12 },
  field: { marginBottom: 14 },
  label: { color: palette.textSoft, fontSize: 12.5, fontWeight: '600', marginBottom: 7, letterSpacing: 0.2 },
  input: { backgroundColor: palette.bg, color: palette.text, borderWidth: 1.5, borderColor: palette.border, borderRadius: 12, paddingVertical: Platform.OS === 'ios' ? 13 : 10, paddingHorizontal: 14, fontSize: 15 },
  inputFocused: { borderColor: palette.gold },
  inputRequired: { borderColor: palette.danger },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  durationRow: { flexDirection: 'row', gap: 10 },
  durationOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: palette.bg, borderWidth: 1.5, borderColor: palette.border, borderRadius: 12, paddingVertical: 12 },
  durationOptionSelected: { borderColor: palette.gold, backgroundColor: palette.surfaceRaised },
  durationText: { color: palette.textSoft, fontWeight: '600', fontSize: 14 },
  durationTextSelected: { color: palette.text },

  // Date picker
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateValue: { color: palette.text, fontSize: 15 },
  datePlaceholder: { color: palette.textMuted, fontSize: 15 },
  dateIcon: { fontSize: 15 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  calendarCard: { width: '100%', maxWidth: 360, backgroundColor: palette.surfaceRaised, borderRadius: 20, borderWidth: 1, borderColor: palette.borderStrong, padding: 18, ...cardShadow },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  calendarArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  calendarArrowText: { color: palette.gold, fontSize: 22, fontWeight: '700', marginTop: -2 },
  calendarMonth: { color: palette.text, fontSize: 16, fontWeight: '800' },
  calendarWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calendarWeekday: { flex: 1, textAlign: 'center', color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  calendarDay: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  calendarToday: { borderWidth: 1.5, borderColor: palette.borderStrong },
  calendarSelected: { backgroundColor: palette.gold },
  calendarDayText: { color: palette.text, fontSize: 14, fontWeight: '600' },
  calendarSelectedText: { color: palette.bg, fontWeight: '800' },
  calendarClose: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  calendarCloseText: { color: palette.textSoft, fontWeight: '700' },

  // Event schedule (Wedding)
  scheduleSection: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 16, marginTop: 4 },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  scheduleTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  addEventButton: { borderWidth: 1.5, borderColor: palette.borderStrong, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14 },
  addEventText: { color: palette.gold, fontSize: 12.5, fontWeight: '700' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  scheduleName: { flex: 1 },
  scheduleTime: { width: 104 },
  scheduleRemove: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  scheduleRemoveText: { color: palette.textMuted, fontSize: 14, fontWeight: '700' },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { position: 'relative' },
  photo: { width: 100, height: 132, borderRadius: 12, backgroundColor: palette.surface },
  photoRemove: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  photoRemoveText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  addTile: { width: 100, height: 132, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.borderStrong, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', gap: 4 },
  addTilePlus: { color: palette.gold, fontSize: 26, fontWeight: '300' },
  addTileText: { color: palette.textSoft, fontSize: 12, fontWeight: '600' },
  helper: { color: palette.textMuted, marginTop: 14, fontSize: 13 },

  // Music
  track: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: palette.border },
  trackSelected: { borderColor: palette.gold, backgroundColor: palette.surfaceRaised },
  trackIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: palette.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  trackIconActive: { backgroundColor: palette.gold },
  trackIconText: { fontSize: 17, color: palette.text },
  trackTitle: { color: palette.text, fontWeight: '700', fontSize: 15 },
  trackMeta: { color: palette.textMuted, marginTop: 3, fontSize: 12.5 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: palette.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: palette.gold },
  radioInner: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: palette.gold },

  // Auth + render
  headerGoogleButton: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#fff', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, ...cardShadow },
  headerGoogleText: { color: '#1f1f1f', fontWeight: '700', fontSize: 13.5 },
  googleG: { color: '#4285F4', fontWeight: '900', fontSize: 16 },
  renderButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: palette.gold, borderRadius: 14, padding: 17, marginTop: 16, ...cardShadow },
  buttonDisabled: { opacity: 0.55 },
  renderText: { color: palette.bg, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

  // Status / errors
  errorBox: { backgroundColor: 'rgba(255,155,155,0.1)', borderWidth: 1, borderColor: 'rgba(255,155,155,0.35)', borderRadius: 12, padding: 13, marginTop: 18 },
  error: { color: palette.danger, lineHeight: 20, fontSize: 13.5 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  statusText: { color: palette.gold, fontWeight: '600' },
  readyMark: { color: palette.success, fontSize: 20, fontWeight: '800' },

  // Result
  result: { marginTop: 26, backgroundColor: palette.surface, borderRadius: 18, borderWidth: 1, borderColor: palette.border, padding: 16, ...cardShadow },
  resultTitle: { color: palette.text, fontSize: 19, fontWeight: '800', marginBottom: 12 },
  confirmBody: { color: palette.textSoft, fontSize: 14.5, lineHeight: 21, marginBottom: 18 },
  video: { width: '100%', height: 440, backgroundColor: '#0D0913', borderRadius: 14 },
  videoLoading: { position: 'absolute', left: 0, right: 0, top: 190, alignItems: 'center', gap: 8 },
  videoLoadingText: { color: palette.textSoft },
  videoError: { color: palette.danger, marginTop: 10, lineHeight: 20 },
  videoActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  shareButton: { flex: 1, backgroundColor: palette.gold, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  shareButtonText: { color: palette.bg, fontWeight: '800' },
  saveButton: { flex: 1, borderWidth: 1.5, borderColor: palette.gold, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonText: { color: palette.gold, fontWeight: '800' },
  actionStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 12 },
  actionStatusText: { color: palette.textSoft },

  // Navigation
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30 },
  back: { paddingVertical: 14, paddingHorizontal: 6 },
  backText: { color: palette.textSoft, fontWeight: '700', fontSize: 15 },
  next: { backgroundColor: palette.coral, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 30, marginLeft: 'auto', ...cardShadow },
  nextText: { color: '#fff', fontWeight: '800', fontSize: 15.5 },

  footer: { color: palette.textMuted, textAlign: 'center', marginTop: 34, fontSize: 13 },

  // Landing screen
  landingHero: { marginBottom: 8 },
  typeSection: { marginBottom: 26 },
  typeSectionTitle: { color: palette.textSoft, fontSize: 12.5, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  categoryCard: { width: '47%', backgroundColor: palette.surface, borderRadius: 18, borderWidth: 1.5, borderColor: palette.border, padding: 16, ...cardShadow },
  categoryCardIcon: { fontSize: 30, marginBottom: 10 },
  categoryCardName: { color: palette.text, fontSize: 16, fontWeight: '800' },
  categoryCardDesc: { color: palette.textMuted, fontSize: 12, lineHeight: 16, marginTop: 6, minHeight: 32 },

  // My Downloads entry link (Landing)
  myDownloadsLink: { alignSelf: 'flex-start', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 16, marginBottom: 22 },
  myDownloadsLinkText: { color: palette.gold, fontWeight: '700', fontSize: 13.5 },

  // Bottom navigation bar — docked, rounded top, elevated, with a Material-You
  // style "active pill" indicator behind the current tab's icon.
  tabBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    paddingHorizontal: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: -6 } },
      android: { elevation: 16 },
    }),
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 2 },
  // Pill that holds the icon; tinted gold when the tab is active.
  tabPill: { width: 58, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  tabPillActive: { backgroundColor: 'rgba(233,184,114,0.16)', borderWidth: 1, borderColor: 'rgba(233,184,114,0.34)' },
  tabIcon: { fontSize: 19, opacity: 0.55 },
  tabIconActive: { opacity: 1 },
  tabLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  tabLabelActive: { color: palette.gold, fontWeight: '800' },

  // My Downloads — cards
  dlCard: { backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: palette.border, marginBottom: 14, overflow: 'hidden', ...cardShadow },
  dlPlayer: { backgroundColor: '#0D0913', borderBottomWidth: 1, borderBottomColor: palette.border },
  dlVideo: { width: '100%', height: 380, backgroundColor: '#0D0913' },
  dlBody: { padding: 16 },
  dlHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  dlTitle: { color: palette.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  dlSubtitle: { color: palette.textSoft, fontSize: 13, fontWeight: '600', marginTop: 2 },
  dlMeta: { color: palette.textMuted, fontSize: 12.5, marginTop: 10, marginBottom: 14 },
  dlNote: { color: palette.textMuted, fontSize: 13, lineHeight: 18 },
  dlActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dlPending: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dlPendingText: { color: palette.textSoft, fontSize: 12.5, fontWeight: '600' },
  dlBusy: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },

  // My Downloads — status chips
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: palette.surfaceRaised, borderWidth: 1, borderColor: palette.border },
  chipReady: { backgroundColor: 'rgba(111,214,149,0.12)', borderColor: 'rgba(111,214,149,0.35)' },
  chipFail: { backgroundColor: 'rgba(255,155,155,0.12)', borderColor: 'rgba(255,155,155,0.35)' },
  chipPending: { backgroundColor: 'rgba(233,184,114,0.12)', borderColor: 'rgba(233,184,114,0.30)' },
  chipText: { color: palette.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  chipTextReady: { color: palette.success },
  chipTextFail: { color: palette.danger },

  // Compact buttons (My Downloads + confirmation)
  smallBtn: { backgroundColor: palette.surfaceRaised, borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 16 },
  smallBtnText: { color: palette.text, fontSize: 13, fontWeight: '700' },
  smallBtnPrimary: { backgroundColor: palette.gold, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 18, alignSelf: 'flex-start' },
  smallBtnPrimaryText: { color: palette.bg, fontSize: 13, fontWeight: '800' },
  dlCreateBtn: { alignSelf: 'center', marginTop: 10, backgroundColor: palette.coral, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28, ...cardShadow },
  dlCreateBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // My Downloads — empty state
  emptyCard: { backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: palette.border, padding: 28, alignItems: 'center', ...cardShadow },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptyBody: { color: palette.textSoft, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 18 },

  // Change-category chip on the Create screen
  changeCategoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.border, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 18 },
  changeCategoryLabel: { color: palette.text, fontWeight: '700', fontSize: 14.5 },
  changeCategoryAction: { color: palette.gold, fontWeight: '700', fontSize: 13 },
});
