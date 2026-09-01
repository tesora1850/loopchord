import { useState } from 'react';
import { DIFFICULTIES, type Level } from '../music/generator';
import './DifficultyScreen.css';

const BAR_COUNT_OPTIONS = [4, 8, 12, 16] as const;

interface DifficultyScreenProps {
  onStart: (level: Level, barCount: number) => void;
}

export function DifficultyScreen({ onStart }: DifficultyScreenProps) {
  const [level, setLevel] = useState<Level>(1);
  const [barCount, setBarCount] = useState(8);

  return (
    <div className="diff-screen">
      <header className="diff-header">
        <p className="diff-eyebrow">루프코드</p>
        <h1>난이도를 선택하세요</h1>
        <p className="diff-sub">손이 풀릴 때까지, 원하는 난이도로 반복 연습하세요.</p>
      </header>

      <div className="diff-grid">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.level}
            className={d.level === level ? 'diff-card diff-card-selected' : 'diff-card'}
            onClick={() => setLevel(d.level)}
            type="button"
          >
            <span className="diff-num">{d.shortLabel}</span>
            <span className="diff-label">{d.label}</span>
            <span className="diff-desc">{d.description}</span>
          </button>
        ))}
      </div>

      <div className="diff-bars">
        <span className="diff-bars-label">마디 수</span>
        <div className="diff-bars-options">
          {BAR_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              className={n === barCount ? 'bars-chip bars-chip-selected' : 'bars-chip'}
              onClick={() => setBarCount(n)}
              type="button"
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button className="diff-start" onClick={() => onStart(level, barCount)} type="button">
        연습 시작
      </button>
    </div>
  );
}
