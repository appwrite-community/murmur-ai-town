// Moves the sun, tints the lights, and paints the sky behind the canvas.
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { displayMinute, useTown } from '../lib/store';
import { skyAt, useSky } from './sky';

export function DayNight({ backdrop }: { backdrop: React.RefObject<HTMLDivElement | null> }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const lastMinute = useRef(-1);

  useLayoutEffect(() => {
    // The shadow camera bounds are set through props; refresh its projection once.
    sun.current?.shadow.camera.updateProjectionMatrix();
  }, []);

  useFrame(() => {
    const { world, tickArrivedAt } = useTown.getState();
    const override = (window as unknown as { __murmurMinute?: number }).__murmurMinute;
    const minute = override ?? displayMinute(world, tickArrivedAt);
    const sky = skyAt(minute);
    if (sun.current) {
      sun.current.position.set(...sky.sunDir);
      sun.current.color.set(sky.sun);
      sun.current.intensity = sky.sunIntensity;
    }
    if (hemi.current) {
      hemi.current.intensity = sky.hemi;
      hemi.current.color.set(sky.top).lerp(new THREE.Color('#ffffff'), 0.55);
    }
    if (backdrop.current) {
      backdrop.current.style.background = `radial-gradient(120% 90% at 50% 100%, ${sky.bottom} 0%, ${sky.top} 75%)`;
    }
    if (Math.abs(minute - lastMinute.current) >= 0.25) {
      lastMinute.current = minute;
      useSky.setState(sky);
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', '#6d8f4e', 1]} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
    </>
  );
}
