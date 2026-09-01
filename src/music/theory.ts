// 12음 피치클래스 기반 코드 이론: 키 트랜스포즈, 다이아토닉/논다이아토닉 코드 풀, 2-5-1 헬퍼.

export type PitchClass = number; // 0-11, 0 = C

export type ChordQuality =
  | 'maj' | 'min' | 'dim'
  | 'maj7' | 'min7' | 'dom7' | 'm7b5' | 'dim7';

export interface ChordSymbol {
  root: PitchClass;
  quality: ChordQuality;
}

export function sameChord(a: ChordSymbol, b: ChordSymbol | null | undefined): boolean {
  return !!b && a.root === b.root && a.quality === b.quality;
}

export interface KeyDef {
  pc: PitchClass;
  name: string;
  accidental: 'sharp' | 'flat';
}

// 실용적으로 흔히 쓰는 스펠링만 채택 (Real Book 관행과 유사) — 12개 피치클래스를 정확히 한 번씩 커버.
export const KEYS: KeyDef[] = [
  { pc: 0, name: 'C', accidental: 'sharp' },
  { pc: 7, name: 'G', accidental: 'sharp' },
  { pc: 2, name: 'D', accidental: 'sharp' },
  { pc: 9, name: 'A', accidental: 'sharp' },
  { pc: 4, name: 'E', accidental: 'sharp' },
  { pc: 11, name: 'B', accidental: 'sharp' },
  { pc: 6, name: 'F#', accidental: 'sharp' },
  { pc: 1, name: 'Db', accidental: 'flat' },
  { pc: 8, name: 'Ab', accidental: 'flat' },
  { pc: 3, name: 'Eb', accidental: 'flat' },
  { pc: 10, name: 'Bb', accidental: 'flat' },
  { pc: 5, name: 'F', accidental: 'flat' },
];

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  maj7: 'maj7',
  min7: 'm7',
  dom7: '7',
  m7b5: 'm7b5',
  dim7: 'dim7',
};

export function mod12(n: number): PitchClass {
  return ((n % 12) + 12) % 12;
}

export function findKey(pc: PitchClass): KeyDef {
  return KEYS.find((k) => k.pc === pc) ?? KEYS[0];
}

export function spellNote(pc: PitchClass, keyAccidental: 'sharp' | 'flat'): string {
  return keyAccidental === 'sharp' ? SHARP_NAMES[mod12(pc)] : FLAT_NAMES[mod12(pc)];
}

export function chordLabel(chord: ChordSymbol, key: KeyDef): string {
  return spellNote(chord.root, key.accidental) + QUALITY_SUFFIX[chord.quality];
}

// 메이저 스케일 7 디그리: I ii iii IV V vi vii
export interface DegreeDef {
  index: number; // 0-6 (I..vii)
  offset: number; // 키 루트 기준 반음
  triadQ: ChordQuality;
  seventhQ: ChordQuality;
}

export const DIATONIC_DEGREES: DegreeDef[] = [
  { index: 0, offset: 0, triadQ: 'maj', seventhQ: 'maj7' }, // I
  { index: 1, offset: 2, triadQ: 'min', seventhQ: 'min7' }, // ii
  { index: 2, offset: 4, triadQ: 'min', seventhQ: 'min7' }, // iii
  { index: 3, offset: 5, triadQ: 'maj', seventhQ: 'maj7' }, // IV
  { index: 4, offset: 7, triadQ: 'maj', seventhQ: 'dom7' }, // V
  { index: 5, offset: 9, triadQ: 'min', seventhQ: 'min7' }, // vi
  { index: 6, offset: 11, triadQ: 'dim', seventhQ: 'm7b5' }, // vii
];

export function diatonicChord(keyRoot: PitchClass, degreeIndex: number, useSeventh: boolean): ChordSymbol {
  const d = DIATONIC_DEGREES[degreeIndex];
  return { root: mod12(keyRoot + d.offset), quality: useSeventh ? d.seventhQ : d.triadQ };
}

// 세컨더리 도미넌트가 유효한 타깃 디그리 (I, vii 제외)
export const SECONDARY_DOMINANT_TARGETS = [1, 2, 3, 4, 5];

export function secondaryDominant(keyRoot: PitchClass, targetDegreeIndex: number): ChordSymbol {
  const target = diatonicChord(keyRoot, targetDegreeIndex, true);
  return { root: mod12(target.root + 7), quality: 'dom7' };
}

// 평행조 차용화음 (모달 인터체인지) — 고난이도 전용 풀
export function borrowedChords(keyRoot: PitchClass): ChordSymbol[] {
  return [
    { root: mod12(keyRoot + 3), quality: 'maj7' }, // bIIImaj7
    { root: mod12(keyRoot + 8), quality: 'maj7' }, // bVImaj7
    { root: mod12(keyRoot + 10), quality: 'dom7' }, // bVII7
    { root: mod12(keyRoot + 5), quality: 'min7' }, // iv (차용 마이너)
  ];
}

// target 코드로 해결되는 ii-V 페어. target이 메이저 계열이면 메이저 ii-V, 마이너 계열이면 마이너 ii-V(m7b5).
export function iiVFor(target: ChordSymbol): [ChordSymbol, ChordSymbol] {
  const isMinorTarget = target.quality === 'min' || target.quality === 'min7';
  const ii: ChordSymbol = isMinorTarget
    ? { root: mod12(target.root + 2), quality: 'm7b5' }
    : { root: mod12(target.root + 2), quality: 'min7' };
  const v: ChordSymbol = { root: mod12(target.root + 7), quality: 'dom7' };
  return [ii, v];
}
