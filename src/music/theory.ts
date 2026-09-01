// 12음 피치클래스 기반 코드 이론: 키 트랜스포즈, 다이아토닉/논다이아토닉 코드 풀, 2-5-1 헬퍼.

export type PitchClass = number; // 0-11, 0 = C

export type ChordQuality =
  | 'maj' | 'min' | 'dim'
  | 'maj7' | 'min7' | 'dom7' | 'm7b5' | 'dim7';

// 'plain'(9/11/13)은 코드 기호의 7 자리를 대체해서 적고(G7→G9), 'altered'(b9/#9/#11/b13)는
// 원래 코드 기호를 그대로 둔 채 옆에 작게 덧붙여 적는다 — 실제 리드시트 표기 관행과 동일.
export interface Tension {
  kind: 'plain' | 'altered';
  text: string;
}

export interface ChordSymbol {
  root: PitchClass;
  quality: ChordQuality;
  tension?: Tension;
  // 트라이톤 서브(subV7)처럼 관행상 항상 플랫으로 적는 코드에 표시 — 키의 샾/플랫 선호와 무관하게 강제한다.
  forceFlatSpelling?: boolean;
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

// plain 텐션이 7 자리를 대체할 때 붙는 접두어 (예: maj7+plain9 → "maj"+"9" = "maj9").
const QUALITY_TENSION_PREFIX: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  maj7: 'maj',
  min7: 'm',
  dom7: '',
  m7b5: 'm7b5',
  dim7: 'dim7',
};

// 텐션이 자연스러운 코드 성질에만 후보 풀을 정의한다 (m7b5·dim7·트라이어드는 텐션을 얹지 않음).
const TENSION_POOLS: Partial<Record<ChordQuality, Tension[]>> = {
  dom7: [
    { kind: 'plain', text: '9' }, { kind: 'plain', text: '13' },
    { kind: 'altered', text: 'b9' }, { kind: 'altered', text: '#9' },
    { kind: 'altered', text: '#11' }, { kind: 'altered', text: 'b13' },
  ],
  maj7: [
    { kind: 'plain', text: '9' }, { kind: 'plain', text: '13' },
    { kind: 'altered', text: '#11' },
  ],
  min7: [
    { kind: 'plain', text: '9' }, { kind: 'plain', text: '11' },
  ],
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

// 화면에 그릴 두 부분: base는 기본 크기로, superscript(있다면)는 그 옆에 작게 얹어 그린다.
export function chordLabelParts(chord: ChordSymbol, key: KeyDef): { base: string; superscript: string } {
  const accidental = chord.forceFlatSpelling ? 'flat' : key.accidental;
  const rootName = spellNote(chord.root, accidental);

  if (!chord.tension) {
    return { base: rootName + QUALITY_SUFFIX[chord.quality], superscript: '' };
  }
  if (chord.tension.kind === 'plain') {
    return { base: rootName + QUALITY_TENSION_PREFIX[chord.quality] + chord.tension.text, superscript: '' };
  }
  return { base: rootName + QUALITY_SUFFIX[chord.quality], superscript: chord.tension.text };
}

export function chordLabel(chord: ChordSymbol, key: KeyDef): string {
  const { base, superscript } = chordLabelParts(chord, key);
  return base + superscript;
}

// chance 확률로 코드 성질에 맞는 텐션 하나를 얹는다 (해당 성질에 정의된 풀이 없으면 그대로 반환).
export function maybeAddTension(chord: ChordSymbol, chance: number, rng: () => number): ChordSymbol {
  if (rng() >= chance) return chord;
  const pool = TENSION_POOLS[chord.quality];
  if (!pool || pool.length === 0) return chord;
  const tension = pool[Math.floor(rng() * pool.length)];
  return { ...chord, tension };
}

// 트라이톤 서브: 도미넌트7 코드를 반음 위 도미넌트7로 치환 (같은 트라이톤을 공유해 같은 타깃으로 해결됨).
// 관행상 항상 플랫 표기.
export function tritoneSub(chord: ChordSymbol): ChordSymbol {
  return { root: mod12(chord.root + 6), quality: 'dom7', forceFlatSpelling: true };
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

// target으로 해결되는 도미넌트 체인을 뒤에서부터 만든다.
// length=2: [ii, V] (target이 마이너면 ii는 m7b5). length>=3: 그 앞으로 5도권을 따라
// 순수 도미넌트7을 계속 쌓는다 (예: length=4 → [V7/V7ii, V7/ii, ii, V]).
export function dominantChain(target: ChordSymbol, length: number): ChordSymbol[] {
  const v: ChordSymbol = { root: mod12(target.root + 7), quality: 'dom7' };
  if (length <= 1) return [v];

  const isMinorTarget = target.quality === 'min' || target.quality === 'min7';
  const ii: ChordSymbol = { root: mod12(target.root + 2), quality: isMinorTarget ? 'm7b5' : 'min7' };
  const chain: ChordSymbol[] = [ii, v];

  let root = ii.root;
  for (let k = 2; k < length; k++) {
    root = mod12(root + 7);
    chain.unshift({ root, quality: 'dom7' });
  }
  return chain;
}
