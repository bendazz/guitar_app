import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_KEYS,
  type KeyName,
  type Midi,
  type PitchClass,
  fitToRange,
  midiOf,
  noteButtonLabels,
  octaveOf,
  parseNoteName,
  pitchClassOf,
  semitonesBetweenKeys,
  spellInKey,
} from './music';
import {
  MAX_PLAYABLE_MIDI,
  MIN_PLAYABLE_MIDI,
  findPositionsForMidi,
  playableOctavesForPc,
  type FretPosition,
} from './fretboard';
import { Fretboard } from './components/Fretboard';
import './App.css';

const OCTAVE_LABELS: Record<number, string> = { 2: 'Low', 3: 'Mid', 4: 'High' };
const OCTAVES = [2, 3, 4];

export default function App() {
  const [sourceKey, setSourceKey] = useState<KeyName>('C');
  const [targetKey, setTargetKey] = useState<KeyName>('G');
  const [octave, setOctave] = useState<number>(3);
  const [notes, setNotes] = useState<Midi[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [chosen, setChosen] = useState<Record<number, FretPosition>>({});
  const [bpm, setBpm] = useState(80);
  const [playStep, setPlayStep] = useState<number | null>(null);
  const playTimerRef = useRef<number | null>(null);

  const semitones = semitonesBetweenKeys(sourceKey, targetKey);
  const transposed = useMemo<Midi[]>(
    () => notes.map(m => fitToRange(m + semitones, MIN_PLAYABLE_MIDI, MAX_PLAYABLE_MIDI)),
    [notes, semitones],
  );

  const focusIdx = playStep !== null ? playStep : selectedIdx;
  const allOptions = useMemo<FretPosition[]>(() => {
    if (focusIdx === null || focusIdx >= transposed.length) return [];
    return findPositionsForMidi(transposed[focusIdx]);
  }, [focusIdx, transposed]);

  const playingPos: FretPosition | null =
    playStep !== null ? (chosen[playStep] ?? allOptions[0] ?? null) : null;
  const candidates: FretPosition[] =
    playStep !== null ? (playingPos ? [playingPos] : []) : allOptions;
  const focusChosen = focusIdx !== null ? (chosen[focusIdx] ?? null) : null;
  const focusActive = playingPos;

  function addNote(label: string) {
    const pc = parseNoteName(label);
    const midi = midiOf(pc, octave);
    if (midi < MIN_PLAYABLE_MIDI || midi > MAX_PLAYABLE_MIDI) return;
    setNotes(prev => [...prev, midi]);
  }
  function deleteAt(i: number) {
    setNotes(prev => prev.filter((_, j) => j !== i));
    setChosen(prev => {
      const next: Record<number, FretPosition> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const idx = Number(k);
        if (idx < i) next[idx] = v;
        else if (idx > i) next[idx - 1] = v;
      });
      return next;
    });
    setSelectedIdx(null);
  }
  function clearAll() {
    setNotes([]);
    setChosen({});
    setSelectedIdx(null);
    stopPlayback();
  }
  function pickPosition(pos: FretPosition) {
    if (selectedIdx === null) return;
    setChosen(prev => ({ ...prev, [selectedIdx]: pos }));
  }

  function startPlayback() {
    if (transposed.length === 0) return;
    stopPlayback();
    setPlayStep(0);
  }
  function stopPlayback() {
    if (playTimerRef.current !== null) {
      window.clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
    setPlayStep(null);
  }
  useEffect(() => {
    if (playStep === null) return;
    if (playStep >= transposed.length) {
      setPlayStep(null);
      return;
    }
    const ms = Math.max(60, 60_000 / Math.max(20, bpm));
    playTimerRef.current = window.setTimeout(() => {
      setPlayStep(s => (s === null ? null : s + 1));
    }, ms);
    return () => {
      if (playTimerRef.current !== null) window.clearTimeout(playTimerRef.current);
    };
  }, [playStep, bpm, transposed.length]);

  const noteButtons = noteButtonLabels(sourceKey);

  return (
    <div className="app">
      <h1>Orkney Transposer</h1>

      <section className="row">
        <label>From key:</label>
        <select value={sourceKey} onChange={e => setSourceKey(e.target.value as KeyName)}>
          {ALL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <label style={{ marginLeft: 24 }}>To key:</label>
        <select value={targetKey} onChange={e => setTargetKey(e.target.value as KeyName)}>
          {ALL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </section>

      <section>
        <h3>Enter notes</h3>
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="muted small">Octave:</span>
          {OCTAVES.map(o => (
            <button
              key={o}
              className={`octave-btn${o === octave ? ' selected' : ''}`}
              onClick={() => setOctave(o)}
              title={`Octave ${o}`}
            >
              {OCTAVE_LABELS[o]} <small>({o})</small>
            </button>
          ))}
        </div>
        <div className="note-buttons">
          {noteButtons.map(label => {
            const pc = parseNoteName(label);
            const available = playableOctavesForPc(pc).includes(octave);
            return (
              <button
                key={label}
                onClick={() => addNote(label)}
                disabled={!available}
                title={available ? `${label}${octave}` : `${label}${octave} is out of range`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3>Sequence ({sourceKey})</h3>
        <div className="chips">
          {notes.length === 0 && <span className="muted">no notes yet</span>}
          {notes.map((midi, i) => (
            <span key={i} className="chip">
              <NoteLabel midi={midi} keyName={sourceKey} />
              <button className="chip-x" onClick={() => deleteAt(i)} title="remove">×</button>
            </span>
          ))}
          {notes.length > 0 && (
            <button className="ghost" onClick={clearAll}>clear all</button>
          )}
        </div>
      </section>

      <section>
        <h3>Transposed ({targetKey})</h3>
        <div className="chips">
          {transposed.length === 0 && <span className="muted">—</span>}
          {transposed.map((midi, i) => {
            const isSel = i === selectedIdx;
            const isPlaying = i === playStep;
            const hasChoice = chosen[i] !== undefined;
            const cls = ['chip', 'clickable', isSel && 'sel', isPlaying && 'playing', hasChoice && 'has-choice']
              .filter(Boolean).join(' ');
            return (
              <span key={i} className={cls} onClick={() => { stopPlayback(); setSelectedIdx(i); }}>
                <NoteLabel midi={midi} keyName={targetKey} />
                {hasChoice && <small className="pos-tag">{`s${chosen[i].string + 1}f${chosen[i].fret}`}</small>}
              </span>
            );
          })}
        </div>
      </section>

      <section>
        <h3>Fretboard</h3>
        <Fretboard
          candidates={candidates}
          chosen={focusChosen}
          active={focusActive}
          onPickPosition={pickPosition}
        />
        <p className="muted small">
          {selectedIdx === null
            ? 'Click a transposed note to see its positions in the first 7 frets (open strings included).'
            : 'Click a dot to lock it in for this note. Locked positions are used during playback.'}
        </p>
      </section>

      <section className="row">
        <button onClick={startPlayback} disabled={transposed.length === 0 || playStep !== null}>▶ Play</button>
        <button onClick={stopPlayback} disabled={playStep === null}>■ Stop</button>
        <label style={{ marginLeft: 16 }}>BPM</label>
        <input type="range" min={20} max={240} value={bpm} onChange={e => setBpm(Number(e.target.value))} />
        <span className="muted">{bpm}</span>
      </section>
    </div>
  );
}

function NoteLabel({ midi, keyName }: { midi: Midi; keyName: KeyName }) {
  const pc: PitchClass = pitchClassOf(midi);
  const oct = octaveOf(midi);
  return <>{spellInKey(pc, keyName)}<sub>{oct}</sub></>;
}
