import type { Progression } from '../music/generator';

interface ScheduledTick {
  tickIndexAbs: number;
  time: number;
}

// Web Audio 룩어헤드 스케줄러. 오디오 클릭과 UI 재생헤드가 같은 AudioContext 시계를 공유해 드리프트가 없다.
export class PlaybackEngine {
  private ctx: AudioContext;
  private timerId: number | null = null;
  private nextTickTime = 0;
  private nextTickIndexAbs = 0;
  private totalTicks = 1;
  private ticksPerBar = 8;
  private pulseTicks = 2;
  private accent: boolean[] = [true, false, false, false];
  private tickDuration = 0.25;
  private metronomeOn = true;
  private readonly lookaheadMs = 25;
  private readonly scheduleAheadTime = 0.12;
  playing = false;
  private onScheduledTick: (e: ScheduledTick) => void;

  constructor(onScheduledTick: (e: ScheduledTick) => void) {
    this.onScheduledTick = onScheduledTick;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
  }

  get currentTime(): number {
    return this.ctx.currentTime;
  }

  setMetronomeOn(v: boolean): void {
    this.metronomeOn = v;
  }

  configure(progression: Progression, bpm: number): void {
    this.ticksPerBar = progression.timeSig.ticksPerBar;
    this.pulseTicks = progression.timeSig.pulseTicks;
    this.accent = progression.timeSig.accent;
    this.totalTicks = Math.max(1, progression.bars.length * this.ticksPerBar);
    this.setBpm(bpm);
  }

  setBpm(bpm: number): void {
    const pulseDuration = 60 / Math.max(1, bpm);
    this.tickDuration = pulseDuration / this.pulseTicks;
  }

  async start(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.playing = true;
    this.nextTickIndexAbs = 0;
    this.nextTickTime = this.ctx.currentTime + 0.05;
    this.scheduler();
  }

  stop(): void {
    this.playing = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  dispose(): void {
    this.stop();
    void this.ctx.close();
  }

  private scheduler = (): void => {
    while (this.nextTickTime < this.ctx.currentTime + this.scheduleAheadTime) {
      const tickInBar = this.nextTickIndexAbs % this.ticksPerBar;
      if (this.metronomeOn && tickInBar % this.pulseTicks === 0) {
        const pulseIdx = tickInBar / this.pulseTicks;
        this.playClick(this.nextTickTime, this.accent[pulseIdx] ?? false);
      }
      this.onScheduledTick({ tickIndexAbs: this.nextTickIndexAbs, time: this.nextTickTime });
      this.nextTickTime += this.tickDuration;
      this.nextTickIndexAbs = (this.nextTickIndexAbs + 1) % this.totalTicks;
    }
    if (this.playing) {
      this.timerId = window.setTimeout(this.scheduler, this.lookaheadMs);
    }
  };

  private playClick(time: number, accent: boolean): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = accent ? 1500 : 1000;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.45, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.start(time);
    osc.stop(time + 0.06);
  }
}
