import { File, Paths } from 'expo-file-system';

// On-device "My Videos" for guests (no account). App Store Guideline 5.1.1(v):
// rendering isn't account-based, so guests must be able to see the videos they
// just made without signing in. Persisted in the document directory (survives
// restarts); a real sign-in switches My Videos over to the server-backed
// /renders/mine list instead — these entries are never uploaded anywhere.
const LIBRARY_FILE = new File(Paths.document, 'invitavideos-guest-library.json');

// Guests are capped at 2 renders/day server-side, so this comfortably covers
// weeks of history without the manifest growing unbounded.
const MAX_ENTRIES = 30;

async function readAll() {
  try {
    if (!LIBRARY_FILE.exists) return [];
    const raw = await LIBRARY_FILE.text();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function writeAll(entries) {
  try {
    if (!LIBRARY_FILE.exists) LIBRARY_FILE.create({ intermediates: true });
    LIBRARY_FILE.write(JSON.stringify(entries));
  } catch (e) {
    // Best effort — if persistence fails the entry just won't survive a restart.
  }
}

export async function listGuestRenders() {
  const entries = await readAll();
  return entries.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

export async function addGuestRender(entry) {
  const entries = await readAll();
  writeAll([entry, ...entries].slice(0, MAX_ENTRIES));
}

export async function updateGuestRender(id, patch) {
  const entries = await readAll();
  writeAll(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
}
