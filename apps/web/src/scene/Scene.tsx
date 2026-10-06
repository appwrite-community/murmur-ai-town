// The game world: one full-screen WebGL canvas.
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import { townActions } from '../lib/store';
import { Buildings } from './Buildings';
import { CameraRig } from './CameraRig';
import { Clouds } from './Clouds';
import { DayNight } from './DayNight';
import { Island } from './Island';
import { Residents } from './Resident';

export function Scene({ backdrop }: { backdrop: React.RefObject<HTMLDivElement | null> }) {
  return (
    <Canvas
      className="scene"
      orthographic
      shadows
      dpr={[1, 2]}
      camera={{ position: [40, 40, 40], zoom: 30, near: 0.1, far: 400 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={() => townActions.select(null)}
      onCreated={(state) => {
        if (import.meta.env.DEV) (window as unknown as { __three: unknown }).__three = state;
      }}
    >
      <CameraRig />
      <DayNight backdrop={backdrop} />
      <Suspense fallback={null}>
        <Island />
        <Buildings />
        <Residents />
        <Clouds />
      </Suspense>
    </Canvas>
  );
}
