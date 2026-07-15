import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { VideoView, useVideoPlayer } from 'expo-video';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';

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
const STEPS = ['Category', 'Details', 'Photos', 'Music'];

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

  async function createVideo() {
    setError(''); setVideoUrl(null);
    if (!credential && !DISABLE_GOOGLE_AUTH) return setError('Sign in with Google before creating a video.');
    if (!template) return setError('Choose a template first.');
    setIsWorking(true);
    try {
      setStatus('Uploading photos…');
      const uploaded = [];
      for (const photo of photos) { const result = await uploadPhoto(photo); uploaded.push(result.url); }
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

  const next = () => { if (step === 0 && !template) return setError('Choose a template first.'); setError(''); setStep((n) => Math.min(3, n + 1)); };
  const previous = () => { setError(''); setStep((n) => Math.max(0, n - 1)); };

  return <SafeAreaView style={styles.safe}><StatusBar style="light" /><ScrollView contentContainerStyle={styles.container}>
    <View style={styles.brandRow}><Image source={require('./assets/icon.png')} style={styles.brandLogo} /><Text style={styles.brand}>InvitaVideos</Text></View><Text style={styles.title}>Create your invitation reel</Text><Text style={styles.subtitle}>A polished video, ready to share.</Text>
    <View style={styles.steps}>{STEPS.map((label, index) => <View key={label} style={styles.step}><View style={[styles.stepDot, index <= step && styles.stepActive]}><Text style={styles.stepNumber}>{index + 1}</Text></View><Text style={[styles.stepLabel, index === step && styles.stepLabelActive]}>{label}</Text></View>)}</View>
    {step === 0 && <><Text style={styles.sectionTitle}>What are you celebrating?</Text><View style={styles.chips}>{(categories.length ? categories : ['Wedding', 'Engagement', 'Birthday']).map((item) => <Pressable key={item} onPress={() => { setCategory(item); setTemplate(null); setMusicId(''); }} style={[styles.chip, category === item && styles.chipActive]}><Text style={styles.chipText}>{item}</Text></Pressable>)}</View><Text style={styles.sectionTitle}>Choose a style</Text><FlatList horizontal data={visibleTemplates} keyExtractor={(item) => item.id} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <Pressable onPress={() => setTemplate(item)} style={[styles.templateCard, template?.id === item.id && styles.templateSelected]}><Text style={styles.templateName}>{item.name}</Text><Text style={styles.templateMeta}>{item.style || 'Cinematic'} · {item.duration || 10}s</Text><Text style={styles.templateCount}>{item.renderCount || 0} videos</Text></Pressable>} /></>}
    {step === 1 && <><Text style={styles.sectionTitle}>Tell us the basics</Text>{category === 'Birthday' ? <><Field label="First name" value={details.firstName} onChangeText={(v) => setField('firstName', v)} /><Field label="Last name" value={details.lastName} onChangeText={(v) => setField('lastName', v)} /></> : <><Field label="Partner 1" value={details.partnerOne} onChangeText={(v) => setField('partnerOne', v)} /><Field label="Partner 2" value={details.partnerTwo} onChangeText={(v) => setField('partnerTwo', v)} /></>}<Field label="Date" value={details.eventDate} onChangeText={(v) => setField('eventDate', v)} placeholder="e.g. 14 December 2026" /><Field label="Venue" value={details.venueName} onChangeText={(v) => setField('venueName', v)} /><Field label="City" value={details.city} onChangeText={(v) => setField('city', v)} /><Field label="Message" value={details.message} onChangeText={(v) => setField('message', v)} multiline /><Field label="Duration (seconds)" value={details.durationInSeconds} onChangeText={(v) => setField('durationInSeconds', v)} keyboardType="number-pad" /></>}
    {step === 2 && <><Text style={styles.sectionTitle}>Add your photos</Text><Pressable style={styles.uploadButton} onPress={choosePhotos}><Text style={styles.uploadText}>＋ Choose photos</Text></Pressable><Text style={styles.helper}>{photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'} selected` : 'Use up to 8 photos for the best result.'}</Text><View style={styles.photoGrid}>{photos.map((photo) => <Image key={photo.uri} source={{ uri: photo.uri }} style={styles.photo} />)}</View></>}
    {step === 3 && <><Text style={styles.sectionTitle}>Select music</Text>{visibleTracks.map((track) => <Pressable key={track.id} onPress={() => setMusicId(track.id)} style={[styles.track, musicId === track.id && styles.trackSelected]}><View><Text style={styles.trackTitle}>{track.title || track.name}</Text><Text style={styles.trackMeta}>{track.artist || 'InvitaVideos library'}</Text></View><Text style={styles.radio}>{musicId === track.id ? '●' : '○'}</Text></Pressable>)}{!visibleTracks.length && <Text style={styles.helper}>No music has been assigned to this category yet. You can render without selecting a track.</Text>}<View style={styles.loginBox}><Text style={styles.loginTitle}>{DISABLE_GOOGLE_AUTH ? 'Google login disabled (development mode)' : user ? `Signed in as ${user.email || user.name || 'Google user'}` : 'Sign in to create your video'}</Text>{!user && <Pressable disabled={!request} onPress={() => promptAsync()} style={styles.googleButton}><Text style={styles.googleText}>Continue with Google</Text></Pressable>}</View><Pressable disabled={isWorking} onPress={createVideo} style={[styles.renderButton, isWorking && styles.buttonDisabled]}><Text style={styles.renderText}>{isWorking ? 'Creating video…' : 'Render video'}</Text></Pressable></>}
    {error ? <Text style={styles.error}>{error}</Text> : null}{status ? <View style={styles.status}>{isWorking ? <ActivityIndicator color="#e9b872" /> : <Text style={styles.readyMark}>✓</Text>}<Text style={styles.statusText}>{status}</Text></View> : null}{videoUrl ? <View style={styles.result}><Text style={styles.resultTitle}>Ready to share</Text><RenderedVideo uri={videoUrl.startsWith('http') ? videoUrl : `${API.replace('/api', '')}${videoUrl}`} /></View> : null}
    <View style={styles.nav}>{step > 0 && <Pressable onPress={previous} style={styles.back}><Text style={styles.backText}>Back</Text></Pressable>}{step < 3 && <Pressable onPress={next} style={styles.next}><Text style={styles.nextText}>Continue</Text></Pressable>}</View><Text style={styles.footer} onPress={() => Linking.openURL('https://invitavideos.com')}>InvitaVideos.com</Text>
  </ScrollView></SafeAreaView>;
}

function Field({ label, ...props }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} style={[styles.input, props.multiline && styles.multiline]} placeholderTextColor="#8f869f" /></View>; }
function RenderedVideo({ uri }) { const player = useVideoPlayer(uri, (instance) => { instance.loop = false; instance.play(); }); return <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#171022' }, container: { padding: 22, paddingBottom: 48 }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandLogo: { width: 34, height: 34, borderRadius: 8 }, brand: { color: '#e9b872', fontSize: 18, fontWeight: '700', letterSpacing: 1 }, title: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 20 }, subtitle: { color: '#bdb2c9', fontSize: 15, marginTop: 7 }, steps: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 28 }, step: { alignItems: 'center', gap: 6 }, stepDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#5e526e', alignItems: 'center', justifyContent: 'center' }, stepActive: { backgroundColor: '#d78b69', borderColor: '#d78b69' }, stepNumber: { color: '#fff', fontWeight: '700' }, stepLabel: { color: '#8f869f', fontSize: 11 }, stepLabelActive: { color: '#fff' }, sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 14, marginTop: 5 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 26 }, chip: { borderWidth: 1, borderColor: '#625672', borderRadius: 22, paddingVertical: 10, paddingHorizontal: 16 }, chipActive: { backgroundColor: '#d78b69', borderColor: '#d78b69' }, chipText: { color: '#fff', fontWeight: '600' }, templateCard: { backgroundColor: '#2a2035', borderRadius: 18, padding: 18, width: 210, marginRight: 14, minHeight: 130, borderWidth: 1, borderColor: '#3d304c' }, templateSelected: { borderColor: '#e9b872', backgroundColor: '#3c2c41' }, templateName: { color: '#fff', fontSize: 17, fontWeight: '700' }, templateMeta: { color: '#c7bbcd', marginTop: 12 }, templateCount: { color: '#e9b872', marginTop: 14, fontSize: 12 }, field: { marginBottom: 14 }, label: { color: '#d8ccdf', fontSize: 13, marginBottom: 7 }, input: { backgroundColor: '#251b31', color: '#fff', borderWidth: 1, borderColor: '#4a3c58', borderRadius: 12, padding: 13, fontSize: 15 }, multiline: { minHeight: 85, textAlignVertical: 'top' }, uploadButton: { backgroundColor: '#d78b69', borderRadius: 14, padding: 16, alignItems: 'center' }, uploadText: { color: '#fff', fontWeight: '800', fontSize: 16 }, helper: { color: '#a99bb1', marginVertical: 14 }, photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, photo: { width: 95, height: 125, borderRadius: 10 }, track: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#251b31', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#3d304c' }, trackSelected: { borderColor: '#e9b872' }, trackTitle: { color: '#fff', fontWeight: '700' }, trackMeta: { color: '#a99bb1', marginTop: 4 }, radio: { color: '#e9b872', fontSize: 20 }, loginBox: { backgroundColor: '#241a30', borderRadius: 16, padding: 16, marginTop: 18, marginBottom: 14 }, loginTitle: { color: '#fff', fontWeight: '600', marginBottom: 12 }, googleButton: { backgroundColor: '#fff', borderRadius: 10, padding: 13, alignItems: 'center' }, googleText: { color: '#222', fontWeight: '700' }, renderButton: { backgroundColor: '#e9b872', borderRadius: 14, padding: 17, alignItems: 'center' }, buttonDisabled: { opacity: 0.55 }, renderText: { color: '#241a30', fontSize: 16, fontWeight: '800' }, nav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 }, back: { padding: 15 }, backText: { color: '#c7bbcd', fontWeight: '700' }, next: { backgroundColor: '#d78b69', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 26, marginLeft: 'auto' }, nextText: { color: '#fff', fontWeight: '800' }, error: { color: '#ff9b9b', marginTop: 18, lineHeight: 20 }, status: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }, statusText: { color: '#e9b872' }, readyMark: { color: '#79d89a', fontSize: 20, fontWeight: '800' }, result: { marginTop: 25 }, resultTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 10 }, video: { width: '100%', height: 440, backgroundColor: '#0d0913', borderRadius: 16 }, footer: { color: '#887b93', textAlign: 'center', marginTop: 34 }
});
