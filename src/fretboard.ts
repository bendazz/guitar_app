// Fretboard model. Tuning-agnostic. Renders open strings (fret 0) plus frets 1..FRET_MAX.

import type { PitchClass } from './music';

export const FRET_MIN = 1;
export const FRET_MAX = 7;

export type TuningId = 'standard' | 'dadgad' | 'orkney';

export interface Tuning {
  id: TuningId;
  name: string;
  stringNames: readonly string[]; // length 6, low to high
  openPitches: readonly number[]; // length 6, MIDI, low to high
}

export const STANDARD_TUNING: Tuning = {
  id: 'standard',
  name: 'Standard (E A D G B E)',
  stringNames: ['E', 'A', 'D', 'G', 'B', 'E'],
  openPitches: [40, 45, 50, 55, 59, 64],
};

export const DADGAD_TUNING: Tuning = {
  id: 'dadgad',
  name: 'DADGAD (D A D G A D)',
  stringNames: ['D', 'A', 'D', 'G', 'A', 'D'],
  openPitches: [38, 45, 50, 55, 57, 62],
};

export const ORKNEY_TUNING: Tuning = {
  id: 'orkney',
  name: 'Orkney (C G D G C D)',
  stringNames: ['C', 'G', 'D', 'G', 'C', 'D'],
  openPitches: [36, 43, 50, 55, 60, 62],
};

export const TUNINGS: readonly Tuning[] = [STANDARD_TUNING, DADGAD_TUNING, ORKNEY_TUNING];

export function getTuning(id: TuningId): Tuning {
  const t = TUNINGS.find(t => t.id === id);
  if (!t) throw new Error(`Unknown tuning: ${id}`);
  return t;
}

export interface FretPosition {
  string: number; // 0..5, 0 = bass (lowest open pitch), 5 = treble (highest)
  fret: number;   // 0..FRET_MAX
}

// Lowest and highest MIDI pitches reachable on a tuning within fret 0..FRET_MAX.
export function tuningRange(tuning: Tuning): { min: number; max: number } {
  return {
    min: tuning.openPitches[0],
    max: tuning.openPitches[tuning.openPitches.length - 1] + FRET_MAX,
  };
}

// All fret positions that produce the exact MIDI pitch within range on this tuning.
export function findPositionsForMidi(midi: number, tuning: Tuning): FretPosition[] {
  const out: FretPosition[] = [];
  for (let s = 0; s < tuning.openPitches.length; s++) {
    const fret = midi - tuning.openPitches[s];
    if (fret >= 0 && fret <= FRET_MAX) out.push({ string: s, fret });
  }
  return out;
}

// Which of the labeled octaves (2, 3, 4) are playable for a given pitch class on this tuning.
export function playableOctavesForPc(pc: PitchClass, tuning: Tuning): number[] {
  const { min, max } = tuningRange(tuning);
  return [2, 3, 4].filter(oct => {
    const midi = (oct + 1) * 12 + pc;
    return midi >= min && midi <= max;
  });
}
