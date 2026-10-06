// Renders one character as a portrait. Used once to make the PNGs in public/portraits.
import { useAnimations, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { softenMaterial } from '../scene/Kit';

function Character({ name }: { name: string }) {
  const gltf = useGLTF(`/models/characters/${name}.glb`);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(gltf.animations, group);
  useEffect(() => {
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) softenMaterial(m.material as THREE.Material);
    });
    const idle = actions.idle;
    idle?.play();
    if (idle) idle.time = 0.4;
    setTimeout(() => ((window as unknown as { __portraitReady: boolean }).__portraitReady = true), 600);
  }, [actions, gltf]);
  return (
    <group ref={group} rotation-y={0.35}>
      <primitive object={gltf.scene} />
    </group>
  );
}

export function PortraitStudio({ name }: { name: string }) {
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.getElementById('root')!.style.background = 'transparent';
  }, []);
  return (
    <div style={{ width: 256, height: 256 }}>
      <Canvas id="portrait" gl={{ alpha: true, preserveDrawingBuffer: true, antialias: true }} camera={{ fov: 22, position: [0, 0.6, 1.85] }} onCreated={({ camera }) => camera.lookAt(0, 0.47, 0)}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[1.5, 2, 2]} intensity={2.4} />
        <directionalLight position={[-2, 1, -1]} intensity={0.8} color="#ffd9b0" />
        <Character name={name} />
      </Canvas>
    </div>
  );
}
