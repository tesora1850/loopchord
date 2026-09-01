import {
  type ChordSymbol, type PitchClass, type KeyDef,
  diatonicChord, secondaryDominant, borrowedChords, iiVFor,
  findKey, mod12, SECONDARY_DOMINANT_TARGETS,
} from './theory';
import {
  type TimeSignature, type TimeSigId, type NoteSlot, type RhythmDensity, type Rng,
  TIME_SIGNATURES, generateNoteRhythm, pickChordChangeTicks, minChordGapTicks,
} from './rhythm';

export type Level = 1 | 2 | 3 | 4 | 5;

export interface DifficultyConfig {
  level: Level;
  label: string;
  shortLabel: string;
  description: string;
  nonDiatonicRatio: number;
  chordChangesPerBar: [number, number];
  rhythmDensity: RhythmDensity;
  syncopation: boolean;
  twoFiveOneChance: number;
  seventhChance: number;
  defaultBpm: number;
}

export const DIFFICULTIES: DifficultyConfig[] = [
  {
    level: 1, shortLabel: '1단계', label: '다이아토닉 트라이어드',
    description: '1마디 1코드 · 4분음표', nonDiatonicRatio: 0,
    chordChangesPerBar: [1, 1], rhythmDensity: 'quarter', syncopation: false,
    twoFiveOneChance: 0, seventhChance: 0, defaultBpm: 60,
  },
  {
    level: 2, shortLabel: '2단계', label: '1마디 2코드',
    description: '1마디 2코드 · 4분음표', nonDiatonicRatio: 0,
    chordChangesPerBar: [2, 2], rhythmDensity: 'quarter', syncopation: false,
    twoFiveOneChance: 0, seventhChance: 0.3, defaultBpm: 70,
  },
  {
    level: 3, shortLabel: '3단계', label: '논다이아토닉 도입',
    description: '논다이아토닉 약 1/3 · 4분음표', nonDiatonicRatio: 0.33,
    chordChangesPerBar: [1, 2], rhythmDensity: 'quarter', syncopation: false,
    twoFiveOneChance: 0.05, seventhChance: 0.6, defaultBpm: 80,
  },
  {
    level: 4, shortLabel: '4단계', label: '2-5-1 + 8분음표',
    description: '논다이아토닉 약 1/2 · 8분음표 혼합', nonDiatonicRatio: 0.5,
    chordChangesPerBar: [1, 2], rhythmDensity: 'eighthLow', syncopation: false,
    twoFiveOneChance: 0.15, seventhChance: 0.8, defaultBpm: 90,
  },
  {
    level: 5, shortLabel: '5단계', label: '자유 진행 + 당김음',
    description: '모달 인터체인지 · 8분음표+당김음', nonDiatonicRatio: 0.7,
    chordChangesPerBar: [1, 3], rhythmDensity: 'eighthHigh', syncopation: true,
    twoFiveOneChance: 0.3, seventhChance: 1, defaultBpm: 100,
  },
];

export interface ChordSlot {
  tick: number;
  chord: ChordSymbol;
}

export interface Bar {
  noteSlots: NoteSlot[];
  chordSlots: ChordSlot[];
}

export interface Progression {
  bars: Bar[];
  timeSig: TimeSignature;
  key: KeyDef;
  level: Level;
}

function pickChord(config: DifficultyConfig, keyRoot: PitchClass, rng: Rng): ChordSymbol {
  const useSeventh = rng() < config.seventhChance;
  if (rng() < config.nonDiatonicRatio) {
    const pool: ChordSymbol[] = SECONDARY_DOMINANT_TARGETS.map((t) => secondaryDominant(keyRoot, t));
    if (config.level === 5) pool.push(...borrowedChords(keyRoot));
    return pool[Math.floor(rng() * pool.length)];
  }
  const degreeIndex = Math.floor(rng() * 7);
  return diatonicChord(keyRoot, degreeIndex, useSeventh);
}

function chordSequenceForBar(config: DifficultyConfig, keyRoot: PitchClass, rng: Rng): ChordSymbol[] {
  const [min, max] = config.chordChangesPerBar;
  const count = min + Math.floor(rng() * (max - min + 1));
  return Array.from({ length: count }, () => pickChord(config, keyRoot, rng));
}

function buildBar(config: DifficultyConfig, ts: TimeSignature, keyRoot: PitchClass, rng: Rng): Bar {
  const noteSlots = generateNoteRhythm(ts, config.rhythmDensity, config.syncopation, rng);
  const chords = chordSequenceForBar(config, keyRoot, rng);
  const ticks = pickChordChangeTicks(noteSlots, chords.length, minChordGapTicks(ts), rng);
  const chordSlots = ticks.map((tick, i) => ({ tick, chord: chords[i] }));
  return { noteSlots, chordSlots };
}

