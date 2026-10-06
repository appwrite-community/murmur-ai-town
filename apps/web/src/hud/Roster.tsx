import { townActions, useTown } from '../lib/store';
import { livePositions } from '../scene/Resident';
import { cameraState, focusCamera } from '../scene/CameraRig';
import { EmoteIcon } from './icons';
import { Portrait } from './Portrait';

export function selectAndFocus(id: string) {
  townActions.select(id);
  const p = livePositions.get(id);
  if (p) focusCamera(p.x, p.z, Math.max(cameraState.zoomGoal, 46));
}

export function Roster() {
  const residents = useTown((s) => s.residents);
  const selectedId = useTown((s) => s.selectedId);
  const ids = Object.keys(residents).sort((a, b) => residents[a].name.localeCompare(residents[b].name));
  return (
    <div className="roster panel">
      {ids.map((id) => {
        const r = residents[id];
        const status = r.activity === 'talk' ? 'talk' : r.activity === 'rest' && r.place === r.home ? 'home' : null;
        return (
          <button key={id} className={`roster-item ${selectedId === id ? 'active' : ''}`} onClick={() => selectAndFocus(id)} aria-label={r.name}>
            <Portrait resident={r} size={46} />
            {status === 'talk' && <span className="roster-badge"><svg width="12" height="12" viewBox="0 0 12 12"><circle cx="3" cy="6" r="1.4" fill="#3b2b2b" /><circle cx="6" cy="6" r="1.4" fill="#3b2b2b" /><circle cx="9" cy="6" r="1.4" fill="#3b2b2b" /></svg></span>}
            {status === 'home' && <span className="roster-badge"><EmoteIcon emote="sleepy" size={13} /></span>}
            <span className="roster-name">{r.name.split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
}
