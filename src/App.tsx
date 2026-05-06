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
  type FretPosition,
  type TuningId,
  TUNINGS,
  findPositionsForMidi,
  getTuning,
  playableOctavesForPc,
  tuningRange,
} from './fretboard';
import {
  type AppStateV1,
  type SongV1,
  loadAppState,
  newSong,
  nextUntitledName,
  parseImportedSong,
  saveAppState,
  songToJson,
} from './storage';
import { Fretboard } from './components/Fretboard';
import './App.css';

const OCTAVE_LABELS: Record<number, string> = { 2: 'Low', 3: 'Mid', 4: 'High' };
const OCTAVES = [2, 3, 4];

export default function App() {
  // Persisted, single source of truth.
  const [state, setState] = useState<AppStateV1>(loadAppState);

  // Ephemeral UI state — not saved.
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [octave, setOctave] = useState<number>(3);
  const [playStep, setPlayStep] = useState<number | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const playTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist on any state change.
  useEffect(() => { saveAppState(state); }, [state]);

  // Locate the current song. defaultAppState() guarantees there is one,
  // so this fallback is just safety.
  const currentSong: SongV1 =
    state.songs.find(s => s.id === state.currentSongId) ?? state.songs[0];

  const tuning = getTuning(currentSong.tuningId);
  const range = tuningRange(tuning);
  const flipped = state.prefs.orientationFlipped;

  const semitones = semitonesBetweenKeys(currentSong.sourceKey, currentSong.targetKey);
  const transposed = useMemo<Midi[]>(
    () => currentSong.notes.map(m => fitToRange(m + semitones, range.min, range.max)),
    [currentSong.notes, semitones, range.min, range.max],
  );

  const focusIdx = playStep !== null ? playStep : selectedIdx;
  const allOptions = useMemo<FretPosition[]>(() => {
    if (focusIdx === null || focusIdx >= transposed.length) return [];
    return findPositionsForMidi(transposed[focusIdx], tuning);
  }, [focusIdx, transposed, tuning]);

  const playingPos: FretPosition | null =
    playStep !== null ? (currentSong.chosen[playStep] ?? allOptions[0] ?? null) : null;
  const candidates: FretPosition[] =
    playStep !== null ? (playingPos ? [playingPos] : []) : allOptions;
  const focusChosen = focusIdx !== null ? (currentSong.chosen[focusIdx] ?? null) : null;
  const focusActive = playingPos;

  // ----- Mutators -----

  function updateCurrentSong(updater: (s: SongV1) => SongV1) {
    setState(prev => ({
      ...prev,
      songs: prev.songs.map(s =>
        s.id === currentSong.id ? { ...updater(s), updatedAt: Date.now() } : s,
      ),
    }));
  }

  function setSourceKey(k: KeyName) { updateCurrentSong(s => ({ ...s, sourceKey: k })); }
  function setTargetKey(k: KeyName) { updateCurrentSong(s => ({ ...s, targetKey: k })); }
  function setBpm(n: number)        { updateCurrentSong(s => ({ ...s, bpm: n })); }

  function setTuning(id: TuningId) {
    if (id === currentSong.tuningId) return;
    // Locked positions reference (string, fret) pairs that don't translate
    // across tunings, so clear them on tuning change.
    updateCurrentSong(s => ({ ...s, tuningId: id, chosen: {} }));
    setSelectedIdx(null);
    stopPlayback();
  }

  function toggleFlipped() {
    setState(prev => ({
      ...prev,
      prefs: { ...prev.prefs, orientationFlipped: !prev.prefs.orientationFlipped },
    }));
  }

  function toggleHelp() {
    setState(prev => ({
      ...prev,
      prefs: { ...prev.prefs, helpOpen: !prev.prefs.helpOpen },
    }));
  }

  function addNote(label: string) {
    const pc = parseNoteName(label);
    const midi = midiOf(pc, octave);
    if (midi < range.min || midi > range.max) return;
    updateCurrentSong(s => ({ ...s, notes: [...s.notes, midi] }));
  }
  function deleteAt(i: number) {
    updateCurrentSong(s => {
      const newNotes = s.notes.filter((_, j) => j !== i);
      const newChosen: SongV1['chosen'] = {};
      Object.entries(s.chosen).forEach(([k, v]) => {
        const idx = Number(k);
        if (idx < i) newChosen[idx] = v;
        else if (idx > i) newChosen[idx - 1] = v;
      });
      return { ...s, notes: newNotes, chosen: newChosen };
    });
    setSelectedIdx(null);
  }
  function clearAll() {
    updateCurrentSong(s => ({ ...s, notes: [], chosen: {} }));
    setSelectedIdx(null);
    stopPlayback();
  }
  function pickPosition(pos: FretPosition) {
    if (selectedIdx === null) return;
    updateCurrentSong(s => ({ ...s, chosen: { ...s.chosen, [selectedIdx]: pos } }));
  }

  // ----- Song actions -----

  function showFlash(msg: string) {
    setFlashMessage(msg);
    window.setTimeout(() => setFlashMessage(null), 2500);
  }

  function newSongAction() {
    const song = newSong({
      name: nextUntitledName(state.songs),
      tuningId: currentSong.tuningId,
    });
    setState(s => ({ ...s, songs: [...s.songs, song], currentSongId: song.id }));
    setSelectedIdx(null);
    stopPlayback();
  }

  function openSong(id: string) {
    if (id === currentSong.id) return;
    setState(s => ({ ...s, currentSongId: id }));
    setSelectedIdx(null);
    stopPlayback();
  }

  function renameCurrent() {
    const next = window.prompt('Rename song to:', currentSong.name);
    if (next === null) return;
    const trimmed = next.trim();
    if (trimmed === '' || trimmed === currentSong.name) return;
    updateCurrentSong(s => ({ ...s, name: trimmed }));
  }

  function duplicateCurrent() {
    const copy: SongV1 = {
      ...currentSong,
      id: crypto.randomUUID(),
      name: `${currentSong.name} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setState(s => ({ ...s, songs: [...s.songs, copy], currentSongId: copy.id }));
    setSelectedIdx(null);
    stopPlayback();
  }

  function deleteCurrent() {
    if (!window.confirm(`Delete "${currentSong.name}"? This cannot be undone.`)) return;
    setState(s => {
      const remaining = s.songs.filter(x => x.id !== currentSong.id);
      if (remaining.length === 0) {
        const fresh = newSong({ name: 'Untitled 1' });
        return { ...s, songs: [fresh], currentSongId: fresh.id };
      }
      return { ...s, songs: remaining, currentSongId: remaining[0].id };
    });
    setSelectedIdx(null);
    stopPlayback();
  }

  function exportCurrent() {
    const json = songToJson(currentSong);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = currentSong.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase() || 'song';
    a.href = url;
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFlash('Exported.');
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      const song = parseImportedSong(text);
      setState(s => ({ ...s, songs: [...s.songs, song], currentSongId: song.id }));
      setSelectedIdx(null);
      stopPlayback();
      showFlash(`Imported "${song.name}".`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFlash(`Import failed: ${msg}`);
    }
  }

  // ----- Playback -----

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
    const ms = Math.max(60, 60_000 / Math.max(20, currentSong.bpm));
    playTimerRef.current = window.setTimeout(() => {
      setPlayStep(s => (s === null ? null : s + 1));
    }, ms);
    return () => {
      if (playTimerRef.current !== null) window.clearTimeout(playTimerRef.current);
    };
  }, [playStep, currentSong.bpm, transposed.length]);

  // ----- Render -----

  const noteButtons = noteButtonLabels(currentSong.sourceKey);

  return (
    <div className="app">
      <h1>Guitar Transposer</h1>

      <section className="help-panel">
        <button className="help-toggle" onClick={toggleHelp} aria-expanded={state.prefs.helpOpen}>
          <span className="help-arrow">{state.prefs.helpOpen ? '▾' : '▸'}</span> How to use
        </button>
        {state.prefs.helpOpen && (
          <div className="help-content">
            <ol>
              <li>Pick a song from the dropdown above, or click <strong>+ New</strong>.</li>
              <li>Choose a <strong>tuning</strong> (Standard, DADGAD, or Orkney). Use the <strong>Diagram</strong> button if you want to flip the fretboard upside-down.</li>
              <li>Set the <strong>From key</strong> — the key the original music is in.</li>
              <li>Choose an <strong>octave</strong> (Low / Mid / High), then click note buttons to build the sequence. Notes that don't fit on the chosen octave are greyed out. Use the <strong>×</strong> on a chip to remove a note.</li>
              <li>Set the <strong>To key</strong>. The transposed sequence appears just below.</li>
              <li>Click any transposed note to see its fret positions on the diagram. Click a dot to lock that fingering in (a small <code>s#f#</code> tag appears on the chip).</li>
              <li>Press <strong>▶ Play</strong> to step through the locked positions at the chosen tempo.</li>
            </ol>
            <p className="muted small">
              <strong>Saving:</strong> songs auto-save in your browser. <strong>Export</strong> downloads the current song as a <code>.json</code> file you can keep or share; <strong>Import</strong> loads one back.
            </p>
          </div>
        )}
      </section>

      <section className="songs-bar">
        <label>Song:</label>
        <select value={currentSong.id} onChange={e => openSong(e.target.value)}>
          {state.songs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={newSongAction}>+ New</button>
        <button onClick={renameCurrent}>Rename</button>
        <button onClick={duplicateCurrent}>Duplicate</button>
        <button onClick={deleteCurrent}>Delete</button>
        <span className="spacer" />
        <button onClick={exportCurrent}>Export</button>
        <button onClick={() => fileInputRef.current?.click()}>Import</button>
        <input
          ref={fileInputRef} type="file" accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = '';
          }}
        />
        {flashMessage && <span className="flash">{flashMessage}</span>}
      </section>

      <section className="row">
        <label>Tuning:</label>
        <select
          value={currentSong.tuningId}
          onChange={e => setTuning(e.target.value as TuningId)}
        >
          {TUNINGS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="ghost" onClick={toggleFlipped} style={{ marginLeft: 16 }}>
          {flipped ? 'Diagram: upside-down' : 'Diagram: standard'} ⇅
        </button>
      </section>

      <section className="row">
        <label>From key:</label>
        <select value={currentSong.sourceKey} onChange={e => setSourceKey(e.target.value as KeyName)}>
          {ALL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <label style={{ marginLeft: 24 }}>To key:</label>
        <select value={currentSong.targetKey} onChange={e => setTargetKey(e.target.value as KeyName)}>
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
            const available = playableOctavesForPc(pc, tuning).includes(octave);
            return (
              <button
                key={label}
                onClick={() => addNote(label)}
                disabled={!available}
                title={available ? `${label}${octave}` : `${label}${octave} is out of range on ${tuning.id}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3>Sequence ({currentSong.sourceKey})</h3>
        <div className="chips">
          {currentSong.notes.length === 0 && <span className="muted">no notes yet</span>}
          {currentSong.notes.map((midi, i) => (
            <span key={i} className="chip">
              <NoteLabel midi={midi} keyName={currentSong.sourceKey} />
              <button className="chip-x" onClick={() => deleteAt(i)} title="remove">×</button>
            </span>
          ))}
          {currentSong.notes.length > 0 && (
            <button className="ghost" onClick={clearAll}>clear all</button>
          )}
        </div>
      </section>

      <section>
        <h3>Transposed ({currentSong.targetKey})</h3>
        <div className="chips">
          {transposed.length === 0 && <span className="muted">—</span>}
          {transposed.map((midi, i) => {
            const isSel = i === selectedIdx;
            const isPlaying = i === playStep;
            const choice = currentSong.chosen[i];
            const cls = ['chip', 'clickable', isSel && 'sel', isPlaying && 'playing', choice && 'has-choice']
              .filter(Boolean).join(' ');
            return (
              <span key={i} className={cls} onClick={() => { stopPlayback(); setSelectedIdx(i); }}>
                <NoteLabel midi={midi} keyName={currentSong.targetKey} />
                {choice && <small className="pos-tag">{`s${choice.string + 1}f${choice.fret}`}</small>}
              </span>
            );
          })}
        </div>
      </section>

      <section>
        <h3>Fretboard</h3>
        <Fretboard
          tuning={tuning}
          flipped={flipped}
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
        <input type="range" min={20} max={240} value={currentSong.bpm} onChange={e => setBpm(Number(e.target.value))} />
        <span className="muted">{currentSong.bpm}</span>
      </section>
    </div>
  );
}

function NoteLabel({ midi, keyName }: { midi: Midi; keyName: KeyName }) {
  const pc: PitchClass = pitchClassOf(midi);
  const oct = octaveOf(midi);
  return <>{spellInKey(pc, keyName)}<sub>{oct}</sub></>;
}
