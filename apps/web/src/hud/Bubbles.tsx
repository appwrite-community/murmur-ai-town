// Speech bubbles, emotes, and name tags in one screen-space layer.
// Every frame, labels are projected above their resident and pushed apart so
// they never overlap. A tail always points back at the speaker.
import { useCallback } from 'react';
import * as THREE from 'three';
import { useSpeech } from '../lib/speech';
import { useTown } from '../lib/store';
import type { Emote } from '../lib/types';
import { EmoteIcon } from './icons';

type Entry = { el: HTMLDivElement; tail: HTMLDivElement; residentId: string; priority: number; w: number; h: number };

const entries = new Map<string, Entry>();
const HEAD_HEIGHT = 1.2;
const GAP = 6;
let frame = 0;
let bounds = { minLeft: 0, maxRight: Infinity };

/** Called by the scene every frame with the current camera. */
export function layoutLabels(
  camera: THREE.Camera,
  width: number,
  height: number,
  positions: Map<string, THREE.Vector3>,
  visible: Map<string, number>,
) {
  const v = new THREE.Vector3();
  const items: { e: Entry; x: number; y: number; w: number; h: number }[] = [];
  for (const e of entries.values()) {
    const p = positions.get(e.residentId);
    const shown = (visible.get(e.residentId) ?? 1) > 0.3;
    if (!p || !shown) {
      e.el.style.visibility = 'hidden';
      continue;
    }
    v.set(p.x, p.y + HEAD_HEIGHT * (visible.get(e.residentId) ?? 1), p.z).project(camera);
    const x = (v.x * 0.5 + 0.5) * width;
    const y = (-v.y * 0.5 + 0.5) * height;
    items.push({ e, x, y, w: e.w, h: e.h });
  }

  // Keep labels clear of the HUD panels on the left and right. Reading layout is
  // expensive, so panel bounds refresh every 20 frames.
  if (frame++ % 20 === 0) {
    const crier = document.querySelector('.crier')?.getBoundingClientRect();
    const leftPanel = document.querySelector('.hud-top-left')?.getBoundingClientRect();
    bounds = {
      maxRight: (crier?.left ?? width) - 10,
      minLeft: (leftPanel && leftPanel.height > 160 ? leftPanel.right : 0) + 10,
    };
  }
  const { minLeft, maxRight } = bounds;

  // Residents lower on screen are closer to the camera: place their labels first.
  items.sort((a, b) => b.e.priority - a.e.priority || b.y - a.y);
  const placed: { l: number; r: number; t: number; b: number }[] = [];
  for (const it of items) {
    let bottom = it.y - 14;
    const l = Math.max(minLeft, Math.min(it.x - it.w / 2, maxRight - it.w));
    const r = l + it.w;
    for (let guard = 0; guard < 12; guard++) {
      const t = bottom - it.h;
      const hit = placed.find((p) => l < p.r + GAP && r > p.l - GAP && t < p.b + GAP && bottom > p.t - GAP);
      if (!hit) break;
      bottom = hit.t - GAP;
    }
    placed.push({ l, r, t: bottom - it.h, b: bottom });
    it.e.el.style.visibility = 'visible';
    it.e.el.style.transform = `translate(${Math.round(l)}px, ${Math.round(bottom - it.h)}px)`;
    // The tail runs from the bubble's bottom edge to the resident's head.
    const dx = it.x - (l + it.w / 2);
    const dy = it.y - bottom;
    const length = Math.max(Math.hypot(dx, dy) - 2, 0);
    it.e.tail.style.height = `${length}px`;
    it.e.tail.style.transform = `rotate(${Math.atan2(-dx, dy)}rad)`;
  }
}

function useRegister(id: string, residentId: string, priority: number) {
  return useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) {
        entries.delete(id);
        return;
      }
      el.style.visibility = 'hidden';
      // A label's content never changes (a new line is a new label), so measure it once.
      entries.set(id, { el, tail: el.querySelector('.label-tail') as HTMLDivElement, residentId, priority, w: el.offsetWidth, h: el.offsetHeight });
    },
    [id, residentId, priority],
  );
}

function Label({ id, residentId, priority, className, accent, children }: { id: string; residentId: string; priority: number; className: string; accent: string; children: React.ReactNode }) {
  const ref = useRegister(id, residentId, priority);
  return (
    <div ref={ref} className={`label ${className}`} style={{ ['--accent' as string]: accent }}>
      <div className="label-tail" />
      <div className="label-body">{children}</div>
    </div>
  );
}

export function Bubbles() {
  const bubbles = useSpeech((s) => s.bubbles);
  const residents = useTown((s) => s.residents);
  const selectedId = useTown((s) => s.selectedId);
  const hoveredId = useTown((s) => s.hoveredId);

  return (
    <div className="labels">
      {Object.entries(residents).map(([id, r]) => {
        const bubble = bubbles[id];
        if (bubble) {
          return (
            <Label key={`b-${id}-${bubble.id}`} id={`b-${id}`} residentId={id} priority={2} className="bubble" accent={r.color}>
              {bubble.emote && <span className="bubble-emote"><EmoteIcon emote={bubble.emote} size={18} /></span>}
              <span><b style={{ color: r.color }}>{r.name.split(' ')[0]}</b> {bubble.text}</span>
            </Label>
          );
        }
        if (id === selectedId || id === hoveredId) {
          return (
            <Label key={`t-${id}`} id={`t-${id}`} residentId={id} priority={3} className="name-tag" accent={r.color}>
              {r.name.split(' ')[0]}
              <span>{r.job}</span>
            </Label>
          );
        }
        if (r.emote && r.activity === 'react') {
          return (
            <Label key={`e-${id}-${r.emote}`} id={`e-${id}`} residentId={id} priority={1} className="emote-pop" accent={r.color}>
              <EmoteIcon emote={r.emote as Emote} />
            </Label>
          );
        }
        return null;
      })}
    </div>
  );
}
