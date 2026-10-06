// The floating island: grass, cliffs, paths, the pond, the square, the garden, trees, and lamps.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BUILDINGS, GARDEN, ISLAND, PATH_EDGES, PATH_NODES, POND, type Vec2 } from '../town/layout';
import { KitBatch, type Placement } from './Kit';
import { useSky } from './sky';

// Deterministic random numbers, so the town looks the same for every visitor.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function islandShape() {
  const shape = new THREE.Shape();
  const n = 96;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wobble = 1 + 0.035 * Math.sin(a * 5 + 1.3) + 0.025 * Math.sin(a * 9 + 0.4);
    // A superellipse: a rounded square island.
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = Math.sign(c) * Math.pow(Math.abs(c), 0.7) * ISLAND.rx * wobble;
    const y = Math.sign(s) * Math.pow(Math.abs(s), 0.7) * ISLAND.rz * wobble;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

function Ground() {
  const { top, cliff, base } = useMemo(() => {
    const shape = islandShape();
    const top = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.35, bevelSegments: 3, curveSegments: 1 });
    top.rotateX(Math.PI / 2);
    top.translate(0, -0.25, 0);
    const cliff = new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false, curveSegments: 1 });
    cliff.rotateX(Math.PI / 2);
    cliff.scale(0.985, 1, 0.985);
    cliff.translate(0, -0.7, 0);
    const base = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 1 });
    base.rotateX(Math.PI / 2);
    base.scale(0.9, 1, 0.9);
    base.translate(0, -3.1, 0);
    return { top, cliff, base };
  }, []);
  return (
    <group>
      <mesh geometry={top} receiveShadow>
        <meshStandardMaterial attach="material-0" color="#8fcb62" roughness={1} />
        <meshStandardMaterial attach="material-1" color="#78b452" roughness={1} />
      </mesh>
      <mesh geometry={cliff}>
        <meshStandardMaterial attach="material-0" color="#b57b4c" roughness={1} />
        <meshStandardMaterial attach="material-1" color="#b57b4c" roughness={1} />
      </mesh>
      <mesh geometry={base}>
        <meshStandardMaterial attach="material-0" color="#8a5a3b" roughness={1} />
        <meshStandardMaterial attach="material-1" color="#8a5a3b" roughness={1} />
      </mesh>
    </group>
  );
}

/** Sandy paths: a flat ribbon per edge and a disc at every node. */
function Paths() {
  const geometry = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    const width = 1.15;
    for (const [a, b] of PATH_EDGES) {
      const [ax, az] = PATH_NODES[a];
      const [bx, bz] = PATH_NODES[b];
      const len = Math.hypot(bx - ax, bz - az);
      const g = new THREE.PlaneGeometry(len, width);
      g.rotateX(-Math.PI / 2);
      g.rotateY(-Math.atan2(bz - az, bx - ax));
      g.translate((ax + bx) / 2, 0, (az + bz) / 2);
      geos.push(g);
    }
    for (const [x, z] of Object.values(PATH_NODES)) {
      const g = new THREE.CircleGeometry(width / 2, 20);
      g.rotateX(-Math.PI / 2);
      g.translate(x, 0, z);
      geos.push(g);
    }
    return mergeGeometries(geos);
  }, []);
  return (
    <mesh geometry={geometry} position-y={0.012} receiveShadow>
      <meshStandardMaterial color="#ead39f" roughness={1} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  );
}

function mergeGeometries(list: THREE.BufferGeometry[]) {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const g of list) {
    const ng = g.index ? g.toNonIndexed() : g;
    positions.push(...(ng.getAttribute('position').array as Float32Array));
    normals.push(...(ng.getAttribute('normal').array as Float32Array));
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return merged;
}

function Pond() {
  const water = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (water.current) water.current.emissiveIntensity = 0.12 + Math.sin(clock.elapsedTime * 0.8) * 0.04;
  });
  return (
    <group position={[POND.x, 0, POND.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} scale={[POND.rx + 0.5, POND.rz + 0.5, 1]} receiveShadow>
        <circleGeometry args={[1, 48]} />
        <meshStandardMaterial color="#d9c48f" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.04} scale={[POND.rx, POND.rz, 1]} receiveShadow>
        <circleGeometry args={[1, 48]} />
        <meshStandardMaterial ref={water} color="#58b8d6" emissive="#2a6f9a" roughness={0.15} metalness={0.05} />
      </mesh>
    </group>
  );
}

function Square() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.018} receiveShadow>
        <circleGeometry args={[3.9, 48]} />
        <meshStandardMaterial color="#e3c993" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.022} receiveShadow>
        <ringGeometry args={[3.55, 3.9, 48]} />
        <meshStandardMaterial color="#cdb07a" roughness={1} />
      </mesh>
    </group>
  );
}

