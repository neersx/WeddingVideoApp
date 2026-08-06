import { File, Paths } from 'expo-file-system';

// Persisted in the document directory (survives app restarts, unlike cache) so
// a guest's daily render count — tracked server-side by this id — doesn't
// reset every time the app relaunches. Native-only; the web app has its own
// anonymous flow (reCAPTCHA) and never calls this.
const DEVICE_FILE = new File(Paths.document, 'invitavideos-device.json');

function randomId() {
  // Not security-sensitive — only used to key the guest render allowance —
  // so a lightweight RFC4122-v4-shaped id via Math.random is fine here.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cachedId = null;

// Returns a stable per-device id, minting and persisting one on first call.
export async function getDeviceId() {
  if (cachedId) return cachedId;
  try {
    if (DEVICE_FILE.exists) {
      const raw = await DEVICE_FILE.text();
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.deviceId === 'string' && parsed.deviceId) {
        cachedId = parsed.deviceId;
        return cachedId;
      }
    }
  } catch (e) {
    // Corrupt or unreadable file — fall through and mint a fresh id.
  }
  const id = randomId();
  try {
    if (!DEVICE_FILE.exists) DEVICE_FILE.create({ intermediates: true });
    DEVICE_FILE.write(JSON.stringify({ deviceId: id }));
  } catch (e) {
    // Best effort — if persistence fails the id just won't survive a restart.
  }
  cachedId = id;
  return id;
}
