import type { NoteSlot, TimeSignature } from '../music/rhythm';

export interface RenderUnit {
  kind: 'beam' | 'single';
  slots: NoteSlot[];
}

// 오직 "같은 펄스 안에 있고, 정확히 1틱(8분음표)이며, 펄스 경계를 넘지 않는" 연속 음표끼리만 빔으로 묶는다.
// 4분음표·점4분음표는 빔에 참여할 수 없다 — 항상 독립된 기둥(단일 유닛)으로 렌더링된다.
export function groupNotes(slots: NoteSlot[], ts: TimeSignature): RenderUnit[] {
  const units: RenderUnit[] = [];
  let run: NoteSlot[] = [];
  let runPulse: number | null = null;

  const flushRun = () => {
    if (run.length >= 2) units.push({ kind: 'beam', slots: run });
    else if (run.length === 1) units.push({ kind: 'single', slots: run });
    run = [];
    runPulse = null;
  };

  for (const slot of slots) {
    const pulse = Math.floor(slot.tick / ts.pulseTicks);
    const crossesBoundary = slot.tick + slot.ticks > (pulse + 1) * ts.pulseTicks;
    const isEighth = slot.ticks === 1;

    if (!isEighth || crossesBoundary) {
      flushRun();
      units.push({ kind: 'single', slots: [slot] });
      continue;
    }
    if (pulse !== runPulse) {
      flushRun();
      runPulse = pulse;
    }
    run.push(slot);
  }
  flushRun();
  return units;
}
