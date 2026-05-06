import {
  FRET_MAX,
  ORKNEY_OPEN_PCS, ORKNEY_TUNING_NAMES,
  type FretPosition,
} from '../fretboard';

interface Props {
  // Positions to show as candidates (e.g. all options for the selected note).
  candidates: FretPosition[];
  // The single chosen position for the current note (rendered solid).
  chosen: FretPosition | null;
  // The position currently lit by the animation (overrides chosen rendering).
  active: FretPosition | null;
  // User clicked a candidate dot — pick it as the chosen position.
  onPickPosition: (pos: FretPosition) => void;
}

const NUM_STRINGS = 6;
const FRETS_SHOWN = FRET_MAX; // frets 1..FRET_MAX

const FRET_W = 60;
const STRING_GAP = 28;
const STRING_LABEL_X = 16; // left of the open-string column
const OPEN_X = 38;         // x for fret-0 (open string) dots
const NUT_X = 64;          // x of the nut (left edge of fret 1)
const PAD_TOP = 30;
const PAD_BOTTOM = 28;
const PAD_RIGHT = 16;

const W = NUT_X + FRET_W * FRETS_SHOWN + PAD_RIGHT;
const H = PAD_TOP + PAD_BOTTOM + STRING_GAP * (NUM_STRINGS - 1);

// Standard book-style orientation: bass (low) strings at the top,
// treble (high) strings at the bottom. Internal string index 0 = bass.
function stringRowToY(row: number): number {
  return PAD_TOP + row * STRING_GAP;
}
function stringIndexToY(stringIdx: number): number {
  return stringRowToY(stringIdx);
}
function fretToX(fret: number): number {
  if (fret === 0) return OPEN_X;
  return NUT_X + (fret - 1) * FRET_W + FRET_W / 2;
}
function fretLineX(fret: number): number {
  // Fret 0 = the nut. Fret N = the wire at the high-fret edge of slot N.
  return NUT_X + fret * FRET_W;
}

export function Fretboard({ candidates, chosen, active, onPickPosition }: Props) {
  const candidateKey = (p: FretPosition) => `${p.string}-${p.fret}`;
  const chosenKey = chosen ? candidateKey(chosen) : null;
  const activeKey = active ? candidateKey(active) : null;

  return (
    <svg className="fretboard" viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
      {/* Fret wires (fret 0 = nut, fret 1..FRET_MAX) */}
      {Array.from({ length: FRETS_SHOWN + 1 }, (_, i) => {
        const fret = i;
        const x = fretLineX(fret);
        return (
          <line
            key={`fret-${fret}`}
            x1={x} y1={stringRowToY(0) - 6}
            x2={x} y2={stringRowToY(NUM_STRINGS - 1) + 6}
            stroke="#bbb" strokeWidth={fret === 0 ? 5 : 2}
          />
        );
      })}

      {/* Fret numbers (above the diagram, frets 1..FRET_MAX) */}
      {Array.from({ length: FRETS_SHOWN }, (_, i) => {
        const fret = i + 1;
        return (
          <text
            key={`fn-${fret}`}
            x={fretToX(fret)} y={PAD_TOP - 12}
            textAnchor="middle" fontSize="12" fill="#aaa"
          >
            {fret}
          </text>
        );
      })}

      {/* Strings: row 0 (top) = bass (string idx 0), row 5 = treble (string idx 5) */}
      {Array.from({ length: NUM_STRINGS }, (_, row) => {
        const stringIdx = row;
        const y = stringRowToY(row);
        const name = ORKNEY_TUNING_NAMES[stringIdx];
        const thickness = 1 + (NUM_STRINGS - 1 - stringIdx) * 0.3;
        return (
          <g key={`str-${stringIdx}`}>
            <line x1={NUT_X} y1={y} x2={W - PAD_RIGHT} y2={y} stroke="#ccc" strokeWidth={thickness} />
            <text x={STRING_LABEL_X} y={y + 4} textAnchor="start" fontSize="12" fill="#aaa">{name}</text>
          </g>
        );
      })}

      {/* Inlay markers at conventional fret positions (single dots at 3, 5, 7) */}
      {[3, 5, 7].filter(f => f <= FRET_MAX).map(f => {
        const x = fretToX(f);
        const yMid = (stringRowToY(2) + stringRowToY(3)) / 2;
        return <circle key={`inlay-${f}`} cx={x} cy={yMid} r={4} fill="#3a3a3a" />;
      })}

      {/* Candidate position dots */}
      {candidates.map(pos => {
        const key = candidateKey(pos);
        const isChosen = key === chosenKey;
        const isActive = key === activeKey;
        const cx = fretToX(pos.fret);
        const cy = stringIndexToY(pos.string);
        const fill = isActive ? '#ffcc33' : isChosen ? '#5599ff' : 'rgba(85,153,255,0.25)';
        const stroke = isActive ? '#ffcc33' : '#5599ff';
        return (
          <g key={key} className="dot" onClick={() => onPickPosition(pos)} style={{ cursor: 'pointer' }}>
            <circle cx={cx} cy={cy} r={12} fill={fill} stroke={stroke} strokeWidth={2} />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fill={isActive || isChosen ? '#111' : '#cde'}>
              {pos.fret === 0 ? 'O' : pos.fret}
            </text>
          </g>
        );
      })}

      {/* Orientation hint */}
      <text x={STRING_LABEL_X} y={H - 6} fontSize="11" fill="#666">bass ↑ / treble ↓ (standard diagram)</text>
    </svg>
  );
}

export { ORKNEY_OPEN_PCS };
