// Fretboard model for Orkney tuning (C-G-D-G-C-D, low to high), open strings
// plus frets 1..FRET_MAX. Standard book orientation (bass top / treble bottom)
// is the responsibility of the renderer.

import type { PitchClass } from './music';
import { parseNoteName } from './music';

// Strings indexed 0 = lowest pitch (bass), 5 = highest pitch (treble).
// MIDI note numbers (C4 = 60).
export const ORKNEY_TUNING_NAMES = ['C', 'G', 'D', 'G', 'C', 'D'] as const;
export const ORKNEY_OPEN_PITCHES = [36, 43, 50, 55, 60, 62]; // C2, G2, D3, G3, C4, D4

export const FRET_MIN = 1;
export const FRET_MAX = 7;

// Lowest and highest MIDI pitches reachable on this tuning within fret 0..FRET_MAX.
export const MIN_PLAYABLE_MIDI = ORKNEY_OPEN_PITCHES[0];
export const MAX_PLAYABLE_MIDI =
  ORKNEY_OPEN_PITCHES[ORKNEY_OPEN_PITCHES.length - 1] + FRET_MAX;

export interface FretPosition {
  string: number; // 0..5, 0 = bass, 5 = treble
  fret: number;   // 0..FRET_MAX (0 = open string)
}

// All fret positions that produce the exact MIDI pitch within range.
export function findPositionsForMidi(midi: number): FretPosition[] {
  const out: FretPosition[] = [];
  for (let s = 0; s < ORKNEY_OPEN_PITCHES.length; s++) {
    const fret = midi - ORKNEY_OPEN_PITCHES[s];
    if (fret >= 0 && fret <= FRET_MAX) out.push({ string: s, fret });
  }
  return out;
}

// Which of the labeled octaves (2, 3, 4) are playable for a given pitch class.
// Used to grey out unavailable note buttons.
export function playableOctavesForPc(pc: PitchClass): number[] {
  return [2, 3, 4].filter(oct => {
    const midi = (oct + 1) * 12 + pc;
    return midi >= MIN_PLAYABLE_MIDI && midi <= MAX_PLAYABLE_MIDI;
  });
}

export const ORKNEY_OPEN_PCS: PitchClass[] = ORKNEY_TUNING_NAMES.map(parseNoteName);
