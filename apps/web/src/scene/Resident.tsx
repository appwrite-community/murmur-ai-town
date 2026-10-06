// One resident: an animated Kenney mini character that walks the path network.
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { townActions, useTown } from '../lib/store';
import type { Resident as ResidentRow } from '../lib/types';
import { ANCHORS, nearestNode, route, standingSpot, type Vec2 } from '../town/layout';
import { cameraState } from './CameraRig';
import { useSky } from './sky';
import { softenMaterial } from './Kit';

const WALK_SPEED = 1.7; // units per second

/** Live positions of every resident, for facing partners and following with the camera. */
export const livePositions = new Map<string, THREE.Vector3>();
/** 0 when a resident is inside a house, 1 when outside. */
export const liveVisibility = new Map<string, number>();
const SCALE = 1.6;

/** Where a resident should stand, given what they are doing. */
function destination(resident: ResidentRow, slot: number, partner: ResidentRow | undefined, partnerSlot: number): { spot: Vec2; inside: boolean } {
  if (resident.activity === 'rest' && resident.place === resident.home) {
    return { spot: ANCHORS[resident.home], inside: true };
  }
  if (partner && partner.place === resident.place && partner.talkingTo === resident.$id) {
    // Conversation partners stand facing each other around a shared point.
    const [cx, cz] = standingSpot(resident.place, Math.min(slot, partnerSlot));
    const side = resident.$id < partner.$id ? -1 : 1;
    return { spot: [cx + side * 0.48, cz + side * 0.12], inside: false };
  }
  return { spot: standingSpot(resident.place, slot), inside: false };
}

function animationFor(resident: ResidentRow, moving: boolean) {
  if (moving) return 'walk';
  switch (resident.activity) {
    case 'talk':
      return 'emote-yes';
    case 'work':
      return resident.workplace === 'square' || resident.workplace === 'pond' ? 'idle' : 'interact-right';
    case 'rest':
      return 'sit';
    case 'react':
      if (resident.emote === 'sad' || resident.emote === 'angry') return 'emote-no';
      if (resident.emote === 'sleepy') return 'sit';
      if (resident.emote === 'happy' || resident.emote === 'laugh' || resident.emote === 'love' || resident.emote === 'surprised') return 'emote-yes';
      return 'idle';
    default:
      return 'idle';
  }
}

