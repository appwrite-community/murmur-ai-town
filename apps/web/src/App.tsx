import { useEffect, useRef } from 'react';
import { HUD } from './hud/HUD';
import { ensureVisitor, loadTown, subscribeToTown } from './lib/appwrite';
import { playConversation, say } from './lib/speech';
import { townActions, useTown } from './lib/store';
import type { Line } from './lib/types';
import { Scene } from './scene/Scene';

export function App() {
  const backdrop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;
    (async () => {
      try {
        const visitorId = await ensureVisitor();
        // Subscribe first, so no tick is missed between loading and listening.
        unsubscribe = subscribeToTown({
          world: townActions.world,
          resident: (row) => {
            const before = useTown.getState().residents[row.$id];
            townActions.resident(row);
            if (row.line && row.activity !== 'talk' && row.line !== before?.line) {
              // Spread lines over the tick, so a few residents speak at a time.
              const line = row.line;
              setTimeout(() => say(row.$id, line, 5200, row.emote), 2000 + Math.random() * 38_000);
            }
          },
          event: (row) => {
            townActions.event(row);
            if ((row.kind === 'talk' || row.kind === 'whisper') && row.lines) {
              playConversation(JSON.parse(row.lines) as Line[], row.kind === 'talk' ? 1200 : 0);
            }
          },
          rumor: townActions.rumor,
          whisper: townActions.whisper,
        });
        const data = await loadTown();
        if (!cancelled) townActions.loaded(data, visitorId);
      } catch (err) {
        townActions.failed(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <div className="game">
      <div className="backdrop" ref={backdrop} />
      <Scene backdrop={backdrop} />
      <HUD />
    </div>
  );
}
