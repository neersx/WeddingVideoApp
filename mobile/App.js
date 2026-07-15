import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { fetch as expoFetch } from 'expo/fetch';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

WebBrowser.maybeCompleteAuthSession();
const API = process.env.EXPO_PUBLIC_API_URL || 'https://invitavideos.com/api';
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
// Google requires a platform client ID on iOS/Android. Falling back to the web
// client keeps the app usable while local OAuth is being configured; use a real
// iOS client ID for production sign-in.
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || GOOGLE_CLIENT_ID;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || GOOGLE_CLIENT_ID;
const IOS_GOOGLE_REDIRECT_URI = IOS_CLIENT_ID
  ? `${IOS_CLIENT_ID.split('.').reverse().join('.')}:/oauthredirect`
  : undefined;
const DISABLE_GOOGLE_AUTH = ['1', 'true', 'yes', 'on'].includes((process.env.EXPO_PUBLIC_DISABLE_GOOGLE_AUTH || '').toLowerCase());

const STEPS = [
  { key: 'Category', title: 'Pick a style', caption: 'Choose the occasion and a template that fits your story.' },
  { key: 'Details', title: 'Add the details', caption: 'Names, date and a personal message for your guests.' },
  { key: 'Photos', title: 'Your photos', caption: 'Add up to 8 photos — portrait shots look best.' },
  { key: 'Music', title: 'Set the mood', caption: 'Pick a soundtrack, then render your video.' },
];

const CATEGORY_ICONS = { Wedding: '💍', Engagement: '💐', Birthday: '🎂' };

// Design tokens — shared across every component so iOS and Android render identically.
const palette = {
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

function absoluteVideoUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const origin = API.replace(/\/api\/?$/, '');
  return `${origin}${value.startsWith('/') ? value : `/${value}`}`;
}

async function json(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || 'Request failed');
  return body;
}