export function Resident({ resident, slot }: { resident: ResidentRow; slot: number }) {
  const gltf = useGLTF(`/models/characters/${resident.character}.glb`);
  const model = useMemo(() => {
    const scene = cloneSkinned(gltf.scene);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        const material = softenMaterial((mesh.material as THREE.Material).clone()) as THREE.MeshStandardMaterial;
        // A little self-light at night, so residents stay readable in the dark.
        material.emissiveMap = material.map;
        material.emissive = new THREE.Color('#ffffff');
        material.emissiveIntensity = 0;
        mesh.material = material;
      }
    });
    return scene;
  }, [gltf]);
  const materials = useMemo(() => {
    const list: THREE.MeshStandardMaterial[] = [];
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) list.push(mesh.material as THREE.MeshStandardMaterial);
    });
    return list;
  }, [model]);
  const blob = useRef<THREE.MeshBasicMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const { actions } = useAnimations(gltf.animations, body);

  const partner = useTown((s) => (resident.talkingTo ? s.residents[resident.talkingTo] : undefined));
  const partnerSlot = useTown((s) => Object.keys(s.residents).sort().indexOf(resident.talkingTo ?? ''));
  const selected = useTown((s) => s.selectedId === resident.$id);

  // Movement state lives in refs, so the frame loop never re-renders React.
  const pos = useRef(new THREE.Vector3());
  const waypoints = useRef<Vec2[]>([]);
  const lastPlace = useRef<string | null>(null);
  const heading = useRef(0);
  const visible = useRef(1);
  const [moving, setMoving] = useState(false);
  const target = useMemo(() => destination(resident, slot, partner, partnerSlot), [resident, slot, partner, partnerSlot]);

  useEffect(() => {
    const [sx, sz] = target.spot;
    if (lastPlace.current === null) {
      // First render: stand at the destination right away.
      pos.current.set(sx, 0, sz);
      visible.current = target.inside ? 0 : 1;
    } else if (lastPlace.current !== resident.place) {
      const start = nearestNode([pos.current.x, pos.current.z]);
      waypoints.current = [...route(start, resident.place), target.spot];
    } else {
      waypoints.current = [target.spot];
    }
    lastPlace.current = resident.place;
  }, [target, resident.place]);

  const animation = animationFor(resident, moving);
  useEffect(() => {
    const action = actions[animation] ?? actions.idle;
    action?.reset().fadeIn(0.25).play();
    if (action) action.timeScale = animation === 'emote-yes' ? 0.6 : 1;
    return () => {
      action?.fadeOut(0.25);
    };
  }, [actions, animation]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const step = Math.min(dt, 0.05);
    let isMoving = false;
    const next = waypoints.current[0];
    if (next) {
      const dx = next[0] - pos.current.x;
      const dz = next[1] - pos.current.z;
      const d = Math.hypot(dx, dz);
      const speed = WALK_SPEED * (waypoints.current.length > 3 ? 1.25 : 1);
      if (d < 0.04) {
        waypoints.current.shift();
      } else {
        const move = Math.min(d, speed * step);
        pos.current.x += (dx / d) * move;
        pos.current.z += (dz / d) * move;
        heading.current = Math.atan2(dx, dz);
        isMoving = d > 0.12 || waypoints.current.length > 1;
      }
    }
    if (!isMoving && partner && resident.activity === 'talk') {
      const p = livePositions.get(partner.$id);
      if (p) {
        // Face whoever this resident talks to.
        heading.current = Math.atan2(p.x - pos.current.x, p.z - pos.current.z);
      }
    }
    if (isMoving !== moving) setMoving(isMoving);

    const goInside = target.inside && waypoints.current.length === 0;
    visible.current = THREE.MathUtils.damp(visible.current, goInside ? 0 : 1, 6, step);
    g.position.copy(pos.current);
    livePositions.set(resident.$id, pos.current);
    liveVisibility.set(resident.$id, visible.current);
    const night = useSky.getState().night;
    for (const m of materials) m.emissiveIntensity = night * 0.42;
    if (blob.current) {
      // A soft shadow by day, a warm glow by night.
      blob.current.color.set(night > 0.5 ? '#ffcf7a' : '#1d2a12');
      blob.current.opacity = night > 0.5 ? 0.35 * night : 0.28;
    }
    g.scale.setScalar(Math.max(visible.current, 0.001) * SCALE);
    g.visible = visible.current > 0.02;
    if (body.current) {
      const current = body.current.rotation.y;
      const delta = Math.atan2(Math.sin(heading.current - current), Math.cos(heading.current - current));
      body.current.rotation.y = current + delta * Math.min(1, step * 8);
    }
  });

  return (
    <group ref={group}>
      <group ref={body}>
        <primitive object={model} />
      </group>
      {/* A larger invisible shape makes residents easy to click. */}
      <mesh
        position-y={0.38}
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          if (!cameraState.dragged) townActions.select(resident.$id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          townActions.hover(resident.$id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          townActions.hover(null);
          document.body.style.cursor = '';
        }}
      >
        <cylinderGeometry args={[0.32, 0.32, 0.8, 8]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.025}>
        <circleGeometry args={[0.32, 24]} />
        <meshBasicMaterial ref={blob} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {selected && <SelectionRing color={resident.color} />}
    </group>
  );
}

function SelectionRing({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.08);
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position-y={0.03}>
      <ringGeometry args={[0.36, 0.48, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
    </mesh>
  );
}

export function Residents() {
  const residents = useTown((s) => s.residents);
  const ids = Object.keys(residents).sort();
  return (
    <group>
      {ids.map((id, slot) => (
        <Resident key={id} resident={residents[id]} slot={slot} />
      ))}
    </group>
  );
}
