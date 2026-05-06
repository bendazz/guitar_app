// Persistence layer: songs + global prefs in localStorage.

import type { TuningId, FretPosition } from './fretboard';
import type { KeyName } from './music';

export const STORAGE_KEY = 'orkney-transposer:v1';

export interface SongV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  tuningId: TuningId;
  sourceKey: KeyName;
  targetKey: KeyName;
  notes: number[];                                  // MIDI pitches as entered
  chosen: { [noteIdx: number]: FretPosition };     // user-locked fingerings
  bpm: number;
  createdAt: number;
  updatedAt: number;
}

export interface AppStateV1 {
  schemaVersion: 1;
  songs: SongV1[];
  currentSongId: string | null;
  prefs: { orientationFlipped: boolean; helpOpen: boolean };
}

export function newSong(opts: { name?: string; tuningId?: TuningId } = {}): SongV1 {
  const now = Date.now();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: opts.name ?? 'Untitled',
    tuningId: opts.tuningId ?? 'orkney',
    sourceKey: 'C',
    targetKey: 'C',
    notes: [],
    chosen: {},
    bpm: 80,
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultAppState(): AppStateV1 {
  const song = newSong({ name: 'Untitled 1' });
  return {
    schemaVersion: 1,
    songs: [song],
    currentSongId: song.id,
    // New users see the help panel open by default.
    prefs: { orientationFlipped: false, helpOpen: true },
  };
}

export function loadAppState(): AppStateV1 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAppState();
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion === 1 && Array.isArray(parsed.songs) && parsed.songs.length > 0) {
      // Fill in any missing pref fields. Existing users default to helpOpen=false
      // since they've already used the app and don't need it expanded again.
      return {
        ...parsed,
        prefs: {
          orientationFlipped: parsed.prefs?.orientationFlipped ?? false,
          helpOpen: parsed.prefs?.helpOpen ?? false,
        },
      } as AppStateV1;
    }
  } catch (err) {
    console.warn('Could not load saved state — starting fresh.', err);
  }
  return defaultAppState();
}

export function saveAppState(state: AppStateV1): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Could not save state.', err);
  }
}

// Pick the next "Untitled N" name not yet in use.
export function nextUntitledName(songs: SongV1[]): string {
  let n = 0;
  for (const s of songs) {
    const m = /^Untitled(?: (\d+))?$/.exec(s.name);
    if (m) n = Math.max(n, m[1] ? Number(m[1]) : 1);
  }
  return `Untitled ${n + 1}`;
}

export function songToJson(song: SongV1): string {
  return JSON.stringify(song, null, 2);
}

// Validates a JSON string and returns a song with a fresh id (so imports never collide).
export function parseImportedSong(text: string): SongV1 {
  const parsed = JSON.parse(text);
  if (parsed?.schemaVersion !== 1) throw new Error('Unsupported song schema');
  if (typeof parsed.name !== 'string') throw new Error('Missing song name');
  if (!Array.isArray(parsed.notes)) throw new Error('Missing notes array');
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: parsed.name,
    tuningId: parsed.tuningId,
    sourceKey: parsed.sourceKey,
    targetKey: parsed.targetKey,
    notes: parsed.notes,
    chosen: parsed.chosen ?? {},
    bpm: typeof parsed.bpm === 'number' ? parsed.bpm : 80,
    createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
}
