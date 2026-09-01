import { useState } from 'react';
import { DifficultyScreen } from './components/DifficultyScreen';
import { PracticeScreen } from './components/PracticeScreen';
import type { Level } from './music/generator';

interface Session {
  level: Level;
  barCount: number;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return <DifficultyScreen onStart={(level, barCount) => setSession({ level, barCount })} />;
  }

  return (
    <PracticeScreen
      key={`${session.level}-${session.barCount}`}
      level={session.level}
      barCount={session.barCount}
      onBack={() => setSession(null)}
    />
  );
}

export default App;
