import type { Resident } from '../lib/types';

export function Portrait({ resident, size = 48, ring = true }: { resident: Resident; size?: number; ring?: boolean }) {
  return (
    <span
      className={`portrait ${ring ? 'portrait-ring' : ''}`}
      style={{ width: size, height: size, ['--accent' as string]: resident.color }}
    >
      <img src={`/portraits/${resident.character}.png`} alt="" draggable={false} />
    </span>
  );
}
