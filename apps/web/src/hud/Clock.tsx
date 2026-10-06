import { useEffect, useState } from 'react';
import { TICK_SECONDS, useTown } from '../lib/store';
import { useSky } from '../scene/sky';
import { MoonIcon, SunIcon } from './icons';

function period(minute: number) {
  if (minute < 300 || minute >= 1320) return 'Night';
  if (minute < 420) return 'Dawn';
  if (minute < 720) return 'Morning';
  if (minute < 1020) return 'Afternoon';
  if (minute < 1170) return 'Evening';
  return 'Dusk';
}

export function Clock() {
  const minute = useSky((s) => s.minute);
  const night = useSky((s) => s.night);
  const world = useTown((s) => s.world);
  const tickArrivedAt = useTown((s) => s.tickArrivedAt);
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(t);
  }, []);

  const h = Math.floor(minute / 60);
  const m = Math.floor(minute % 60);
  const label = `${String(h).padStart(2, '0')}:${String(m - (m % 5)).padStart(2, '0')}`;
  const progress = Math.min((now - tickArrivedAt) / (TICK_SECONDS * 1000), 1);
  const late = (now - tickArrivedAt) / 1000 > TICK_SECONDS * 2.5;
  const dial = (minute / 1440) * 360;

  return (
    <div className="panel clock">
      <div className="dial" style={{ ['--turn' as string]: `${dial}deg` }}>
        <div className="dial-face" />
        <div className="dial-icon">{night > 0.5 ? <MoonIcon size={30} /> : <SunIcon size={30} />}</div>
      </div>
      <div className="clock-text">
        <div className="clock-day">Day {world?.day ?? 1} · {period(minute)}</div>
        <div className="clock-time">{label}</div>
        <div className="clock-tick" title="The world moves forward one tick every minute">
          <svg width="16" height="16" viewBox="0 0 20 20" className="tick-ring">
            <circle cx="10" cy="10" r="7.5" fill="none" stroke="#e9d3a5" strokeWidth="3.4" />
            <circle cx="10" cy="10" r="7.5" fill="none" stroke={late ? '#c9a46a' : '#6ab04c'} strokeWidth="3.4" strokeDasharray={`${progress * 47.1} 47.1`} transform="rotate(-90 10 10)" strokeLinecap="round" />
          </svg>
          {late ? 'Town is resting' : `Tick ${world?.tick ?? 0}`}
        </div>
      </div>
    </div>
  );
}
