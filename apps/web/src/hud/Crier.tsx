import { useEffect, useState } from 'react';
import { loadRumorTrail } from '../lib/appwrite';
import { townActions, TICK_MINUTES, useTown } from '../lib/store';
import type { Line, Memory, Resident, Rumor, TownEvent } from '../lib/types';
import { ScrollIcon, WhisperIcon } from './icons';
import { Portrait } from './Portrait';
import { selectAndFocus } from './Roster';

function timeOf(tick: number) {
  const world = useTown.getState().world;
  if (!world) return '';
  const m = (((world.minuteOfDay - (world.tick - tick) * TICK_MINUTES) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function Quote({ text }: { text: string }) {
  // Event text marks quoted rumors with « ». Show them as a styled quote.
  const match = text.match(/^(.*?)«(.*)»(.*)$/);
  if (!match) return <>{text}</>;
  return (
    <>
      {match[1]}
      <q>{match[2]}</q>
      {match[3]}
    </>
  );
}

function EventItem({ event, residents }: { event: TownEvent; residents: Record<string, Resident> }) {
  const people = (event.residentIds ?? []).map((id) => residents[id]).filter(Boolean);
  const lines: Line[] = event.lines ? JSON.parse(event.lines) : [];
  if (event.kind === 'system') return <li className="feed-system">{event.text}</li>;
  return (
    <li className={`feed-item feed-${event.kind}`}>
      <div className="feed-avatars">
        {people.slice(0, 2).map((p) => (
          <button key={p.$id} onClick={() => selectAndFocus(p.$id)} aria-label={p.name}>
            <Portrait resident={p} size={30} />
          </button>
        ))}
        {event.kind === 'whisper' && <span className="feed-whisper-icon"><WhisperIcon size={18} /></span>}
      </div>
      <div className="feed-body">
        <div className="feed-text"><Quote text={event.text} /></div>
        {event.kind === 'talk' && lines.length > 0 && (
          <ul className="feed-lines">
            {lines.map((line, i) => (
              <li key={i}><b style={{ color: residents[line.speaker]?.color }}>{residents[line.speaker]?.name.split(' ')[0]}</b> {line.text}</li>
            ))}
          </ul>
        )}
        {event.kind === 'whisper' && lines[0] && (
          <div className="feed-reply">{residents[lines[0].speaker]?.name.split(' ')[0]}: “{lines[0].text}”</div>
        )}
      </div>
      <span className="feed-time">{timeOf(event.tick)}</span>
    </li>
  );
}

function RumorTrail({ rumor, residents }: { rumor: Rumor; residents: Record<string, Resident> }) {
  const [trail, setTrail] = useState<Memory[] | null>(null);
  const tick = useTown((s) => s.world?.tick);
  useEffect(() => {
    loadRumorTrail(rumor.$id).then(setTrail).catch(() => setTrail([]));
  }, [rumor.$id, rumor.carriers, tick]);
  if (!trail) return <div className="trail-loading">Following the rumor…</div>;
  return (
    <ol className="trail">
      {trail.map((m) => {
        const to = residents[m.residentId];
        const from = m.fromResidentId ? residents[m.fromResidentId] : null;
        if (!to) return null;
        return (
          <li key={m.$id}>
            <span className="trail-who">
              {from ? <><b style={{ color: from.color }}>{from.name.split(' ')[0]}</b> told </> : m.kind === 'whisper' ? <>A visitor whispered to </> : <>Known by </>}
              <b style={{ color: to.color }}>{to.name.split(' ')[0]}</b>
            </span>
            <span className="feed-time">{timeOf(m.tick)}</span>
            {from && <q className="trail-text">{m.text}</q>}
          </li>
        );
      })}
    </ol>
  );
}

export function Crier() {
  const [tab, setTab] = useState<'news' | 'rumors'>('news');
  const [walks, setWalks] = useState(false);
  const events = useTown((s) => s.events);
  const residents = useTown((s) => s.residents);
  const rumors = useTown((s) => s.rumors);
  const focused = useTown((s) => s.focusedRumor);
  const list = events.filter((e) => walks || e.kind !== 'move');
  const rumorList = Object.values(rumors).sort((a, b) => b.tick - a.tick || Number(b.$sequence) - Number(a.$sequence));
  const total = Object.keys(residents).length;

  return (
    <aside className="crier panel">
      <header className="crier-head">
        <ScrollIcon size={26} />
        <h2>Town Crier</h2>
      </header>
      <div className="tabs">
        <button className={tab === 'news' ? 'on' : ''} onClick={() => setTab('news')}>News</button>
        <button className={tab === 'rumors' ? 'on' : ''} onClick={() => setTab('rumors')}>
          Rumors <span className="count">{rumorList.length}</span>
        </button>
      </div>
      {tab === 'news' ? (
        <>
          <ul className="feed">
            {list.length === 0 && <li className="feed-system">The town is quiet. News arrives every tick.</li>}
            {list.map((e) => <EventItem key={e.$id} event={e} residents={residents} />)}
          </ul>
          <label className="toggle">
            <input type="checkbox" checked={walks} onChange={(e) => setWalks(e.target.checked)} />
            <span className="toggle-box" /> Show walks
          </label>
        </>
      ) : (
        <ul className="feed rumors">
          {rumorList.length === 0 && <li className="feed-system">No rumors yet. Click a resident and whisper one.</li>}
          {rumorList.map((r) => {
            const origin = residents[r.originResidentId];
            const open = focused === r.$id;
            return (
              <li key={r.$id} className={`rumor ${open ? 'open' : ''}`}>
                <button className="rumor-head" onClick={() => townActions.focusRumor(open ? null : r.$id)}>
                  <q>{r.text}</q>
                  <span className="rumor-meta">
                    {origin && <>first heard by <b style={{ color: origin.color }}>{origin.name.split(' ')[0]}</b> · </>}
                    <span className="carriers">
                      <span className="carriers-bar"><span style={{ width: `${(r.carriers / total) * 100}%` }} /></span>
                      {r.carriers} of {total} know it
                    </span>
                  </span>
                </button>
                {open && <RumorTrail rumor={r} residents={residents} />}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
