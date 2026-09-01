import {
  type ChordSymbol, type PitchClass, type KeyDef,
  diatonicChord, secondaryDominant, borrowedChords, dominantChain, tritoneSub, maybeAddTension, sameChord,
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
  chainLengthRange: [number, number];
  subVChance: number;
  tensionChance: number;
  seventhChance: number;
  defaultBpm: number;
}

export const DIFFICULTIES: DifficultyConfig[] = [
  {
    level: 1, shortLabel: '1단계', label: '다이아토닉 트라이어드',
    description: '1마디 1코드 · 4분음표', nonDiatonicRatio: 0,
    chordChangesPerBar: [1, 1], rhythmDensity: 'quarter', syncopation: false,
    twoFiveOneChance: 0, chainLengthRange: [2, 2], subVChance: 0, tensionChance: 0,
    seventhChance: 0, defaultBpm: 60,
  },
  {
    level: 2, shortLabel: '2단계', label: '1마디 2코드',
    description: '1마디 2코드 · 4분음표', nonDiatonicRatio: 0,
    chordChangesPerBar: [2, 2], rhythmDensity: 'quarter', syncopation: false,
    twoFiveOneChance: 0, chainLengthRange: [2, 2], subVChance: 0, tensionChance: 0,
    seventhChance: 0.3, defaultBpm: 70,
  },
  {
    level: 3, shortLabel: '3단계', label: '논다이아토닉 도입',
    description: '논다이아토닉 약 1/3 · 4분음표', nonDiatonicRatio: 0.33,
    chordChangesPerBar: [1, 2], rhythmDensity: 'quarter', syncopation: false,
    twoFiveOneChance: 0.05, chainLengthRange: [2, 2], subVChance: 0, tensionChance: 0,
    seventhChance: 0.6, defaultBpm: 80,
  },
  {
    level: 4, shortLabel: '4단계', label: '2-5-1 + 8분음표',
    description: '논다이아토닉 약 1/2 · 8분음표 혼합', nonDiatonicRatio: 0.5,
    chordChangesPerBar: [1, 2], rhythmDensity: 'eighthLow', syncopation: false,
    twoFiveOneChance: 0.15, chainLengthRange: [2, 3], subVChance: 0.15, tensionChance: 0.15,
    seventhChance: 0.8, defaultBpm: 90,
  },
  {
    level: 5, shortLabel: '5단계', label: '자유 진행 + 당김음',
    description: '모달 인터체인지 · 8분음표+당김음', nonDiatonicRatio: 0.7,
    chordChangesPerBar: [1, 3], rhythmDensity: 'eighthHigh', syncopation: true,
    twoFiveOneChance: 0.3, chainLengthRange: [2, 4], subVChance: 0.35, tensionChance: 0.35,
    seventhChance: 1, defaultBpm: 100,
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

const DEGREE_COUNT = 7;

// avoid가 주어지면 그 코드는 후보 풀에서 제외하고 뽑는다 — 바로 앞 코드와의 즉시 반복을 원천 차단.
function pickChord(config: DifficultyConfig, keyRoot: PitchClass, rng: Rng, avoid: ChordSymbol | null): ChordSymbol {
  const useSeventh = rng() < config.seventhChance;
  const useNonDiatonic = rng() < config.nonDiatonicRatio;

  const pool: ChordSymbol[] = useNonDiatonic
    ? [
        ...SECONDARY_DOMINANT_TARGETS.map((t) => secondaryDominant(keyRoot, t)),
        ...(config.level === 5 ? borrowedChords(keyRoot) : []),
      ]
    : Array.from({ length: DEGREE_COUNT }, (_, d) => diatonicChord(keyRoot, d, useSeventh));

  const candidates = pool.filter((c) => !sameChord(c, avoid));
  const usable = candidates.length > 0 ? candidates : pool;
  const chosen = usable[Math.floor(rng() * usable.length)];
  return maybeAddTension(chosen, config.tensionChance, rng);
}

function chordCountForBar(config: DifficultyConfig, rng: Rng): number {
  const [min, max] = config.chordChangesPerBar;
  return min + Math.floor(rng() * (max - min + 1));
}

function buildBarSkeleton(config: DifficultyConfig, ts: TimeSignature, rng: Rng): { noteSlots: NoteSlot[]; chordCount: number } {
  return { noteSlots: generateNoteRhythm(ts, config.rhythmDensity, config.syncopation, rng), chordCount: chordCountForBar(config, rng) };
}

// 마디 경계를 넘나들며 순차적으로 코드를 뽑아 "바로 앞 코드와 같은 코드"가 나오지 않게 한다.
function generateChordSequence(chordCounts: number[], config: DifficultyConfig, keyRoot: PitchClass, rng: Rng): ChordSymbol[][] {
  const result: ChordSymbol[][] = chordCounts.map(() => []);
  let prev: ChordSymbol | null = null;
  for (let bi = 0; bi < chordCounts.length; bi++) {
    for (let si = 0; si < chordCounts[bi]; si++) {
      const chord = pickChord(config, keyRoot, rng, prev);
      result[bi].push(chord);
      prev = chord;
    }
  }
  return result;
}

function assembleBars(skeletons: { noteSlots: NoteSlot[]; chordCount: number }[], chordSequence: ChordSymbol[][], ts: TimeSignature, rng: Rng): Bar[] {
  return skeletons.map((sk, bi) => {
    const ticks = pickChordChangeTicks(sk.noteSlots, sk.chordCount, minChordGapTicks(ts), rng);
    const chordSlots = ticks.map((tick, i) => ({ tick, chord: chordSequence[bi][i] }));
    return { noteSlots: sk.noteSlots, chordSlots };
  });
}

// 체인의 각 도미넌트 링크에 확률적으로 트라이톤 서브 치환 + 텐션을 얹는다. ii(min7/m7b5)는 서브 대상이 아니다.
function decorateChainLink(chord: ChordSymbol, config: DifficultyConfig, rng: Rng): ChordSymbol {
  let c = chord;
  if (c.quality === 'dom7' && rng() < config.subVChance) c = tritoneSub(c);
  return maybeAddTension(c, config.tensionChance, rng);
}

// 8마디(가변) 전체를 이어붙인 흐름에서, 무작위 지점을 타깃(I)으로 잡아 그 앞을 도미넌트 체인(ii-V, 또는 더 긴
// 확장된 도미넌트 체인)으로 치환한다. 체인 길이는 "타깃 앞 최대 3마디 안에 있는 코드 슬롯 수"를 넘지 않는다 —
// 마디 밀도가 낮으면 체인도 짧게, 밀도가 높으면(예: 3마디×마디당 2개=6슬롯) 체인도 그만큼 길어질 수 있다.
const CHAIN_LOOKBACK_BARS = 3;

function applyDominantChains(bars: Bar[], config: DifficultyConfig, rng: Rng): void {
  if (config.twoFiveOneChance <= 0) return;
  const flat: { bar: number; idx: number }[] = [];
  bars.forEach((b, bi) => b.chordSlots.forEach((_, si) => flat.push({ bar: bi, idx: si })));

  let i = 2;
  while (i < flat.length) {
    if (rng() < config.twoFiveOneChance) {
      const targetRef = flat[i];
      const target = bars[targetRef.bar].chordSlots[targetRef.idx].chord;

      const earliestBar = Math.max(0, targetRef.bar - CHAIN_LOOKBACK_BARS);
      let roomAvailable = 0;
      while (roomAvailable < i && flat[i - 1 - roomAvailable].bar >= earliestBar) roomAvailable++;

      const [minLen, maxLen] = config.chainLengthRange;
      const desired = minLen + Math.floor(rng() * (maxLen - minLen + 1));
      const length = Math.min(desired, roomAvailable);

      if (length < 2) {
        i += 1;
        continue;
      }

      const chain = dominantChain(target, length).map((link) => decorateChainLink(link, config, rng));
      for (let k = 0; k < chain.length; k++) {
        const ref = flat[i - chain.length + k];
        bars[ref.bar].chordSlots[ref.idx].chord = chain[k];
      }
      i += chain.length + 1;
    } else {
      i += 1;
    }
  }
}

// 이 진행은 반복 재생되는 루프이므로, 마지막 코드→첫 코드로 돌아가는 경계도 반복 금지 대상이다.
// 2-5-1 삽입까지 끝난 뒤 맨 마지막에 실행해야, 앞선 단계가 이 보정을 덮어쓰지 않는다.
function fixLoopBoundary(bars: Bar[], config: DifficultyConfig, keyRoot: PitchClass, rng: Rng): void {
  if (bars.length < 2) return;
  const firstSlots = bars[0].chordSlots;
  const lastSlots = bars[bars.length - 1].chordSlots;
  if (firstSlots.length === 0 || lastSlots.length === 0) return;

  const last = lastSlots[lastSlots.length - 1].chord;
  const first = firstSlots[0].chord;
  if (!sameChord(first, last)) return;

  // firstBar에 코드가 1개뿐이면(레벨1처럼) "다음 코드"는 같은 마디가 아니라 다음 마디의 첫 코드다.
  const next = firstSlots.length > 1 ? firstSlots[1].chord : (bars[1]?.chordSlots[0]?.chord ?? null);
  let replacement = pickChord(config, keyRoot, rng, last);
  let attempts = 0;
  while (sameChord(replacement, next) && attempts < 6) {
    replacement = pickChord(config, keyRoot, rng, last);
    attempts++;
  }
  firstSlots[0] = { tick: firstSlots[0].tick, chord: replacement };
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
  const skeletons = Array.from({ length: barCount }, () => buildBarSkeleton(config, ts, rng));
  const chordSequence = generateChordSequence(skeletons.map((s) => s.chordCount), config, keyRoot, rng);
  const bars = assembleBars(skeletons, chordSequence, ts, rng);
  applyDominantChains(bars, config, rng);
  fixLoopBoundary(bars, config, keyRoot, rng);
  return { bars, timeSig: ts, key: findKey(keyRoot), level };
}

// 코드만 재생성: 기존 리듬(노트 슬롯·코드 변경 타이밍)은 그대로, 코드 내용만 새로 뽑는다.
export function refreshChordsOnly(prog: Progression, rng: Rng = Math.random): Progression {
  const config = DIFFICULTIES[prog.level - 1];
  const chordCounts = prog.bars.map((b) => b.chordSlots.length);
  const chordSequence = generateChordSequence(chordCounts, config, prog.key.pc, rng);
  const bars = prog.bars.map((b, bi) => ({
    noteSlots: b.noteSlots,
    chordSlots: b.chordSlots.map((cs, i) => ({ tick: cs.tick, chord: chordSequence[bi][i] })),
  }));
  applyDominantChains(bars, config, rng);
  fixLoopBoundary(bars, config, prog.key.pc, rng);
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
      chord: { ...cs.chord, root: mod12(cs.chord.root + delta) },
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
