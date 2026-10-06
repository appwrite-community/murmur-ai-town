import { useEffect, useState } from 'react';
import { loadResidentDetails } from '../lib/appwrite';
import { townActions, townIsResting, useTown } from '../lib/store';
import type { Memory, Relationship, Resident } from '../lib/types';
import { cameraState } from '../scene/CameraRig';
import { livePositions } from '../scene/Resident';
import { CloseIcon, EyeIcon, WhisperIcon } from './icons';
import { Portrait } from './Portrait';
import { selectAndFocus } from './Roster';

const MOOD_LABEL: Record<string, string> = {
  cheerful: 'Cheerful', content: 'Content', curious: 'Curious', excited: 'Excited', anxious: 'Anxious',
  grumpy: 'Grumpy', suspicious: 'Suspicious', sad: 'Sad', sleepy: 'Sleepy',
};

function doing(r: Resident, placeName: (id: string) => string, residents: Record<string, Resident>) {
  const at = placeName(r.place);
  switch (r.activity) {
    case 'move': return `Walking to ${at}`;
    case 'talk': return `Talking with ${residents[r.talkingTo ?? '']?.name.split(' ')[0] ?? 'someone'} at ${at}`;
    case 'work': return `Working at ${at}`;
    case 'rest': return r.place === r.home ? `Resting at home` : `Taking a break at ${at}`;
    case 'react': return `At ${at}`;
  }
}

function Hearts({ affinity }: { affinity: number }) {
  const full = Math.round(Math.abs(affinity) / 20);
  return (
    <span className={`hearts ${affinity < 0 ? 'cold' : ''}`} title={`${affinity}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.6 12 20 12 20z" fill={i < full ? (affinity < 0 ? '#7c8ea8' : '#ff6b8b') : '#efe2c8'} stroke="#3b2b2b" strokeWidth="2.4" /></svg>
      ))}
    </span>
  );
}

export function ResidentCard() {
  const selectedId = useTown((s) => s.selectedId);
  const resident = useTown((s) => (s.selectedId ? s.residents[s.selectedId] : null));
  const residents = useTown((s) => s.residents);
  const places = useTown((s) => s.places);
  const tick = useTown((s) => s.world?.tick);
  // Reload memories when something new happens to this resident.
  const latest = useTown((s) => s.events.find((e) => s.selectedId && e.residentIds?.includes(s.selectedId))?.$id);
  const [details, setDetails] = useState<{ memories: Memory[]; relationships: Relationship[] } | null>(null);
  const [following, setFollowing] = useState(false);
  // While the town rests, nobody answers whispers, so the button is disabled.
  const [resting, setResting] = useState(townIsResting());
  useEffect(() => {
    const t = setInterval(() => setResting(townIsResting()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let live = true;
    loadResidentDetails(selectedId).then((d) => live && setDetails(d)).catch(() => live && setDetails({ memories: [], relationships: [] }));
    return () => {
      live = false;
    };
  }, [selectedId, tick, latest]);

  useEffect(() => {
    setDetails(null);
    setFollowing(false);
  }, [selectedId]);

  useEffect(() => {
    if (following && selectedId) cameraState.follow = () => livePositions.get(selectedId);
    else cameraState.follow = null;
  }, [following, selectedId]);

  if (!resident) return null;
  const placeName = (id: string) => places[id]?.name ?? id;
  const friends = (details?.relationships ?? [])
    .map((rel) => ({ other: residents[rel.a === resident.$id ? rel.b : rel.a], affinity: rel.affinity }))
    .filter((f, i, all) => f.other && all.findIndex((g) => g.other?.$id === f.other.$id) === i)
    .sort((a, b) => Math.abs(b.affinity) - Math.abs(a.affinity))
    .slice(0, 3);

  return (
    <section className="panel card" style={{ ['--accent' as string]: resident.color }}>
      <button className="card-close" onClick={() => townActions.select(null)} aria-label="Close"><CloseIcon /></button>
      <header className="card-head">
        <Portrait resident={resident} size={72} />
        <div>
          <h2>{resident.name}</h2>
          <div className="card-job">{resident.job}</div>
          <span className={`mood mood-${resident.mood}`}>{MOOD_LABEL[resident.mood]}</span>
        </div>
      </header>
      <div className="card-doing">{doing(resident, placeName, residents)}</div>
      {resident.line && <div className="card-line">“{resident.line}”</div>}

      <h3>Remembers</h3>
      <ul className="memories">
        {!details && <li className="muted">Remembering…</li>}
        {details?.memories.length === 0 && <li className="muted">Nothing much yet.</li>}
        {details?.memories.slice(0, 3).map((m) => (
          <li key={m.$id} className={`memory memory-${m.kind}`}>
            {m.kind === 'whisper' && <span className="memory-tag">whisper</span>}
            {m.kind === 'heard' && m.fromResidentId && <span className="memory-tag">from {residents[m.fromResidentId]?.name.split(' ')[0]}</span>}
            {m.text}
          </li>
        ))}
      </ul>

      {friends.length > 0 && (
        <>
          <h3>Feelings</h3>
          <ul className="friends">
            {friends.map((f) => (
              <li key={f.other.$id}>
                <button onClick={() => selectAndFocus(f.other.$id)}>
                  <Portrait resident={f.other} size={26} ring={false} />
                  <span>{f.other.name.split(' ')[0]}</span>
                </button>
                <Hearts affinity={f.affinity} />
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="card-actions">
        <button
          className="btn btn-pink"
          disabled={resting}
          onClick={() => townActions.openWhisper(true)}
        >
          <WhisperIcon size={20} /> Whisper
        </button>
        <button className={`btn btn-cream ${following ? 'pressed' : ''}`} onClick={() => setFollowing((f) => !f)}>
          <EyeIcon /> {following ? 'Following' : 'Follow'}
        </button>
      </div>
      {resting && <p className="card-note">The town is resting. Whispers open again when it wakes up.</p>}
    </section>
  );
}
