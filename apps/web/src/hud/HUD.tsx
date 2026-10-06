import { useProgress } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { useTown } from '../lib/store';
import { Bubbles } from './Bubbles';
import { Clock } from './Clock';
import { Controls } from './Controls';
import { Crier } from './Crier';
import { ResidentCard } from './ResidentCard';
import { Roster } from './Roster';
import { WhisperDialog } from './WhisperDialog';

function LoadingScreen() {
  const { progress, active } = useProgress();
  const status = useTown((s) => s.status);
  const error = useTown((s) => s.error);
  const [gone, setGone] = useState(false);
  const done = status === 'ready' && !active && progress >= 100;

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setGone(true), 900);
    return () => clearTimeout(t);
  }, [done]);
  if (gone) return null;

  const pct = Math.round(status === 'ready' ? progress : Math.min(progress, 90));
  return (
    <div className={`loading ${done ? 'loading-out' : ''}`}>
      <div className="loading-card">
        <svg className="lantern" width="64" height="88" viewBox="0 0 64 88">
          <path d="M32 4v10" stroke="#3b2b2b" strokeWidth="5" strokeLinecap="round" />
          <path d="M18 16h28l-4 8H22z" fill="#c5824b" stroke="#3b2b2b" strokeWidth="4" strokeLinejoin="round" />
          <rect x="16" y="24" width="32" height="40" rx="8" fill="#ffd166" stroke="#3b2b2b" strokeWidth="4" />
          <path d="M32 34c5 6 5 12 0 18-5-6-5-12 0-18z" fill="#ff9a4d" />
          <path d="M18 64h28l4 10H14z" fill="#c5824b" stroke="#3b2b2b" strokeWidth="4" strokeLinejoin="round" />
        </svg>
        <h1 className="logo">Murmur</h1>
        <p className="tagline">a tiny town where every whisper travels</p>
        {error ? (
          <div className="loading-error">
            <strong>The town is out of reach.</strong>
            <span>{error}</span>
            <button className="btn btn-cream" onClick={() => location.reload()}>Try again</button>
          </div>
        ) : (
          <>
            <div className="progress"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
            <p className="loading-status">{status === 'ready' ? 'Lighting the lanterns…' : 'Waking up the residents…'}</p>
          </>
        )}
      </div>
    </div>
  );
}

export function HUD() {
  const ready = useTown((s) => s.status === 'ready');
  return (
    <div className="hud">
      {ready && (
        <>
          <Bubbles />
          <div className="hud-top-left">
            <Clock />
            <ResidentCard />
          </div>
          <Crier />
          <Roster />
          <Controls />
          <WhisperDialog />
        </>
      )}
      <LoadingScreen />
    </div>
  );
}