const LAMP_SPOTS: Vec2[] = [
  [2.6, -2.6], [-2.6, -2.6], [2.6, 2.6], [-2.6, 2.6], [-6, -2.6], [6, -2.6], [-1.4, 6.2], [1.6, -5.4], [-10.4, -4.4], [10.6, 4.8],
];

function Lamps() {
  const lights = useRef<THREE.PointLight[]>([]);
  useFrame(() => {
    const night = useSky.getState().night;
    for (const l of lights.current) if (l) l.intensity = night * 6;
  });
  return (
    <group>
      {LAMP_SPOTS.slice(0, 6).map(([x, z], i) => (
        <pointLight key={i} ref={(l) => { if (l) lights.current[i] = l; }} position={[x, 1.9, z]} color="#ffb357" distance={7} decay={1.6} intensity={0} />
      ))}
      <LampGlows />
    </group>
  );
}

function LampGlows() {
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd58a', transparent: true, opacity: 0, toneMapped: false }), []);
  useFrame(() => {
    material.opacity = 0.25 + useSky.getState().night * 0.75;
  });
  return (
    <group>
      {LAMP_SPOTS.map(([x, z], i) => (
        <mesh key={i} position={[x, 1.78, z]} material={material}>
          <sphereGeometry args={[0.09, 12, 12]} />
        </mesh>
      ))}
    </group>
  );
}

