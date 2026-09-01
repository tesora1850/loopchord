import type { Bar, Progression } from '../music/generator';
import type { ChordSymbol, KeyDef } from '../music/theory';
import type { TimeSignature } from '../music/rhythm';
import { chordLabelParts } from '../music/theory';
import { groupNotes } from './beamGroups';
import './StaffView.css';

const BAR_W = 168;
const BAR_H = 98;
const PAD_X = 14;
const STAFF_Y = 68;
const STEM_TOP = STAFF_Y - 32;
const CHORD_LABEL_Y = STEM_TOP - 10;
const USABLE_W = BAR_W - PAD_X * 2;
const NOTEHEAD_W = 7.5;
const NOTEHEAD_H = 15;
// IBM Plex Mono는 고정폭이라 문자 수만으로 실제 렌더링 너비를 정확히 추정할 수 있다.
const MONO_CHAR_WIDTH = 0.62;
const TENSION_SIZE_RATIO = 0.64;
const TENSION_RAISE = 0.55; // 베이스 폰트 크기 대비 위로 띄우는 비율

function xOf(tick: number, ticksPerBar: number): number {
  return PAD_X + (tick / ticksPerBar) * USABLE_W;
}

function labelWidth(base: string, superscript: string, fontSize: number): number {
  return base.length * fontSize * MONO_CHAR_WIDTH + superscript.length * fontSize * TENSION_SIZE_RATIO * MONO_CHAR_WIDTH;
}

const FONT_CANDIDATES = [15, 13, 11.5, 10, 9, 8];

// 텐션이 붙으면 라벨이 길어지므로, 실제 라벨 폭과 다음 코드 위치를 비교해 겹치지 않는 가장 큰 폰트를 고른다.
function pickFontSize(
  chordSlots: { tick: number; chord: ChordSymbol }[],
  ticksPerBar: number,
  key: KeyDef,
): number {
  for (const fontSize of FONT_CANDIDATES) {
    let fits = true;
    for (let i = 0; i < chordSlots.length; i++) {
      const { base, superscript } = chordLabelParts(chordSlots[i].chord, key);
      const width = labelWidth(base, superscript, fontSize);
      const x = xOf(chordSlots[i].tick, ticksPerBar);
      const boundary = i + 1 < chordSlots.length ? xOf(chordSlots[i + 1].tick, ticksPerBar) : BAR_W - PAD_X;
      if (x + width > boundary + 2) {
        fits = false;
        break;
      }
    }
    if (fits) return fontSize;
  }
  return FONT_CANDIDATES[FONT_CANDIDATES.length - 1];
}

// 1틱=8분음표(깃발/빔), 2틱=4분음표(기둥만), 3틱=점4분음표(점). 그 이상은 단순화해 기둥만 표시.
function noteVisual(ticks: number): { flag: boolean; dot: boolean } {
  if (ticks === 1) return { flag: true, dot: false };
  if (ticks === 3) return { flag: false, dot: true };
  return { flag: false, dot: false };
}

function NoteHead({ x }: { x: number }) {
  return (
    <g transform={`translate(${x}, ${STAFF_Y}) rotate(-24)`}>
      <rect x={-NOTEHEAD_W / 2} y={-NOTEHEAD_H / 2} width={NOTEHEAD_W} height={NOTEHEAD_H} rx={1.4} className="slash-head" />
    </g>
  );
}

function Stem({ x }: { x: number }) {
  return <line className="stem" x1={x} y1={STEM_TOP} x2={x} y2={STAFF_Y} />;
}

function Flag({ x }: { x: number }) {
  return <path className="flag" d={`M ${x} ${STEM_TOP} C ${x + 7} ${STEM_TOP + 3} ${x + 8} ${STEM_TOP + 11} ${x + 2} ${STEM_TOP + 17}`} />;
}

function Dot({ x }: { x: number }) {
  return <circle className="aug-dot" cx={x + 7.5} cy={STAFF_Y} r={1.8} />;
}

function SingleNote({ x, ticks }: { x: number; ticks: number }) {
  const { flag, dot } = noteVisual(ticks);
  return (
    <g>
      <Stem x={x} />
      <NoteHead x={x} />
      {flag && <Flag x={x} />}
      {dot && <Dot x={x} />}
    </g>
  );
}

interface BarViewProps {
  bar: Bar;
  barNumber: number;
  timeSig: TimeSignature;
  keyAccidental: 'sharp' | 'flat';
  isActiveBar: boolean;
  activeChordTick: number | null;
}