async function uploadPhoto(photo) {
  const file = new File(photo.uri);
  const form = new FormData();
  form.append('file', file);
  const response = await expoFetch(`${API}/upload`, { method: 'POST', body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || `Photo upload failed (${response.status})`);
  return body;
}

async function normalizePhotoForRender(photo) {
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

export default function App() {
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [category, setCategory] = useState('Wedding');
  const [template, setTemplate] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [musicId, setMusicId] = useState('');
  const [details, setDetails] = useState({ partnerOne: '', partnerTwo: '', firstName: '', lastName: '', eventDate: '', venueName: '', city: '', message: '', durationInSeconds: '10' });
  const [user, setUser] = useState(DISABLE_GOOGLE_AUTH ? { email: 'local-dev@invitavideos.test', name: 'Local Development User' } : null);
  const [credential, setCredential] = useState(DISABLE_GOOGLE_AUTH ? 'local-development' : null);
  const [status, setStatus] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [localVideoUri, setLocalVideoUri] = useState(null);
  const [videoAction, setVideoAction] = useState('');
  const [error, setError] = useState('');
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    redirectUri: Platform.OS === 'ios' ? IOS_GOOGLE_REDIRECT_URI : undefined,
  });

  useEffect(() => { json('/templates').then(setTemplates).catch((e) => setError(e.message)); json('/music').then(setTracks).catch(() => {}); }, []);
  useEffect(() => {
    if (response?.type !== 'success') return;
    const token = response.authentication?.idToken || response.params?.id_token;
    if (!token) return setError('Google did not return an ID token. Check your Expo client IDs.');
    json('/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: token }) }).then((data) => { setUser(data.user || data); setCredential(token); }).catch((e) => setError(e.message));
  }, [response]);

  const categories = useMemo(() => [...new Set(templates.map((t) => t.category).filter(Boolean))], [templates]);
  const visibleTemplates = useMemo(() => templates.filter((t) => (t.category || '').toLowerCase() === category.toLowerCase()), [templates, category]);
  const visibleTracks = useMemo(() => tracks.filter((t) => !t.categories || t.categories.length === 0 || t.categories.includes(category)), [tracks, category]);

  useEffect(() => { if (!template && visibleTemplates[0]) setTemplate(visibleTemplates[0]); }, [visibleTemplates, template]);
  const setField = (key, value) => setDetails((current) => ({ ...current, [key]: value }));

  async function choosePhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photos permission needed', 'Allow photo access to add images to your video.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: 8, quality: 0.9 });
    if (!result.canceled) setPhotos(result.assets);
  }

  const removePhoto = (uri) => setPhotos((current) => current.filter((photo) => photo.uri !== uri));

  async function createVideo() {
    setError(''); setVideoUrl(null); setLocalVideoUri(null);
    if (!credential && !DISABLE_GOOGLE_AUTH) return setError('Sign in with Google before creating a video.');
    if (!template) return setError('Choose a template first.');
    setIsWorking(true);
    try {
      setStatus('Preparing photos…');
      const uploaded = [];
      for (let index = 0; index < photos.length; index += 1) { setStatus(`Uploading photo ${index + 1} of ${photos.length}…`); const prepared = await normalizePhotoForRender(photos[index]); const result = await uploadPhoto(prepared); uploaded.push(result.url); }
      setStatus('Starting render…');
      const nameOne = category === 'Birthday' ? details.firstName : details.partnerOne;
      const nameTwo = category === 'Birthday' ? details.lastName : details.partnerTwo;
      const render = await json('/renders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` }, body: JSON.stringify({ template: template.id, couple: { partnerOne: nameOne || 'Your', partnerTwo: nameTwo || 'Story' }, eventDate: details.eventDate, venue: { name: details.venueName, city: details.city }, message: details.message, photos: uploaded, musicId: musicId || template.defaultMusicId || undefined, durationInSeconds: Number(details.durationInSeconds) || 10, tags: [category.toLowerCase()] }) });
      let current = render;
      for (let i = 0; i < 90 && !['done', 'failed'].includes(current.status); i += 1) { await new Promise((resolve) => setTimeout(resolve, 2000)); current = await json(`/renders/${render.jobId}`, { headers: { Authorization: `Bearer ${credential}` } }); const progress = Number(current.progress || 0); setStatus(`Rendering… ${Math.round(progress <= 1 ? progress * 100 : progress)}%`); }
      if (current.status === 'failed') throw new Error(current.error || 'Render failed');
      if (current.status !== 'done') throw new Error('The video is still rendering. Please try again shortly.');
      setVideoUrl(current.videoUrl || current.video_url); setStatus('Your video is ready!');
    } catch (e) { setError(e.message); setStatus(''); }
    finally { setIsWorking(false); }
  }

  async function getLocalVideo() {
    if (localVideoUri) {
      const cached = new File(localVideoUri);
      if (cached.exists) return cached.uri;
    }
    const remoteUrl = absoluteVideoUrl(videoUrl);
    if (!remoteUrl) throw new Error('The video is not ready yet.');
    const destination = new File(Paths.cache, `invitavideos-${Date.now()}.mp4`);
    const downloaded = await File.downloadFileAsync(remoteUrl, destination);
    setLocalVideoUri(downloaded.uri);
    return downloaded.uri;
  }

  async function shareVideo() {
    setError(''); setVideoAction('Preparing video to share…');
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      const uri = await getLocalVideo();
      await Sharing.shareAsync(uri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4', dialogTitle: 'Share your InvitaVideos reel' });
    } catch (e) { setError(e.message || 'The video could not be shared.'); }
    finally { setVideoAction(''); }
  }

  async function saveVideo() {
    setError(''); setVideoAction('Saving video to Photos…');
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true, ['video']);
      if (!permission.granted) throw new Error('Allow Photos access to save the video to your device.');
      const uri = await getLocalVideo();
      await MediaLibrary.Asset.create(uri);
      Alert.alert('Video saved', 'Your InvitaVideos reel is now in Photos.');
    } catch (e) { setError(e.message || 'The video could not be saved.'); }
    finally { setVideoAction(''); }
  }

  const next = () => { if (step === 0 && !template) return setError('Choose a template first.'); setError(''); setStep((n) => Math.min(3, n + 1)); };
  const previous = () => { setError(''); setStep((n) => Math.max(0, n - 1)); };

  const activeStep = STEPS[step];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.brandRow}>
            <Image source={require('./assets/icon.png')} style={styles.brandLogo} />
            <Text style={styles.brand}>InvitaVideos</Text>
            {user ? <View style={styles.avatarChip}><Text style={styles.avatarText}>{(user.name || user.email || '?').slice(0, 1).toUpperCase()}</Text></View> : null}
          </View>

          {/* Progress */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
          </View>
          <View style={styles.stepsRow}>
            {STEPS.map((item, index) => (
              <Pressable key={item.key} onPress={() => index < step && setStep(index)} style={styles.stepItem} hitSlop={8}>
                <View style={[styles.stepDot, index === step && styles.stepDotActive, index < step && styles.stepDotDone]}>
                  <Text style={[styles.stepNumber, (index === step || index < step) && styles.stepNumberActive]}>{index < step ? '✓' : index + 1}</Text>
                </View>
                <Text style={[styles.stepLabel, index === step && styles.stepLabelActive]}>{item.key}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.title}>{activeStep.title}</Text>
          <Text style={styles.subtitle}>{activeStep.caption}</Text>

          {step === 0 && (
            <>
              <View style={styles.chips}>
                {(categories.length ? categories : ['Wedding', 'Engagement', 'Birthday']).map((item) => (
                  <Pressable key={item} onPress={() => { setCategory(item); setTemplate(null); setMusicId(''); }} style={[styles.chip, category === item && styles.chipActive]}>
                    <Text style={styles.chipIcon}>{CATEGORY_ICONS[item] || '✨'}</Text>
                    <Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.sectionTitle}>Templates</Text>
              <FlatList
                horizontal
                data={visibleTemplates}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.templateList}
                renderItem={({ item }) => {
                  const selected = template?.id === item.id;
                  return (
                    <Pressable onPress={() => setTemplate(item)} style={[styles.templateCard, selected && styles.templateSelected]}>
                      <View style={styles.swatchRow}>
                        {(item.swatch || [palette.coral, palette.gold, palette.surfaceRaised]).slice(0, 4).map((color, i) => (
                          <View key={`${color}-${i}`} style={[styles.swatch, { backgroundColor: color }]} />
                        ))}
                      </View>
                      <View style={styles.templateBody}>
                        <View style={styles.templateHeader}>
                          <Text style={styles.templateName} numberOfLines={1}>{item.name}</Text>
                          {selected ? <View style={styles.checkBadge}><Text style={styles.checkBadgeText}>✓</Text></View> : null}
                        </View>
                        <Text style={styles.templateDesc} numberOfLines={2}>{item.desc || `${item.style || 'Cinematic'} template`}</Text>
                        <View style={styles.templateFooter}>
                          <Text style={styles.templateTag}>{item.style || 'Cinematic'}</Text>
                          <Text style={styles.templateCount}>{item.renderCount || 0} created</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                }}
              />
            </>
          )}

          {step === 1 && (
            <View style={styles.card}>
              {category === 'Birthday' ? (
                <View style={styles.fieldRow}>
                  <Field label="First name" value={details.firstName} onChangeText={(v) => setField('firstName', v)} placeholder="Ava" style={styles.flex} />
                  <Field label="Last name" value={details.lastName} onChangeText={(v) => setField('lastName', v)} placeholder="Sharma" style={styles.flex} />
                </View>
              ) : (
                <View style={styles.fieldRow}>
                  <Field label="Partner 1" value={details.partnerOne} onChangeText={(v) => setField('partnerOne', v)} placeholder="Aarav" style={styles.flex} />
                  <Field label="Partner 2" value={details.partnerTwo} onChangeText={(v) => setField('partnerTwo', v)} placeholder="Meera" style={styles.flex} />
                </View>
              )}
              <Field label="Event date" value={details.eventDate} onChangeText={(v) => setField('eventDate', v)} placeholder="14 December 2026" />
              <View style={styles.fieldRow}>
                <Field label="Venue" value={details.venueName} onChangeText={(v) => setField('venueName', v)} placeholder="The Grand Palace" style={styles.flex} />
                <Field label="City" value={details.city} onChangeText={(v) => setField('city', v)} placeholder="Jaipur" style={styles.flex} />
              </View>
              <Field label="Message to guests" value={details.message} onChangeText={(v) => setField('message', v)} placeholder="Join us as we begin our forever…" multiline />
              <Field label="Video duration (seconds)" value={details.durationInSeconds} onChangeText={(v) => setField('durationInSeconds', v)} keyboardType="number-pad" />
            </View>
          )}

          {step === 2 && (
            <>
              <View style={styles.photoGrid}>
                {photos.map((photo) => (
                  <View key={photo.uri} style={styles.photoWrap}>
                    <Image source={{ uri: photo.uri }} style={styles.photo} />
                    <Pressable onPress={() => removePhoto(photo.uri)} style={styles.photoRemove} hitSlop={8}>
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                {photos.length < 8 && (
                  <Pressable style={styles.addTile} onPress={choosePhotos}>
                    <Text style={styles.addTilePlus}>＋</Text>
                    <Text style={styles.addTileText}>{photos.length ? 'Change' : 'Add photos'}</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.helper}>{photos.length ? `${photos.length} of 8 photos selected` : 'Portrait photos with faces work best.'}</Text>
            </>
          )}

          {step === 3 && (
            <>
              {visibleTracks.map((track) => {
                const selected = musicId === track.id;
                return (
                  <Pressable key={track.id} onPress={() => setMusicId(selected ? '' : track.id)} style={[styles.track, selected && styles.trackSelected]}>
                    <View style={[styles.trackIcon, selected && styles.trackIconActive]}><Text style={styles.trackIconText}>♫</Text></View>
                    <View style={styles.flex}>
                      <Text style={styles.trackTitle} numberOfLines={1}>{track.title || track.name}</Text>
                      <Text style={styles.trackMeta} numberOfLines={1}>{track.artist || 'InvitaVideos library'}{track.duration ? ` · ${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : ''}</Text>
                    </View>
                    <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>{selected ? <View style={styles.radioInner} /> : null}</View>
                  </Pressable>
                );
              })}
              {!visibleTracks.length && <Text style={styles.helper}>No music has been assigned to this category yet. You can render without selecting a track.</Text>}

              <View style={styles.loginBox}>
                <Text style={styles.loginTitle}>
                  {DISABLE_GOOGLE_AUTH ? 'Google login disabled (development mode)' : user ? `Signed in as ${user.email || user.name || 'Google user'}` : 'Sign in to create your video'}
                </Text>
                {!user && (
                  <Pressable disabled={!request} onPress={() => promptAsync()} style={styles.googleButton}>
                    <Text style={styles.googleG}>G</Text>
                    <Text style={styles.googleText}>Continue with Google</Text>
                  </Pressable>
                )}
              </View>

              <Pressable disabled={isWorking} onPress={createVideo} style={[styles.renderButton, isWorking && styles.buttonDisabled]}>
                {isWorking ? <ActivityIndicator color={palette.bg} /> : null}
                <Text style={styles.renderText}>{isWorking ? 'Creating video…' : '✦ Render my video'}</Text>
              </Pressable>
            </>
          )}

          {error ? (
            <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View>
          ) : null}
          {status ? (
            <View style={styles.status}>
              {isWorking ? <ActivityIndicator color={palette.gold} /> : <Text style={styles.readyMark}>✓</Text>}
              <Text style={styles.statusText}>{status}</Text>
            </View>
          ) : null}

          {videoUrl ? (
            <View style={styles.result}>
              <Text style={styles.resultTitle}>Ready to share 🎉</Text>
              <RenderedVideo uri={absoluteVideoUrl(videoUrl)} />
              <View style={styles.videoActions}>
                <Pressable disabled={Boolean(videoAction)} onPress={shareVideo} style={[styles.shareButton, videoAction && styles.buttonDisabled]}>
                  <Text style={styles.shareButtonText}>Share video</Text>
                </Pressable>
                <Pressable disabled={Boolean(videoAction)} onPress={saveVideo} style={[styles.saveButton, videoAction && styles.buttonDisabled]}>
                  <Text style={styles.saveButtonText}>Save to Photos</Text>
                </Pressable>
              </View>
              {videoAction ? (
                <View style={styles.actionStatus}>
                  <ActivityIndicator color={palette.gold} />
                  <Text style={styles.actionStatusText}>{videoAction}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Navigation */}
          <View style={styles.nav}>
            {step > 0 ? (
              <Pressable onPress={previous} style={styles.back}><Text style={styles.backText}>← Back</Text></Pressable>
            ) : <View />}
            {step < 3 && (
              <Pressable onPress={next} style={styles.next}><Text style={styles.nextText}>Continue →</Text></Pressable>
            )}
          </View>

          <Text style={styles.footer} onPress={() => Linking.openURL('https://invitavideos.com')}>InvitaVideos.com</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, props.multiline && styles.multiline, focused && styles.inputFocused]}
        placeholderTextColor={palette.textMuted}
        selectionColor={palette.gold}
      />
    </View>
  );
}

function RenderedVideo({ uri }) {
  const player = useVideoPlayer({ uri, contentType: 'progressive' }, (instance) => { instance.loop = false; });
  const playback = useEvent(player, 'statusChange', { status: player.status, error: null });
  useEffect(() => { if (playback.status === 'readyToPlay') player.play(); }, [playback.status, player]);
  return (
    <View>
      <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
      {playback.status === 'loading' ? (
        <View style={styles.videoLoading}>
          <ActivityIndicator color={palette.gold} />
          <Text style={styles.videoLoadingText}>Loading video…</Text>
        </View>
      ) : null}
      {playback.status === 'error' ? <Text style={styles.videoError}>Video could not be loaded: {playback.error?.message || 'unknown playback error'}</Text> : null}
    </View>
  );
}

const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 6 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 20, paddingBottom: 48, paddingTop: Platform.OS === 'android' ? 44 : 12 },

  // Header
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  brandLogo: { width: 36, height: 36, borderRadius: 10 },
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
  multiline: { minHeight: 90, textAlignVertical: 'top' },

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
  loginBox: { backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 16, marginTop: 16, marginBottom: 14 },
  loginTitle: { color: palette.textSoft, fontWeight: '600', fontSize: 13.5, marginBottom: 0 },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 13, marginTop: 12 },
  googleG: { color: '#4285F4', fontWeight: '900', fontSize: 16 },
  googleText: { color: '#1f1f1f', fontWeight: '700', fontSize: 15 },
  renderButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: palette.gold, borderRadius: 14, padding: 17, ...cardShadow },
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
});