function usePlacements() {
  return useMemo(() => {
    const r = rng(7);
    const out: Placement[] = [];
    const occupied = (x: number, z: number, pad = 1.2) => {
      for (const b of BUILDINGS) if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return true;
      for (const [a, c] of PATH_EDGES) {
        const [ax, az] = PATH_NODES[a];
        const [bx, bz] = PATH_NODES[c];
        const dx = bx - ax;
        const dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
        if (Math.hypot(x - (ax + t * dx), z - (az + t * dz)) < 1.1) return true;
      }
      if (Math.hypot(x, z) < 4.3) return true;
      if (((x - POND.x) / (POND.rx + 1)) ** 2 + ((z - POND.z) / (POND.rz + 1)) ** 2 < 1) return true;
      if (Math.abs(x - GARDEN.x) < GARDEN.w / 2 + 0.8 && Math.abs(z - GARDEN.z) < GARDEN.d / 2 + 0.8) return true;
      return false;
    };
    const inside = (x: number, z: number, margin: number) => (Math.abs(x) / (ISLAND.rx - margin)) ** 2.6 + (Math.abs(z) / (ISLAND.rz - margin)) ** 2.6 < 1;

    // Trees: denser toward the edge of the island.
    const trees = ['nature/tree_oak', 'nature/tree_default', 'nature/tree_fat', 'nature/tree_detailed', 'nature/tree_pineRoundA', 'nature/tree_pineRoundC', 'nature/tree_oak_fall', 'nature/tree_simple'];
    for (let i = 0; i < 900 && out.length < 60; i++) {
      const x = (r() * 2 - 1) * ISLAND.rx;
      const z = (r() * 2 - 1) * ISLAND.rz;
      if (!inside(x, z, 1.4) || occupied(x, z, 1.6)) continue;
      const edge = (Math.abs(x) / ISLAND.rx) ** 2 + (Math.abs(z) / ISLAND.rz) ** 2;
      if (r() > edge * edge * 1.1) continue;
      if (out.some((p) => Math.hypot(p.p[0] - x, p.p[2] - z) < 1.9)) continue;
      out.push({ model: trees[Math.floor(r() * trees.length)], p: [x, 0, z], ry: r() * Math.PI * 2, s: 1.6 + r() * 0.8 });
    }
    // Flowers, bushes, rocks, and grass tufts.
    const small = ['nature/flower_redA', 'nature/flower_yellowA', 'nature/flower_purpleA', 'nature/flower_redB', 'nature/flower_yellowB', 'nature/grass', 'nature/grass_large', 'nature/plant_bush', 'nature/plant_bushSmall', 'nature/rock_smallA', 'nature/mushroom_red', 'nature/grass'];
    for (let i = 0; i < 1600 && out.length < 300; i++) {
      const x = (r() * 2 - 1) * ISLAND.rx;
      const z = (r() * 2 - 1) * ISLAND.rz;
      if (!inside(x, z, 0.8) || occupied(x, z, 0.5)) continue;
      out.push({ model: small[Math.floor(r() * small.length)], p: [x, 0, z], ry: r() * Math.PI * 2, s: 1.3 + r() * 0.7 });
    }

    // The square: fountain, stalls, benches.
    out.push({ model: 'town/fountain-round-detail', p: [0, 0, 0], s: 1.5 });
    out.push({ model: 'town/stall-red', p: [-2.2, 0, -2.9], ry: Math.PI * 0.15, s: 1.2 });
    out.push({ model: 'town/stall-green', p: [2.2, 0, -2.9], ry: -Math.PI * 0.15, s: 1.2 });
    out.push({ model: 'town/stall-bench', p: [2.9, 0, 1.6], ry: -Math.PI / 2 });
    out.push({ model: 'town/stall-bench', p: [-2.9, 0, 1.6], ry: Math.PI / 2 });
    out.push({ model: 'town/cart', p: [-3.4, 0, -0.6], ry: 0.6 });
    for (const [x, z] of LAMP_SPOTS) out.push({ model: 'town/lantern', p: [x, 0, z], s: 1.25 });

    // Cafe terrace and bakery bits.
    out.push({ model: 'town/stall-stool', p: [9.6, 0, -3.1] }, { model: 'town/stall-stool', p: [6.5, 0, -3.2] });
    out.push({ model: 'town/banner-red', p: [-6.4, 0, -4.4] }, { model: 'town/banner-green', p: [6.4, 0, -4.4] });
    out.push({ model: 'nature/log_stack', p: [13.8, 0, 5.2], ry: 0.3, s: 1.2 }, { model: 'town/planks', p: [10.4, 0.01, 5.2], ry: 0.2 });
    out.push({ model: 'town/wheel', p: [13.6, 0, 1.0], ry: 1.2 });

    // The pond: dock, lilies, reeds, and a canoe.
    for (let i = 0; i < 3; i++) out.push({ model: 'town/planks', p: [POND.x + POND.rx - 0.2 - i * 0.98, 0.06, POND.z - 0.6], s: [1, 1, 1.05] });
    out.push({ model: 'town/poles', p: [POND.x + POND.rx - 2.6, 0, POND.z - 1.1], s: 0.6 });
    out.push({ model: 'nature/canoe', p: [POND.x - 1.6, 0.05, POND.z + 0.5], ry: 0.8, s: 1.3 });
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2;
      const d = 0.4 + r() * 0.5;
      out.push({ model: r() > 0.5 ? 'nature/lily_large' : 'nature/lily_small', p: [POND.x + Math.cos(a) * POND.rx * d, 0.05, POND.z + Math.sin(a) * POND.rz * d], ry: r() * 6, s: 1.4 });
    }
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      if (a > 5.2 && a < 6.0) continue; // the dock
      out.push({ model: i % 3 ? 'nature/rock_smallA' : 'nature/grass_large', p: [POND.x + Math.cos(a) * (POND.rx + 0.35), 0, POND.z + Math.sin(a) * (POND.rz + 0.35)], ry: r() * 6, s: 1.2 + r() * 0.6 });
    }

    // The garden: crop rows inside a fence.
    const crops = ['nature/crop_pumpkin', 'nature/crop_carrot', 'nature/crops_leafsStageB', 'nature/crops_cornStageC', 'nature/crop_turnip', 'nature/crops_wheatStageB'];
    for (let row = 0; row < GARDEN.d; row++) {
      for (let col = 0; col < GARDEN.w; col++) {
        const x = GARDEN.x - GARDEN.w / 2 + 0.5 + col;
        const z = GARDEN.z - GARDEN.d / 2 + 0.5 + row;
        out.push({ model: 'nature/crops_dirtRow', p: [x, 0.01, z], s: 1 });
        out.push({ model: crops[(row * 2 + col) % crops.length], p: [x, 0.05, z], ry: r() * 0.4, s: 1.7 });
      }
    }
    for (let col = 0; col < GARDEN.w; col++) {
      const x = GARDEN.x - GARDEN.w / 2 + 0.5 + col;
      out.push({ model: 'nature/fence_simple', p: [x, 0, GARDEN.z + GARDEN.d / 2 + 0.1], s: 1 });
      if (col !== 1) out.push({ model: 'nature/fence_simple', p: [x, 0, GARDEN.z - GARDEN.d / 2 - 0.1], s: 1 });
    }
    out.push({ model: 'nature/fence_gate', p: [GARDEN.x - GARDEN.w / 2 + 1.5, 0, GARDEN.z - GARDEN.d / 2 - 0.1] });

    return out;
  }, []);
}

export function Island() {
  const placements = usePlacements();
  return (
    <group>
      <Ground />
      <Paths />
      <Square />
      <Pond />
      <KitBatch placements={placements} />
      <Lamps />
    </group>
  );
}

