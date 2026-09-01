import { useCallback, useEffect, useRef, useState } from 'react';
import { PlaybackEngine } from '../audio/playbackEngine';
import type { Progression } from '../music/generator';

export interface PlaybackHead {
  isPlaying: boolean;
  activeBar: number;
  activeChordTick: number | null;
}

export function usePlayback(progression: Progression, bpm: number, metronomeOn: boolean, subdivide: boolean) {
  const engineRef = useRef<PlaybackEngine | null>(null);
  const eventsRef = useRef<{ tickIndexAbs: number; time: number }[]>([]);
  const progressionRef = useRef(progression);
  const rafRef = useRef<number | null>(null);
  const [head, setHead] = useState<PlaybackHead>({ isPlaying: false, activeBar: 0, activeChordTick: null });

  useEffect(() => {
    progressionRef.current = progression;
  }, [progression]);

  useEffect(() => {
    engineRef.current = new PlaybackEngine((e) => {
      const events = eventsRef.current;
      events.push(e);
      if (events.length > 64) events.shift();
    });
    return () => engineRef.current?.dispose();
  }, []);

  useEffect(() => {
    engineRef.current?.configure(progression, bpm);
  }, [progression, bpm]);

  useEffect(() => {
    engineRef.current?.setBpm(bpm);
  }, [bpm]);

  useEffect(() => {
    engineRef.current?.setMetronomeOn(metronomeOn);
  }, [metronomeOn]);

  useEffect(() => {
    engineRef.current?.setSubdivide(subdivide);
  }, [subdivide]);

  useEffect(() => {
    function tick() {
      const engine = engineRef.current;
      if (engine?.playing) {
        const now = engine.currentTime;
        const events = eventsRef.current;
        let latest: { tickIndexAbs: number; time: number } | null = null;
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].time <= now) {
            latest = events[i];
            break;
          }
        }
        if (latest) {
          const prog = progressionRef.current;
          const ticksPerBar = prog.timeSig.ticksPerBar;
          const barIndex = Math.floor(latest.tickIndexAbs / ticksPerBar) % prog.bars.length;
          const tickInBar = latest.tickIndexAbs % ticksPerBar;
          const bar = prog.bars[barIndex];
          let activeTick: number | null = null;
          for (const slot of bar.chordSlots) {
            if (slot.tick <= tickInBar) activeTick = slot.tick;
          }
          setHead((s) => (s.activeBar === barIndex && s.activeChordTick === activeTick && s.isPlaying
            ? s
            : { isPlaying: true, activeBar: barIndex, activeChordTick: activeTick }));
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const play = useCallback(async () => {
    eventsRef.current = [];
    await engineRef.current?.start();
    setHead((s) => ({ ...s, isPlaying: true }));
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.stop();
    setHead({ isPlaying: false, activeBar: 0, activeChordTick: null });
  }, []);

  return { ...head, play, pause };
}