// 8마디(가변) 전체를 이어붙인 흐름에서, 무작위 지점을 타깃(I)으로 잡아 앞의 두 코드 슬롯을 ii-V로 치환.
// 겹치지 않도록 삽입 후 3슬롯을 건너뛴다.
function applyTwoFiveOne(bars: Bar[], config: DifficultyConfig, rng: Rng): void {
  if (config.twoFiveOneChance <= 0) return;
  const flat: { bar: number; idx: number }[] = [];
  bars.forEach((b, bi) => b.chordSlots.forEach((_, si) => flat.push({ bar: bi, idx: si })));

  let i = 2;
  while (i < flat.length) {
    if (rng() < config.twoFiveOneChance) {
      const t = flat[i];
      const target = bars[t.bar].chordSlots[t.idx].chord;
      const [ii, v] = iiVFor(target);
      const p1 = flat[i - 1];
      const p2 = flat[i - 2];
      bars[p2.bar].chordSlots[p2.idx].chord = ii;
      bars[p1.bar].chordSlots[p1.idx].chord = v;
      i += 3;
    } else {
      i += 1;
    }
  }
}

export function generateProgression(
  level: Level,
  barCount: number,
  timeSigId: TimeSigId,
  keyRoot: PitchClass,
  rng: Rng = Math.random,
): Progression {
  const config = DIFFICULTIES[level - 1];
  const ts = TIME_SIGNATURES[timeSigId];
  const bars = Array.from({ length: barCount }, () => buildBar(config, ts, keyRoot, rng));
  applyTwoFiveOne(bars, config, rng);
  return { bars, timeSig: ts, key: findKey(keyRoot), level };
}

// 코드만 재생성: 기존 리듬(노트 슬롯·코드 변경 타이밍)은 그대로, 코드 내용만 새로 뽑는다.
export function refreshChordsOnly(prog: Progression, rng: Rng = Math.random): Progression {
  const config = DIFFICULTIES[prog.level - 1];
  const bars = prog.bars.map((b) => ({
    noteSlots: b.noteSlots,
    chordSlots: b.chordSlots.map((cs) => ({ tick: cs.tick, chord: pickChord(config, prog.key.pc, rng) })),
  }));
  applyTwoFiveOne(bars, config, rng);
  return { ...prog, bars };
}

// 리듬만 재생성: 기존 코드 진행(순서·내용)은 그대로, 타이밍만 새로 뽑는다.
export function refreshRhythmOnly(prog: Progression, rng: Rng = Math.random): Progression {
  const config = DIFFICULTIES[prog.level - 1];
  const bars = prog.bars.map((b) => {
    const noteSlots = generateNoteRhythm(prog.timeSig, config.rhythmDensity, config.syncopation, rng);
    const chords = b.chordSlots.map((cs) => cs.chord);
    const ticks = pickChordChangeTicks(noteSlots, chords.length, minChordGapTicks(prog.timeSig), rng);
    const chordSlots = ticks.map((tick, i) => ({ tick, chord: chords[i] ?? chords[chords.length - 1] }));
    return { noteSlots, chordSlots };
  });
  return { ...prog, bars };
}

// 키를 바꿀 때: 재생성 없이 모든 코드 루트를 이동시켜 트랜스포즈만 한다.
export function transposeProgression(prog: Progression, newKeyRoot: PitchClass): Progression {
  const delta = mod12(newKeyRoot - prog.key.pc);
  if (delta === 0) return prog;
  const bars = prog.bars.map((b) => ({
    noteSlots: b.noteSlots,
    chordSlots: b.chordSlots.map((cs) => ({
      tick: cs.tick,
      chord: { root: mod12(cs.chord.root + delta), quality: cs.chord.quality },
    })),
  }));
  return { ...prog, bars, key: findKey(newKeyRoot) };
}

// 박자표를 바꿀 때: 코드 진행 내용은 유지하고 리듬만 새 박자표에 맞게 다시 짠다.
export function changeTimeSignature(prog: Progression, newTimeSigId: TimeSigId, rng: Rng = Math.random): Progression {
  const config = DIFFICULTIES[prog.level - 1];
  const ts = TIME_SIGNATURES[newTimeSigId];
  const bars = prog.bars.map((b) => {
    const noteSlots = generateNoteRhythm(ts, config.rhythmDensity, config.syncopation, rng);
    const chords = b.chordSlots.map((cs) => cs.chord);
    const ticks = pickChordChangeTicks(noteSlots, chords.length, minChordGapTicks(ts), rng);
    const chordSlots = ticks.map((tick, i) => ({ tick, chord: chords[i] ?? chords[chords.length - 1] }));
    return { noteSlots, chordSlots };
  });
  return { ...prog, bars, timeSig: ts };
}
