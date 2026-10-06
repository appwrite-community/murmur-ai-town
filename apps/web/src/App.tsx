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
    let unsubscribe: () => unknown = () => {};
    let cancelled = false;
    (async () => {
      try {
        const visitorId = await ensureVisitor();
        // Open the subscription before loading, and merge anything that arrives first.
        // Without Realtime the town still loads, it just does not move.
        try {
          unsubscribe = await subscribeToTown({
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
        } catch (err) {
          console.warn('Realtime is unavailable', err);
        }
        if (cancelled) {
          void unsubscribe();
          return;
        }
        const data = await loadTown();
        if (!cancelled) townActions.loaded(data, visitorId);
      } catch (err) {
        townActions.failed(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
      void unsubscribe();
    };
  }, []);

  // Development only: ?render=1 hides the HUD and the sky, for marketing renders.
  const render = import.meta.env.DEV && new URLSearchParams(location.search).has('render');
  return (
    <div className={`game ${render ? 'render-mode' : ''}`}>
      <div className="backdrop" ref={backdrop} />
      <Scene backdrop={backdrop} />
      {!render && <HUD />}
    </div>
  );
}
