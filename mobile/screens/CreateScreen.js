import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { BrandHeader } from '../components/BrandHeader';
import { DatePickerModal, DynamicForm, Field } from '../components/Shared';
import { useAuth } from '../context/AuthContext';
import {
  STEPS,
  WEDDING_SCHEDULE,
  json,
  normalizePhotoForRender,
  palette,
  styles,
  uploadPhoto,
} from '../lib/shared';

export default function CreateScreen({ route, navigation }) {
  const category = route.params?.category || 'Wedding';
  const { user, credential, ensureValidCredential } = useAuth();

  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [categoryDefs, setCategoryDefs] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [template, setTemplate] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoMessages, setPhotoMessages] = useState({});
  const [musicId, setMusicId] = useState('');
  const [customMusicUrl, setCustomMusicUrl] = useState('');
  const [schedule, setSchedule] = useState(category === 'Wedding' ? [...WEDDING_SCHEDULE] : []);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState('details');
  const [details, setDetails] = useState({ partnerOne: '', partnerTwo: '', firstName: '', lastName: '', eventDate: '', venueName: '', city: '', message: '', durationInSeconds: '10' });
  // Generic value bag for data-driven categories (e.g. "Heartfelt").
  const [fields, setFields] = useState({});
  const [status, setStatus] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  // Set once the render job is accepted by the server. The render then runs
  // server-side independently — the user is sent to My Downloads instead of
  // waiting on a spinner.
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { json('/templates').then(setTemplates).catch((e) => setError(e.message)); json('/music').then(setTracks).catch(() => {}); json('/categories').then(setCategoryDefs).catch(() => {}); }, []);

  const activeCategoryDef = useMemo(() => categoryDefs.find((c) => c.name === category) || null, [categoryDefs, category]);
  const visibleTemplates = useMemo(() => templates.filter((t) => (t.category || '').toLowerCase() === category.toLowerCase()), [templates, category]);
  const visibleTracks = useMemo(() => tracks.filter((t) => !t.categories || t.categories.length === 0 || t.categories.includes(category)), [tracks, category]);

  // Server-resolved form manifest for the selected template (category fields
  // already gated + merged with template settings by the backend).
  const [formManifest, setFormManifest] = useState(null);
  useEffect(() => {
    if (!template?.id) { setFormManifest(null); return; }
    let cancelled = false;
    json(`/templates/${template.id}/form`).then((m) => { if (!cancelled) setFormManifest(m); }).catch(() => { if (!cancelled) setFormManifest(null); });
    return () => { cancelled = true; };
  }, [template?.id]);
  const manifest = formManifest && formManifest.templateId === template?.id ? formManifest : null;

  // Prefer the manifest; fall back to the client-side merge of category form +
  // template settings while the manifest is loading (or on older backends).
  const isDataDriven = manifest ? manifest.hasForm : Boolean(activeCategoryDef && activeCategoryDef.form);
  const formSchema = manifest?.hasForm ? { fields: manifest.steps.details.fields } : activeCategoryDef?.form;
  const templateSettings = template?.settings || template?.capabilities || {};
  const perImageMessages = manifest ? manifest.steps.photos.captionPerImage : Boolean(templateSettings.captionPerImage ?? templateSettings.perImageMessage?.supported);
  const captionMaxLength = manifest ? manifest.steps.photos.captionMaxLength : (templateSettings.perImageMessage?.maxLength || 120);
  const durationOptions = (manifest?.steps.details.durations || (Array.isArray(templateSettings.durations) && templateSettings.durations.length ? templateSettings.durations : [10, 20, 30])).map(String);
  // Effective image cap depends on the chosen duration (shorter reels hold fewer).
  const imagesPerDuration = (manifest?.steps.photos.imagesPerDuration) || templateSettings.imagesPerDuration || {};
  const overallMaxImages = manifest ? manifest.steps.photos.maxImages : (Number(templateSettings.maxImages) || 8);
  const maxImages = Number(imagesPerDuration[String(details.durationInSeconds)]) || overallMaxImages;

  // Keep the selected duration valid when the template (and its allowed
  // durations) changes.
  useEffect(() => {
    if (!durationOptions.includes(details.durationInSeconds)) setField('durationInSeconds', durationOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, manifest]);

  // Trim photos/captions if a shorter duration lowers the image cap below the
  // current selection.
  useEffect(() => {
    if (photos.length > maxImages) {
      const trimmed = photos.slice(0, maxImages);
      setPhotos(trimmed);
      setPhotoMessages((current) => { const next = {}; trimmed.forEach((p) => { if (current[p.uri] !== undefined) next[p.uri] = current[p.uri]; }); return next; });
      setError(`A ${details.durationInSeconds}s reel fits up to ${maxImages} photos — extra photos were removed.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxImages]);

  useEffect(() => { if (!template && visibleTemplates[0]) setTemplate(visibleTemplates[0]); }, [visibleTemplates, template]);
  // Seed schema defaults (e.g. the wedding event schedule) once per category,
  // without clobbering anything the user has already entered.
  useEffect(() => {
    if (!formSchema) return;
    const defaults = {};
    (formSchema.fields || []).forEach((f) => { if (f.default !== undefined) defaults[f.key] = f.default; });
    if (Object.keys(defaults).length) setFields((current) => ({ ...defaults, ...current }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategoryDef, manifest]);
  const setField = (key, value) => setDetails((current) => ({ ...current, [key]: value }));
  const setFieldValue = (key, value) => setFields((current) => ({ ...current, [key]: value }));

  async function choosePhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photos permission needed', 'Allow photo access to add images to your video.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: maxImages, quality: 0.9 });
    if (!result.canceled) setPhotos(result.assets);
  }

  const removePhoto = (uri) => setPhotos((current) => current.filter((photo) => photo.uri !== uri));

  const updateScheduleItem = (index, key, value) => setSchedule((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  const removeScheduleItem = (index) => setSchedule((current) => current.filter((_, i) => i !== index));
  const addScheduleItem = () => setSchedule((current) => (current.length >= 6 ? current : [...current, { name: '', time: '' }]));

  async function createVideo() {
    setError('');
    if (!template) return setError('Choose a template first.');
    if (perImageMessages && photos.some((photo) => !((photoMessages[photo.uri] || '').trim()))) {
      return setError('Add a message for every photo before rendering.');
    }
    let activeCredential = await ensureValidCredential();
    if (!activeCredential) return setError('Your session expired. Please sign in with Google to render your video.');
    setIsWorking(true);
    try {
      setStatus('Preparing photos…');
      const uploaded = [];
      for (let index = 0; index < photos.length; index += 1) { setStatus(`Uploading photo ${index + 1} of ${photos.length}…`); const prepared = await normalizePhotoForRender(photos[index]); const result = await uploadPhoto(prepared); uploaded.push(result.url); }
      setStatus('Starting render…');
      let body;
      if (isDataDriven) {
        // Data-driven category: each image travels with its caption; the backend
        // unpacks images[] and resolves relationship copy.
        body = {
          template: template.id,
          category,
          fields,
          images: uploaded.map((url, index) => ({ imageUrl: url, text: photoMessages[photos[index]?.uri] || '' })),
          musicId: musicId || template.defaultMusicId || undefined,
          customMusicUrl: musicId === 'my-music' ? customMusicUrl || undefined : undefined,
          durationInSeconds: Number(details.durationInSeconds) || 10,
          tags: [category.toLowerCase()],
        };
      } else {
        const nameOne = category === 'Birthday' ? details.firstName : details.partnerOne;
        const nameTwo = category === 'Birthday' ? details.lastName : details.partnerTwo;
        body = { template: template.id, couple: { partnerOne: nameOne || 'Your', partnerTwo: nameTwo || 'Story' }, eventDate: details.eventDate, venue: { name: details.venueName, city: details.city }, message: details.message, schedule: category === 'Engagement' ? [{ name: 'Engagement', time: details.eventDate }] : category === 'Birthday' ? [] : schedule.filter((item) => item.name || item.time), photos: uploaded, musicId: musicId || template.defaultMusicId || undefined, customMusicUrl: musicId === 'my-music' ? customMusicUrl || undefined : undefined, durationInSeconds: Number(details.durationInSeconds) || 10, tags: [category.toLowerCase()] };
      }
      const postRender = (cred) => json('/renders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cred}` }, body: JSON.stringify(body) });
      let render;
      try {
        render = await postRender(activeCredential);
      } catch (e) {
        // Token expired between the pre-check and the request: refresh once and
        // retry a single time. Never loop — if refresh fails, surface sign-in.
        if (e.status === 401) {
          activeCredential = await ensureValidCredential();
          if (!activeCredential) throw new Error('Your session expired. Please sign in again to render your video.');
          render = await postRender(activeCredential);
        } else {
          throw e;
        }
      }
      // Fire-and-forget: the server renders independently. We don't block the
      // user on a spinner — the finished video lands in My Downloads.
      if (!render?.jobId) throw new Error('The render could not be started. Please try again.');
      setSubmitted(true); setStatus('');
    } catch (e) { setError(e.message); setStatus(''); }
    finally { setIsWorking(false); }
  }

  const lastStep = STEPS.length - 1;
  const next = () => { if (step === 0 && !template) return setError('Choose a template first.'); setError(''); setStep((n) => Math.min(lastStep, n + 1)); };
  const previous = () => {
    setError('');
    if (step === 0) { navigation.goBack(); return; }
    setStep((n) => Math.max(0, n - 1));
  };
  // Reset the wizard to start a fresh reel in the same category.
  const startNewReel = () => {
    setError('');
    setStatus('');
    setSubmitted(false);
    setPhotos([]);
    setPhotoMessages({});
    setStep(0);
  };

  const activeStep = STEPS[step];
  const categoryIcon = activeCategoryDef?.icon || '✨';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <BrandHeader />

          {submitted ? (
            <View style={styles.result}>
              <Text style={styles.resultTitle}>🎬 Your video is being created!</Text>
              <Text style={styles.confirmBody}>This usually takes a minute or two. We'll have your reel ready in My Downloads — you can leave this screen.</Text>
              <Pressable onPress={() => navigation.navigate('MyVideos')} style={styles.shareButton}>
                <Text style={styles.shareButtonText}>Go to My Videos</Text>
              </Pressable>
              <Pressable onPress={startNewReel} style={[styles.saveButton, { marginTop: 10 }]}>
                <Text style={styles.saveButtonText}>Create another reel</Text>
              </Pressable>
            </View>
          ) : (
          <>
          <View style={styles.changeCategoryRow}>
            <Text style={styles.changeCategoryLabel}>{categoryIcon} {category}</Text>
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Text style={styles.changeCategoryAction}>Change ›</Text>
            </Pressable>
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

              {isDataDriven ? (
                <View style={[styles.card, { marginTop: 20 }]}>
                  <DynamicForm
                    schema={formSchema}
                    template={template}
                    relationships={activeCategoryDef?.relationships || []}
                    values={fields}
                    onChange={setFieldValue}
                    onOpenDatePicker={(key) => { setDatePickerTarget(key); setDatePickerOpen(true); }}
                  />
                  <View style={styles.field}>
                    <Text style={styles.label}>Video duration</Text>
                    <View style={styles.durationRow}>
                      {durationOptions.map((seconds) => {
                        const selected = details.durationInSeconds === seconds;
                        return (
                          <Pressable key={seconds} onPress={() => setField('durationInSeconds', seconds)} style={[styles.durationOption, selected && styles.durationOptionSelected]}>
                            <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>{selected ? <View style={styles.radioInner} /> : null}</View>
                            <Text style={[styles.durationText, selected && styles.durationTextSelected]}>{seconds} sec</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  {perImageMessages && <Text style={styles.helper}>Add a message to each photo on the next step.</Text>}
                </View>
              ) : (
                <View style={[styles.card, { marginTop: 20 }]}>
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
                  <View style={styles.field}>
                    <Text style={styles.label}>Event date</Text>
                    <Pressable onPress={() => { setDatePickerTarget('details'); setDatePickerOpen(true); }} style={styles.input}>
                      <View style={styles.dateRow}>
                        <Text style={details.eventDate ? styles.dateValue : styles.datePlaceholder}>{details.eventDate || 'Select a date'}</Text>
                        <Text style={styles.dateIcon}>📅</Text>
                      </View>
                    </Pressable>
                  </View>
                  <View style={styles.fieldRow}>
                    <Field label="Venue" value={details.venueName} onChangeText={(v) => setField('venueName', v)} placeholder="The Grand Palace" style={styles.flex} />
                    <Field label="City" value={details.city} onChangeText={(v) => setField('city', v)} placeholder="Jaipur" style={styles.flex} />
                  </View>
                  <Field label="Message to guests" value={details.message} onChangeText={(v) => setField('message', v)} placeholder="Join us as we begin our forever…" multiline maxLength={120} />
                  <View style={styles.field}>
                    <Text style={styles.label}>Video duration</Text>
                    <View style={styles.durationRow}>
                      {durationOptions.map((seconds) => {
                        const selected = details.durationInSeconds === seconds;
                        return (
                          <Pressable key={seconds} onPress={() => setField('durationInSeconds', seconds)} style={[styles.durationOption, selected && styles.durationOptionSelected]}>
                            <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>{selected ? <View style={styles.radioInner} /> : null}</View>
                            <Text style={[styles.durationText, selected && styles.durationTextSelected]}>{seconds} sec</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {category === 'Wedding' && (
                    <View style={styles.scheduleSection}>
                      <View style={styles.scheduleHeader}>
                        <Text style={styles.scheduleTitle}>Event schedule</Text>
                        <Pressable onPress={addScheduleItem} disabled={schedule.length >= 6} style={[styles.addEventButton, schedule.length >= 6 && styles.buttonDisabled]}>
                          <Text style={styles.addEventText}>＋ Add event</Text>
                        </Pressable>
                      </View>
                      {schedule.map((item, index) => (
                        <View key={index} style={styles.scheduleRow}>
                          <TextInput
                            value={item.name}
                            onChangeText={(v) => updateScheduleItem(index, 'name', v)}
                            placeholder="Haldi"
                            placeholderTextColor={palette.textMuted}
                            selectionColor={palette.gold}
                            style={[styles.input, styles.scheduleName]}
                          />
                          <TextInput
                            value={item.time}
                            onChangeText={(v) => updateScheduleItem(index, 'time', v)}
                            placeholder="10:00 AM"
                            placeholderTextColor={palette.textMuted}
                            selectionColor={palette.gold}
                            style={[styles.input, styles.scheduleTime]}
                          />
                          <Pressable onPress={() => removeScheduleItem(index)} style={styles.scheduleRemove} hitSlop={8}>
                            <Text style={styles.scheduleRemoveText}>✕</Text>
                          </Pressable>
                        </View>
                      ))}
                      {schedule.length === 0 && <Text style={styles.helper}>No events — the schedule section will show empty in the video.</Text>}
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {step === 1 && (
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
                {photos.length < maxImages && (
                  <Pressable style={styles.addTile} onPress={choosePhotos}>
                    <Text style={styles.addTilePlus}>＋</Text>
                    <Text style={styles.addTileText}>{photos.length ? 'Change' : 'Add photos'}</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.helper}>{photos.length ? `${photos.length} of ${maxImages} photos selected` : 'Portrait photos with faces work best.'}</Text>

              {perImageMessages && photos.length > 0 && (
                <View style={styles.captionSection}>
                  <Text style={styles.sectionTitle}>Message for each photo *</Text>
                  {photos.map((photo, index) => {
                    const missing = !((photoMessages[photo.uri] || '').trim());
                    return (
                    <View key={photo.uri} style={styles.captionRow}>
                      <Image source={{ uri: photo.uri }} style={styles.captionThumb} />
                      <TextInput
                        value={photoMessages[photo.uri] || ''}
                        onChangeText={(v) => setPhotoMessages((current) => ({ ...current, [photo.uri]: v }))}
                        placeholder={`Message for photo ${index + 1}… (required)`}
                        placeholderTextColor={palette.textMuted}
                        selectionColor={palette.gold}
                        maxLength={captionMaxLength}
                        style={[styles.input, styles.flex, missing && styles.inputRequired]}
                      />
                    </View>
                  );})}
                </View>
              )}
            </>
          )}

          {step === 2 && (
            <>
              {visibleTracks.map((track) => {
                const selected = musicId === track.id;
                return (
                  <Pressable key={track.id} onPress={() => setMusicId(selected ? '' : track.id)} style={[styles.track, selected && styles.trackSelected]}>
                    <View style={[styles.trackIcon, selected && styles.trackIconActive]}><Text style={styles.trackIconText}>{track.isCustomUrl ? '🔗' : '♫'}</Text></View>
                    <View style={styles.flex}>
                      <Text style={styles.trackTitle} numberOfLines={1}>{track.title || track.name}</Text>
                      <Text style={styles.trackMeta} numberOfLines={1}>{track.isCustomUrl ? (track.mood || 'Use your own song') : `${track.artist || 'InvitaVideos library'}${track.duration ? ` · ${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : ''}`}</Text>
                    </View>
                    <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>{selected ? <View style={styles.radioInner} /> : null}</View>
                  </Pressable>
                );
              })}
              {!visibleTracks.length && <Text style={styles.helper}>No music has been assigned to this category yet. You can render without selecting a track.</Text>}
              {musicId === 'my-music' && (
                <View style={styles.captionSection}>
                  <Text style={styles.sectionTitle}>Paste a link to your song</Text>
                  <TextInput
                    value={customMusicUrl}
                    onChangeText={setCustomMusicUrl}
                    placeholder="https://example.com/song.mp3"
                    placeholderTextColor={palette.textMuted}
                    selectionColor={palette.gold}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={styles.input}
                  />
                  <Text style={styles.helper}>Must be a direct https:// audio file link. If it's missing or can't be reached when your video renders, we'll automatically use a default track instead.</Text>
                </View>
              )}

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

          {/* Navigation */}
          <View style={styles.nav}>
            <Pressable onPress={previous} style={styles.back}><Text style={styles.backText}>← Back</Text></Pressable>
            {step < lastStep && (
              <Pressable onPress={next} style={styles.next}><Text style={styles.nextText}>Continue →</Text></Pressable>
            )}
          </View>
          </>
          )}

          <Text style={styles.footer}>InvitaVideos.com</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={datePickerOpen}
        value={datePickerTarget === 'details' ? details.eventDate : (fields[datePickerTarget] || '')}
        onClose={() => setDatePickerOpen(false)}
        onSelect={(formatted) => {
          if (datePickerTarget === 'details') setField('eventDate', formatted);
          else setFieldValue(datePickerTarget, formatted);
          setDatePickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}
