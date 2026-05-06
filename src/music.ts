// Music theory: pitch classes, key signatures, transposition, enharmonic spelling.

export type PitchClass = number; // 0..11, C=0

export const PITCH_CLASS_BY_LETTER: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

// Sharp- and flat-spelled names for each pitch class.
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export type KeyName =
  | 'C' | 'G' | 'D' | 'A' | 'E' | 'B' | 'F#' | 'C#'
  | 'F' | 'Bb' | 'Eb' | 'Ab' | 'Db' | 'Gb' | 'Cb';

// Keys that prefer flat spellings for ambiguous accidentals. Everything else uses sharps.
const FLAT_KEYS: KeyName[] = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

export const ALL_KEYS: KeyName[] = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
];

export function keyPrefersFlats(key: KeyName): boolean {
  return FLAT_KEYS.includes(key);
}

export function keyTonicPc(key: KeyName): PitchClass {
  return parseNoteName(key);
}

// Parse a note name like "C", "F#", "Bb", "C#" into a pitch class 0..11.
export function parseNoteName(name: string): PitchClass {
  const letter = name[0].toUpperCase();
  let pc = PITCH_CLASS_BY_LETTER[letter];
  if (pc === undefined) throw new Error(`Bad note name: ${name}`);
  for (let i = 1; i < name.length; i++) {
    const c = name[i];
    if (c === '#') pc += 1;
    else if (c === 'b') pc -= 1;
    else throw new Error(`Bad accidental in: ${name}`);
  }
  return ((pc % 12) + 12) % 12;
}

// Spell a pitch class according to the key's sharp/flat preference.
export function spellInKey(pc: PitchClass, key: KeyName): string {
  const useFlats = keyPrefersFlats(key);
  return useFlats ? FLAT_NAMES[pc] : SHARP_NAMES[pc];
}

// Transpose a pitch class by a number of semitones (positive or negative).
export function transposePc(pc: PitchClass, semitones: number): PitchClass {
  return (((pc + semitones) % 12) + 12) % 12;
}

// MIDI helpers. Convention: middle C = C4 = MIDI 60. C2 = 36, C3 = 48.
export type Midi = number;

export function midiOf(pc: PitchClass, octave: number): Midi {
  return (octave + 1) * 12 + pc;
}
export function pitchClassOf(midi: Midi): PitchClass {
  return ((midi % 12) + 12) % 12;
}
export function octaveOf(midi: Midi): number {
  return Math.floor(midi / 12) - 1;
}

// Shift midi up or down by octaves until it falls within [min, max].
// All 12 pitch classes have at least one octave inside any 24+-semitone window,
// so the loop always terminates for the playable range used by this app.
export function fitToRange(midi: Midi, min: Midi, max: Midi): Midi {
  let m = midi;
  while (m < min) m += 12;
  while (m > max) m -= 12;
  return m;
}

// Semitone interval from one key to another (shortest direction up).
export function semitonesBetweenKeys(from: KeyName, to: KeyName): number {
  return (((keyTonicPc(to) - keyTonicPc(from)) % 12) + 12) % 12;
}

// Twelve buttons for note entry (one per pitch class). Uses the source-key
// preference for display, so flat keys show "Eb" rather than "D#".
export function noteButtonLabels(key: KeyName): string[] {
  return Array.from({ length: 12 }, (_, pc) => spellInKey(pc, key));
}
