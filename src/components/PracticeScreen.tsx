import { useMemo, useState } from 'react';
import { KEYS } from '../music/theory';
import { TIME_SIGNATURES, type TimeSigId } from '../music/rhythm';

const TIME_SIG_IDS = Object.keys(TIME_SIGNATURES) as TimeSigId[];
import {
  DIFFICULTIES,
  type Level,
  type Progression,
  generateProgression,
  refreshChordsOnly,
  refreshRhythmOnly,
  transposeProgression,
  changeTimeSignature,
} from '../music/generator';
import { usePlayback } from '../hooks/usePlayback';
import { StaffView } from '../notation/StaffView';
import './PracticeScreen.css';

interface PracticeScreenProps {
  level: Level;
  barCount: number;
  onBack: () => void;
}

export function PracticeScreen({ level, barCount, onBack }: PracticeScreenProps) {
  const config = DIFFICULTIES[level - 1];
  const [keyPc, setKeyPc] = useState(0);
  const [timeSigId, setTimeSigId] = useState<TimeSigId>('4/4');
  const [bpm, setBpm] = useState(config.defaultBpm);
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [subdivide, setSubdivide] = useState(false);
  const [progression, setProgression] = useState<Progression>(() =>
    generateProgression(level, barCount, timeSigId, keyPc),
  );

  const playback = usePlayback(progression, bpm, metronomeOn, subdivide);

  const handleKeyChange = (pc: number) => {
    setKeyPc(pc);
    setProgression((p) => transposeProgression(p, pc));
  };

  const handleTimeSigChange = (id: TimeSigId) => {
    setTimeSigId(id);
    setProgression((p) => changeTimeSignature(p, id));
  };

  const handleRefreshBoth = () => setProgression(generateProgression(level, barCount, timeSigId, keyPc));
  const handleRefreshChords = () => setProgression((p) => refreshChordsOnly(p));
  const handleRefreshRhythm = () => setProgression((p) => refreshRhythmOnly(p));

  const bpmInputId = useMemo(() => `bpm-${level}`, [level]);

  return (
    <div className="practice-screen">
      <div className="toolbar">
        <button className="tb-back" onClick={onBack} type="button">← 뒤로</button>

        <div className="tb-group">
          <label className="tb-label" htmlFor="key-select">Key</label>
          <select
            id="key-select"
            className="tb-select"
            value={keyPc}
            onChange={(e) => handleKeyChange(Number(e.target.value))}
          >
            {KEYS.map((k) => (
              <option key={k.pc} value={k.pc}>{k.name}</option>
            ))}
          </select>
        </div>

        <div className="tb-group">
          <label className="tb-label" htmlFor="ts-select">박자</label>
          <select
            id="ts-select"
            className="tb-select"
            value={timeSigId}
            onChange={(e) => handleTimeSigChange(e.target.value as TimeSigId)}
          >
            {TIME_SIG_IDS.map((id) => (
              <option key={id} value={id}>{TIME_SIGNATURES[id].label}</option>
            ))}
          </select>
        </div>

        <div className="tb-group tb-bpm">
          <label className="tb-label" htmlFor={bpmInputId}>BPM</label>
          <input
            type="range"
            min={40}
            max={208}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="tb-slider"
          />
          <input
            id={bpmInputId}
            type="number"
            min={40}
            max={208}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value) || bpm)}
            className="tb-bpm-input"
          />
        </div>

        <button
          className={playback.isPlaying ? 'tb-play tb-play-active' : 'tb-play'}
          onClick={() => (playback.isPlaying ? playback.pause() : playback.play())}
          type="button"
        >
          {playback.isPlaying ? '❚❚ 일시정지' : '▶ 재생'}
        </button>

        <button
          className={metronomeOn ? 'tb-metronome tb-metronome-active' : 'tb-metronome'}
          onClick={() => setMetronomeOn((v) => !v)}
          type="button"
          aria-pressed={metronomeOn}
        >
          🔊 메트로놈
        </button>

        <button
          className={subdivide ? 'tb-subdivide tb-subdivide-active' : 'tb-subdivide'}
          onClick={() => setSubdivide((v) => !v)}
          type="button"
          aria-pressed={subdivide}
          title="박마다 딴, 세분박마다 따다 — 예: 6/8에서 딴따다 딴따다"
        >
          딴따다
        </button>
      </div>

      <div className="refresh-cluster">
        <button className="refresh-main" onClick={handleRefreshBoth} type="button">↻ Refresh</button>
        <div className="refresh-sub">
          <button className="refresh-sub-btn" onClick={handleRefreshChords} type="button">코드만</button>
          <button className="refresh-sub-btn" onClick={handleRefreshRhythm} type="button">리듬만</button>
        </div>
      </div>

      <StaffView progression={progression} activeBar={playback.isPlaying ? playback.activeBar : null} activeChordTick={playback.activeChordTick} />
    </div>
  );
}
