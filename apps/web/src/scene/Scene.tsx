// The game world: one full-screen WebGL canvas.
import { Canvas, useFrame } from '@react-three/fiber';
import { layoutLabels } from '../hud/Bubbles';
import { Suspense } from 'react';
import * as THREE from 'three';
import { townActions } from '../lib/store';
import { Buildings } from './Buildings';
import { CameraRig } from './CameraRig';
import { Clouds } from './Clouds';
import { DayNight } from './DayNight';
import { Island } from './Island';
import { liveVisibility, livePositions, Residents } from './Resident';

/** Places the screen-space labels after every frame. */
function LabelDriver() {
  useFrame(({ camera, size }) => layoutLabels(camera, size.width, size.height, livePositions, liveVisibility));
  return null;
}

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
      <LabelDriver />
      <DayNight backdrop={backdrop} />
      <Suspense fallback={null}>
        <Island />
        <Buildings />
        <Residents />
        {!(import.meta.env.DEV && new URLSearchParams(location.search).has('render')) && <Clouds />}
      </Suspense>
    </Canvas>
  );
}
