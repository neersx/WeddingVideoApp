import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { absoluteVideoUrl } from './shared';

// expo-media-library and expo-sharing have no web implementation and call their
// native module at import time, so they're required only on native platforms.
const MediaLibrary = Platform.OS !== 'web' ? require('expo-media-library') : null;
const Sharing = Platform.OS !== 'web' ? require('expo-sharing') : null;

// Downloads a (possibly relative) video URL into the app cache and returns the
// local file uri.
export async function downloadVideo(videoUrl) {
  const remoteUrl = absoluteVideoUrl(videoUrl);
  if (!remoteUrl) throw new Error('The video is not ready yet.');
  const destination = new File(Paths.cache, `invitavideos-${Date.now()}.mp4`);
  const downloaded = await File.downloadFileAsync(remoteUrl, destination);
  return downloaded.uri;
}

export async function shareVideoUrl(videoUrl) {
  if (!Sharing) throw new Error('Sharing is only available in the mobile app.');
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  const uri = await downloadVideo(videoUrl);
  await Sharing.shareAsync(uri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4', dialogTitle: 'Share your InvitaVideos reel' });
}

export async function saveVideoUrl(videoUrl) {
  if (!MediaLibrary) throw new Error('Saving to Photos is only available in the mobile app.');
  const permission = await MediaLibrary.requestPermissionsAsync(true, ['video']);
  if (!permission.granted) throw new Error('Allow Photos access to save the video to your device.');
  const uri = await downloadVideo(videoUrl);
  await MediaLibrary.Asset.create(uri);
}
