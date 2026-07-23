import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BrandHeader } from '../components/BrandHeader';
import { RenderedVideo } from '../components/Shared';
import { useAuth } from '../context/AuthContext';
import { absoluteVideoUrl, json, palette, styles } from '../lib/shared';
import { saveVideoUrl, shareVideoUrl } from '../lib/video';

const STATUS_LABEL = {
  queued: 'Preparing',
  rendering: 'Rendering',
  done: 'Ready',
  failed: 'Failed',
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyDownloadsScreen({ navigation }) {
  const { user, ensureValidCredential, signInWithGoogle } = useAuth();
  const [renders, setRenders] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [playingId, setPlayingId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const cred = await ensureValidCredential();
    if (!cred) { setRenders([]); return; }
    try {
      const data = await json('/renders/mine', { headers: { Authorization: `Bearer ${cred}` } });
      setRenders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Could not load your videos.');
      setRenders([]);
    }
  }, [ensureValidCredential]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const withBusy = async (id, fn) => {
    setError(''); setBusyId(id);
    try { await fn(); } catch (e) { setError(e.message || 'Something went wrong.'); }
    finally { setBusyId(''); }
  };

  const readyCount = Array.isArray(renders) ? renders.filter((r) => r.status === 'done' && !r.expired).length : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.gold} />}
      >
        <BrandHeader />

        <View style={styles.landingHero}>
          <Text style={styles.title}>My Videos</Text>
          <Text style={styles.subtitle}>
            {Array.isArray(renders) && renders.length > 0
              ? `${readyCount} ready · ${renders.length} total. Pull down to refresh.`
              : 'Your rendered videos appear here.'}
          </Text>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

        {!user ? (
          <View style={styles.card}>
            <Text style={styles.confirmBody}>Sign in to see the videos you've created.</Text>
            <Pressable onPress={signInWithGoogle} style={styles.smallBtnPrimary}>
              <Text style={styles.smallBtnPrimaryText}>Sign in with Google</Text>
            </Pressable>
          </View>
        ) : renders === null ? (
          <View style={styles.status}><ActivityIndicator color={palette.gold} /><Text style={styles.statusText}>Loading your videos…</Text></View>
        ) : renders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🎬</Text>
            <Text style={styles.emptyTitle}>No videos yet</Text>
            <Text style={styles.emptyBody}>Create your first reel and it'll show up here, ready to play and share.</Text>
            <Pressable onPress={() => navigation.navigate('CreateTab', { screen: 'Landing' })} style={styles.smallBtnPrimary}>
              <Text style={styles.smallBtnPrimaryText}>Create a video</Text>
            </Pressable>
          </View>
        ) : (
          renders.map((item) => {
            const ready = item.status === 'done' && !item.expired;
            const busy = busyId === item.id;
            const playing = playingId === item.id;
            const statusTone = ready ? styles.chipReady : item.status === 'failed' ? styles.chipFail : styles.chipPending;
            const statusText = item.expired ? 'Expired' : (STATUS_LABEL[item.status] || item.status);
            return (
              <View key={item.id} style={styles.dlCard}>
                {ready && playing ? (
                  <View style={styles.dlPlayer}>
                    <RenderedVideo uri={absoluteVideoUrl(item.video_url)} style={styles.dlVideo} />
                  </View>
                ) : null}

                <View style={styles.dlBody}>
                  <View style={styles.dlHeaderRow}>
                    <View style={styles.flex}>
                      <Text style={styles.dlTitle} numberOfLines={1}>{item.category || 'Video'}</Text>
                      <Text style={styles.dlSubtitle} numberOfLines={1}>{item.template}</Text>
                    </View>
                    <View style={[styles.chip, statusTone]}>
                      <Text style={[styles.chipText, ready && styles.chipTextReady, item.status === 'failed' && styles.chipTextFail]}>{statusText}</Text>
                    </View>
                  </View>

                  <Text style={styles.dlMeta}>
                    {formatDate(item.created_at)}{item.durationInSeconds ? `  ·  ${item.durationInSeconds}s` : ''}{item.creditCost > 0 ? '  ·  Premium' : '  ·  Free'}
                  </Text>

                  {item.expired ? (
                    <Text style={styles.dlNote}>This video's file has expired and is no longer available.</Text>
                  ) : ready ? (
                    <View style={styles.dlActions}>
                      <Pressable onPress={() => setPlayingId(playing ? '' : item.id)} style={styles.smallBtnPrimary}>
                        <Text style={styles.smallBtnPrimaryText}>{playing ? '■ Stop' : '▶ Play'}</Text>
                      </Pressable>
                      <Pressable disabled={busy} onPress={() => withBusy(item.id, () => shareVideoUrl(item.video_url))} style={[styles.smallBtn, busy && styles.buttonDisabled]}>
                        <Text style={styles.smallBtnText}>Share</Text>
                      </Pressable>
                      <Pressable disabled={busy} onPress={() => withBusy(item.id, () => saveVideoUrl(item.video_url))} style={[styles.smallBtn, busy && styles.buttonDisabled]}>
                        <Text style={styles.smallBtnText}>Save</Text>
                      </Pressable>
                    </View>
                  ) : item.status === 'failed' ? (
                    <Text style={styles.dlNote}>This render failed. Try creating it again.</Text>
                  ) : (
                    <View style={styles.dlPending}>
                      <ActivityIndicator color={palette.gold} size="small" />
                      <Text style={styles.dlPendingText}>{STATUS_LABEL[item.status] || 'Working'}… pull to refresh</Text>
                    </View>
                  )}

                  {busy ? (
                    <View style={styles.dlBusy}>
                      <ActivityIndicator color={palette.gold} size="small" />
                      <Text style={styles.dlPendingText}>Preparing file…</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        {Array.isArray(renders) && renders.length > 0 ? (
          <Pressable onPress={() => navigation.navigate('CreateTab', { screen: 'Landing' })} style={styles.dlCreateBtn}>
            <Text style={styles.dlCreateBtnText}>＋ Create a video</Text>
          </Pressable>
        ) : null}

        <Text style={styles.footer}>InvitaVideos.com</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