function BarView({ bar, barNumber, timeSig, keyAccidental, isActiveBar, activeChordTick }: BarViewProps) {
  const ticksPerBar = timeSig.ticksPerBar;
  const units = groupNotes(bar.noteSlots, timeSig);
  const key: KeyDef = { pc: 0, name: '', accidental: keyAccidental };
  const fontSize = pickFontSize(bar.chordSlots, ticksPerBar, key);
  const tensionFontSize = fontSize * TENSION_SIZE_RATIO;
  return (
    <svg className="bar-svg" viewBox={`0 0 ${BAR_W} ${BAR_H}`} role="img" aria-label={`마디 ${barNumber}`}>
      {isActiveBar && <rect className="bar-active-tint" x={1} y={1} width={BAR_W - 2} height={BAR_H - 2} rx={8} />}

      <text className="bar-number" x={6} y={10}>{barNumber}</text>

      <line className="staff-line" x1={PAD_X} y1={STAFF_Y} x2={BAR_W - PAD_X} y2={STAFF_Y} />
      <line className="bar-line" x1={2} y1={STEM_TOP - 4} x2={2} y2={STAFF_Y + 14} />
      <line className="bar-line" x1={BAR_W - 2} y1={STEM_TOP - 4} x2={BAR_W - 2} y2={STAFF_Y + 14} />

      {bar.chordSlots.map((cs, i) => {
        const nextTick = bar.chordSlots[i + 1]?.tick ?? ticksPerBar;
        const isActiveChord = isActiveBar && activeChordTick === cs.tick;
        const { base, superscript } = chordLabelParts(cs.chord, key);
        const baseWidth = base.length * fontSize * MONO_CHAR_WIDTH;
        const estWidth = labelWidth(base, superscript, fontSize);
        const labelX = Math.min(xOf(cs.tick, ticksPerBar), BAR_W - PAD_X - estWidth);
        const labelClass = isActiveChord ? 'chord-label chord-label-active' : 'chord-label';
        return (
          <g key={cs.tick}>
            {isActiveChord && (
              <rect
                className="chord-active-underline"
                x={xOf(cs.tick, ticksPerBar) - 3}
                y={STAFF_Y + 8}
                width={xOf(nextTick, ticksPerBar) - xOf(cs.tick, ticksPerBar) - 6}
                height={3}
                rx={1.5}
              />
            )}
            <text className={labelClass} x={labelX} y={CHORD_LABEL_Y} style={{ fontSize }}>
              {base}
            </text>
            {superscript && (
              <text
                className={`${labelClass} chord-tension`}
                x={labelX + baseWidth}
                y={CHORD_LABEL_Y - fontSize * TENSION_RAISE}
                style={{ fontSize: tensionFontSize }}
              >
                {superscript}
              </text>
            )}
          </g>
        );
      })}

      {units.map((u, gi) => {
        if (u.kind === 'beam') {
          const x0 = xOf(u.slots[0].tick, ticksPerBar);
          const x1 = xOf(u.slots[u.slots.length - 1].tick, ticksPerBar);
          return (
            <g key={gi}>
              <line className="beam" x1={x0} y1={STEM_TOP} x2={x1} y2={STEM_TOP} />
              {u.slots.map((s) => (
                <g key={s.tick}>
                  <Stem x={xOf(s.tick, ticksPerBar)} />
                  <NoteHead x={xOf(s.tick, ticksPerBar)} />
                </g>
              ))}
            </g>
          );
        }
        const s = u.slots[0];
        return <SingleNote key={gi} x={xOf(s.tick, ticksPerBar)} ticks={s.ticks} />;
      })}
    </svg>
  );
}

interface StaffViewProps {
  progression: Progression;
  activeBar: number | null;
  activeChordTick: number | null;
  barsPerRow?: number;
}

export function StaffView({ progression, activeBar, activeChordTick, barsPerRow = 4 }: StaffViewProps) {
  const rows: number[][] = [];
  for (let i = 0; i < progression.bars.length; i += barsPerRow) {
    rows.push(Array.from({ length: Math.min(barsPerRow, progression.bars.length - i) }, (_, j) => i + j));
  }

  return (
    <div className="staff-view">
      {rows.map((row, ri) => (
        <div className="staff-row" style={{ gridTemplateColumns: `repeat(${barsPerRow}, 1fr)` }} key={ri}>
          {row.map((barIdx) => (
            <BarView
              key={barIdx}
              bar={progression.bars[barIdx]}
              barNumber={barIdx + 1}
              timeSig={progression.timeSig}
              keyAccidental={progression.key.accidental}
              isActiveBar={activeBar === barIdx}
              activeChordTick={activeChordTick}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
