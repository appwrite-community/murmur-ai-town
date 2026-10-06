// Soft low-poly clouds drifting below and around the island.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSky } from './sky';

const CLOUDS = [
  { x: -30, y: -7, z: 20, s: 1.5 },
  { x: 30, y: -9, z: -16, s: 1.8 },
  { x: 32, y: -5, z: 24, s: 1.3 },
  { x: -34, y: -10, z: -22, s: 2.0 },
  { x: 6, y: -13, z: 34, s: 1.7 },
  { x: -12, y: 6, z: -36, s: 1.2 },
];

export function Clouds() {
  const group = useRef<THREE.Group>(null);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, transparent: true, opacity: 0.85 }), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    group.current?.children.forEach((c, i) => {
      c.position.x = CLOUDS[i].x + Math.sin(t * 0.05 + i) * 3;
      c.position.y = CLOUDS[i].y + Math.sin(t * 0.3 + i * 2) * 0.3;
    });
    const night = useSky.getState().night;
    material.color.setRGB(1 - night * 0.55, 1 - night * 0.5, 1 - night * 0.3);
  });
  return (
    <group ref={group}>
      {CLOUDS.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={[c.s * 1.3, c.s * 0.75, c.s]}>
          {[[0, 0, 0, 1.2], [1.3, -0.25, 0.3, 0.85], [-1.3, -0.3, -0.2, 0.8], [0.5, 0.45, -0.3, 0.8], [2.3, -0.45, 0, 0.55]].map(([x, y, z, r], j) => (
            <mesh key={j} position={[x, y, z]} material={material}>
              <icosahedronGeometry args={[r, 2]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
