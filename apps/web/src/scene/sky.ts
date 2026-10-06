// Day and night: colors and light levels for a minute of the day.
import * as THREE from 'three';
import { create } from 'zustand';

type Key = { m: number; top: string; bottom: string; sun: string; sunI: number; hemi: number; night: number };

// Keyframes over the day (minute of day). Colors blend between neighbors.
const KEYS: Key[] = [
  { m: 0, top: '#141634', bottom: '#2c2a58', sun: '#8fa6ff', sunI: 0.55, hemi: 0.42, night: 1 },
  { m: 300, top: '#1e2148', bottom: '#47396d', sun: '#9aa8ff', sunI: 0.55, hemi: 0.45, night: 1 },
  { m: 360, top: '#5a5f9e', bottom: '#f4a98a', sun: '#ffb38a', sunI: 1.4, hemi: 0.75, night: 0.55 },
  { m: 450, top: '#7fc3ec', bottom: '#fde3c4', sun: '#ffe2b8', sunI: 3.0, hemi: 0.75, night: 0 },
  { m: 720, top: '#6ec2f0', bottom: '#d9f1ff', sun: '#fff6e6', sunI: 3.3, hemi: 0.8, night: 0 },
  { m: 1020, top: '#7ab7e6', bottom: '#ffe0b3', sun: '#ffd9a8', sunI: 3.0, hemi: 0.75, night: 0 },
  { m: 1110, top: '#6d5fa8', bottom: '#ff9a76', sun: '#ff9466', sunI: 1.6, hemi: 0.8, night: 0.35 },
  { m: 1200, top: '#2b2a5e', bottom: '#8a4f7d', sun: '#c08cff', sunI: 0.8, hemi: 0.55, night: 0.85 },
  { m: 1290, top: '#161838', bottom: '#33305f', sun: '#8fa6ff', sunI: 0.55, hemi: 0.42, night: 1 },
  { m: 1440, top: '#141634', bottom: '#2c2a58', sun: '#8fa6ff', sunI: 0.55, hemi: 0.42, night: 1 },
];

const ca = new THREE.Color();
const cb = new THREE.Color();
const mix = (a: string, b: string, t: number) => '#' + ca.set(a).lerp(cb.set(b), t).getHexString();

export type SkyState = {
  minute: number;
  top: string;
  bottom: string;
  sun: string;
  sunIntensity: number;
  hemi: number;
  /** 0 at full day, 1 at full night. Lamps and windows follow it. */
  night: number;
  /** Sun (or moon) direction. */
  sunDir: [number, number, number];
};

export function skyAt(minute: number): SkyState {
  const m = ((minute % 1440) + 1440) % 1440;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].m <= m) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = (m - a.m) / (b.m - a.m);
  const s = t * t * (3 - 2 * t);
  const night = a.night + (b.night - a.night) * s;
  // The sun travels east to west from 6:00 to 19:00. At night a moon takes over from the west.
  const dayT = Math.min(Math.max((m - 360) / (1140 - 360), 0), 1);
  const angle = night > 0.6 ? 0.8 : Math.PI * (0.12 + dayT * 0.76);
  const sunDir: [number, number, number] = [Math.cos(angle) * 24, 16 + Math.sin(angle) * 10, -14];
  return {
    minute: m,
    top: mix(a.top, b.top, s),
    bottom: mix(a.bottom, b.bottom, s),
    sun: mix(a.sun, b.sun, s),
    sunIntensity: a.sunI + (b.sunI - a.sunI) * s,
    hemi: a.hemi + (b.hemi - a.hemi) * s,
    night,
    sunDir,
  };
}

/** Updated every frame by <DayNight>, read by lamps, windows, and the HUD. */
export const useSky = create<SkyState>(() => skyAt(7 * 60));
