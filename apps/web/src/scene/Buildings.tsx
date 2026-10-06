// Composes each building from Kenney Fantasy Town Kit walls and roofs.
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BUILDINGS, type BuildingDef, type Side } from '../town/layout';
import { KitBatch, type Placement } from './Kit';
import { useSky } from './sky';

const HALF_PI = Math.PI / 2;
const SIDE_ROTATION: Record<Side, number> = { e: 0, n: HALF_PI, w: Math.PI, s: -HALF_PI };

type Glow = { p: [number, number, number]; ry: number };

function compose(b: BuildingDef) {
  const pieces: Placement[] = [];
  const glows: Glow[] = [];
  const x0 = b.x - b.w / 2 + 0.5;
  const z0 = b.z - b.d / 2 + 0.5;

  const edges: { side: Side; cells: [number, number][] }[] = [
    { side: 'n', cells: Array.from({ length: b.w }, (_, i) => [x0 + i, z0] as [number, number]) },
    { side: 's', cells: Array.from({ length: b.w }, (_, i) => [x0 + i, z0 + b.d - 1] as [number, number]) },
    { side: 'w', cells: Array.from({ length: b.d }, (_, j) => [x0, z0 + j] as [number, number]) },
    { side: 'e', cells: Array.from({ length: b.d }, (_, j) => [x0 + b.w - 1, z0 + j] as [number, number]) },
  ];

  for (let floor = 0; floor < b.floors; floor++) {
    const upperWood = floor > 0 && b.upper === 'wood';
    for (const { side, cells } of edges) {
      const ry = SIDE_ROTATION[side];
      const doorIndex = Math.floor((cells.length - 1) / 2);
      cells.forEach(([cx, cz], index) => {
        let model: string;
        const isDoor = floor === 0 && side === b.door && index === doorIndex;
        const windowSpot = (index + floor) % 2 === 0 || cells.length <= 2;
        if (isDoor) model = 'town/wall-door';
        else if (floor === 0) model = windowSpot ? 'town/wall-window-shutters' : 'town/wall';
        else if (upperWood) model = windowSpot ? 'town/wall-wood-window-glass' : 'town/wall-wood';
        else model = windowSpot ? 'town/wall-window-glass' : 'town/wall';
        pieces.push({ model, p: [cx, floor, cz], ry });
        if (!isDoor && windowSpot) {
          // A warm pane just outside the window, visible at night.
          const local = new THREE.Vector3(0.515, floor + 0.56, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
          glows.push({ p: [cx + local.x, local.y, cz + local.z], ry });
        }
      });
    }
  }

  // Gable roof. The ridge runs along the longer side.
  const alongX = b.w >= b.d;
  const length = alongX ? b.w : b.d;
  const depth = alongX ? b.d : b.w;
  const turn = alongX ? 0 : HALF_PI;
  const variant = `roof-${b.roof}`;
  const rise = Math.min(depth / 2, 1.6) * 0.95;
  for (let i = 0; i < length; i++) {
    const t = -length / 2 + 0.5 + i;
    for (const sideSign of [-1, 1]) {
      const model = i === 0 ? (sideSign < 0 ? 'town/roof-right' : 'town/roof-left') : i === length - 1 ? (sideSign < 0 ? 'town/roof-left' : 'town/roof-right') : 'town/roof';
      const local = new THREE.Vector3(t, b.floors, (sideSign * depth) / 4).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
      pieces.push({
        model,
        variant,
        p: [b.x + local.x, local.y, b.z + local.z],
        ry: (sideSign < 0 ? -HALF_PI : HALF_PI) + turn,
        s: [depth / 2, rise, 1],
      });
    }
  }
  if (b.chimney) {
    const local = new THREE.Vector3(length / 2 - 1, b.floors + rise * 0.35, depth / 4).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
    pieces.push({ model: 'town/chimney', p: [b.x + local.x, local.y, b.z + local.z], s: 1 });
  }
  return { pieces, glows };
}

function WindowGlows({ glows }: { glows: Glow[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffcf70', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    [],
  );
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    glows.forEach((g, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), g.ry + HALF_PI);
      m.compose(new THREE.Vector3(...g.p), q, new THREE.Vector3(1, 1, 1));
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [glows]);
  useFrame(() => {
    material.opacity = useSky.getState().night * 0.95;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, material, glows.length]}>
      <planeGeometry args={[0.3, 0.34]} />
    </instancedMesh>
  );
}

export function Buildings() {
  const { pieces, glows } = useMemo(() => {
    const all = BUILDINGS.map(compose);
    return { pieces: all.flatMap((a) => a.pieces), glows: all.flatMap((a) => a.glows) };
  }, []);
  return (
    <group>
      <KitBatch placements={pieces} />
      <WindowGlows glows={glows} />
    </group>
  );
}
