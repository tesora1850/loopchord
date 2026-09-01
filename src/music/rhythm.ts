// 박자표 정의 + 마디 단위 리듬(슬래시 표기용 노트헤드) 생성.
// 최소 단위(tick) = 8분음표. 4/4·3/4는 단순박(펄스=2틱), 6/8은 복합박(펄스=3틱, 점4분음표).

export type TimeSigId = '4/4' | '3/4' | '6/8';

export interface TimeSignature {
  id: TimeSigId;
  label: string;
  ticksPerBar: number;
  pulseTicks: number; // 펄스(기준 박) 하나의 틱 수
  pulseCount: number;
  pulseUnitLabel: string; // 화면에 표시할 기준 음표 기호
  accent: boolean[]; // 펄스별 강박 여부
}

export const TIME_SIGNATURES: Record<TimeSigId, TimeSignature> = {
  '4/4': { id: '4/4', label: '4/4', ticksPerBar: 8, pulseTicks: 2, pulseCount: 4, pulseUnitLabel: '♩', accent: [true, false, false, false] },
  '3/4': { id: '3/4', label: '3/4', ticksPerBar: 6, pulseTicks: 2, pulseCount: 3, pulseUnitLabel: '♩', accent: [true, false, false] },
  '6/8': { id: '6/8', label: '6/8', ticksPerBar: 6, pulseTicks: 3, pulseCount: 2, pulseUnitLabel: '♩.', accent: [true, false] },
};

export type RhythmDensity = 'quarter' | 'eighthLow' | 'eighthHigh';

export interface NoteSlot {
  tick: number;
  ticks: number;
}

export type Rng = () => number;

function splitCompoundPulse(startTick: number, density: RhythmDensity, rng: Rng): NoteSlot[] {
  const r = rng();
  if (density === 'eighthHigh' && r < 0.34) {
    return [{ tick: startTick, ticks: 1 }, { tick: startTick + 1, ticks: 1 }, { tick: startTick + 2, ticks: 1 }];
  }
  if (r < 0.67) {
    return [{ tick: startTick, ticks: 2 }, { tick: startTick + 2, ticks: 1 }];
  }
  return [{ tick: startTick, ticks: 1 }, { tick: startTick + 1, ticks: 2 }];
}

export function generateNoteRhythm(
  ts: TimeSignature,
  density: RhythmDensity,
  syncopation: boolean,
  rng: Rng,
): NoteSlot[] {
  let slots: NoteSlot[] = [];

  for (let p = 0; p < ts.pulseCount; p++) {
    const startTick = p * ts.pulseTicks;
    if (density === 'quarter') {
      slots.push({ tick: startTick, ticks: ts.pulseTicks });
      continue;
    }
    const splitProb = density === 'eighthLow' ? 0.4 : 0.7;
    if (rng() >= splitProb) {
      slots.push({ tick: startTick, ticks: ts.pulseTicks });
    } else if (ts.pulseTicks === 2) {
      slots.push({ tick: startTick, ticks: 1 }, { tick: startTick + 1, ticks: 1 });
    } else {
      slots.push(...splitCompoundPulse(startTick, density, rng));
    }
  }

  if (syncopation) {
    slots = applySyncopation(slots, ts, rng);
  }

  return slots;
}

// 펄스 경계 직전의 짧은(오프비트) 슬롯 하나를 다음 펄스 첫 슬롯과 묶어 당김음(예: 못갖춘 마디 형 push)을 만든다.
function applySyncopation(slots: NoteSlot[], ts: TimeSignature, rng: Rng): NoteSlot[] {
  if (rng() >= 0.35) return slots;

  const pulseBoundaries = new Set<number>();
  for (let p = 1; p < ts.pulseCount; p++) pulseBoundaries.add(p * ts.pulseTicks);

  for (let i = 0; i < slots.length - 1; i++) {
    const cur = slots[i];
    const next = slots[i + 1];
    const boundary = cur.tick + cur.ticks;
    if (cur.ticks === 1 && pulseBoundaries.has(boundary) && next.tick === boundary) {
      const merged = { tick: cur.tick, ticks: cur.ticks + next.ticks };
      return [...slots.slice(0, i), merged, ...slots.slice(i + 2)];
    }
  }
  return slots;
}

// 코드 심벌 라벨이 서로 겹치지 않도록 확보할 최소 틱 간격.
export function minChordGapTicks(ts: TimeSignature): number {
  return Math.max(ts.pulseTicks + 1, Math.ceil(ts.ticksPerBar / 3));
}

// note-rhythm 슬롯 시작 지점 중 일부를 코드 변경 지점으로 선택 (첫 슬롯은 항상 포함).
// 코드 심벌 텍스트가 겹치지 않도록 선택된 지점끼리 최소 틱 간격(minGapTicks)을 강제한다 —
// 간격 조건을 만족하는 후보가 부족하면 desiredCount보다 적게 뽑힐 수 있다(의도된 동작).
export function pickChordChangeTicks(slots: NoteSlot[], desiredCount: number, minGapTicks: number, rng: Rng): number[] {
  const starts = slots.map((s) => s.tick);
  if (starts.length === 0) return [0];

  const chosen = [starts[0]];
  const shuffled = starts.slice(1);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (const t of shuffled) {
    if (chosen.length >= desiredCount) break;
    if (chosen.every((c) => Math.abs(c - t) >= minGapTicks)) chosen.push(t);
  }
  return chosen.sort((a, b) => a - b);
}
