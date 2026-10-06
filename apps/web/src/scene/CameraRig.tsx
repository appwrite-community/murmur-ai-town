// Isometric camera: drag to pan, scroll to zoom, Q and E to rotate in 90 degree steps.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { ISLAND } from '../town/layout';

const PITCH = THREE.MathUtils.degToRad(36);
const DISTANCE = 80;
const MIN_ZOOM = 16;
const MAX_ZOOM = 90;

/** Shared camera state, so the HUD can rotate, zoom, and focus the camera. */
export const cameraState = {
  target: new THREE.Vector3(0, 0, 1.5),
  goal: new THREE.Vector3(0, 0, 1.5),
  yawStep: 0,
  yaw: Math.PI / 4,
  zoom: 30,
  zoomGoal: 30,
  dragged: false,
  follow: null as (() => THREE.Vector3 | undefined) | null,
};

export function rotateCamera(direction: 1 | -1) {
  cameraState.yawStep += direction;
}

export function zoomCamera(factor: number) {
  cameraState.zoomGoal = THREE.MathUtils.clamp(cameraState.zoomGoal * factor, MIN_ZOOM, MAX_ZOOM);
}

export function focusCamera(x: number, z: number, zoom?: number) {
  cameraState.goal.set(x, 0, z);
  if (zoom) cameraState.zoomGoal = zoom;
}

function clampToIsland(v: THREE.Vector3) {
  v.x = THREE.MathUtils.clamp(v.x, -ISLAND.rx, ISLAND.rx);
  v.z = THREE.MathUtils.clamp(v.z, -ISLAND.rz, ISLAND.rz);
}

export function CameraRig() {
  const { camera, gl, size } = useThree();

  useEffect(() => {
    // Fit the whole island on first load, whatever the window size.
    const fit = Math.min(size.width / (ISLAND.rx * 2.5), size.height / (ISLAND.rz * 1.9)) * 1.75;
    cameraState.zoom = cameraState.zoomGoal = THREE.MathUtils.clamp(fit, MIN_ZOOM, MAX_ZOOM);
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number } | null = null;
    let moved = 0;
    const keys = new Set<string>();

    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      moved = 0;
      cameraState.dragged = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      down = { x: e.clientX, y: e.clientY };
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) {
        cameraState.dragged = true;
        cameraState.follow = null;
        el.style.cursor = 'grabbing';
      }
      if (!cameraState.dragged) return;
      // Screen pixels to ground units for an orthographic camera.
      const units = 1 / cameraState.zoom;
      const right = new THREE.Vector3(Math.cos(cameraState.yaw), 0, -Math.sin(cameraState.yaw));
      const forward = new THREE.Vector3(-Math.sin(cameraState.yaw), 0, -Math.cos(cameraState.yaw));
      cameraState.goal.addScaledVector(right, -dx * units).addScaledVector(forward, (dy * units) / Math.sin(PITCH));
      clampToIsland(cameraState.goal);
    };
    const onUp = () => {
      down = null;
      el.style.cursor = '';
      // Let the click handler see that this was a drag, then reset.
      setTimeout(() => (cameraState.dragged = false), 0);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomCamera(Math.exp(-e.deltaY * 0.0012));
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (e.type === 'keydown') {
        if (k === 'q') rotateCamera(-1);
        if (k === 'e') rotateCamera(1);
        if (k === '=' || k === '+') zoomCamera(1.2);
        if (k === '-') zoomCamera(1 / 1.2);
        keys.add(k);
      } else keys.delete(k);
    };
    const panLoop = setInterval(() => {
      const right = new THREE.Vector3(Math.cos(cameraState.yaw), 0, -Math.sin(cameraState.yaw));
      const forward = new THREE.Vector3(-Math.sin(cameraState.yaw), 0, -Math.cos(cameraState.yaw));
      const speed = 0.5;
      if (keys.has('w') || keys.has('arrowup')) cameraState.goal.addScaledVector(forward, speed);
      if (keys.has('s') || keys.has('arrowdown')) cameraState.goal.addScaledVector(forward, -speed);
      if (keys.has('a') || keys.has('arrowleft')) cameraState.goal.addScaledVector(right, -speed);
      if (keys.has('d') || keys.has('arrowright')) cameraState.goal.addScaledVector(right, speed);
      if (keys.size) {
        cameraState.follow = null;
        clampToIsland(cameraState.goal);
      }
    }, 16);

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      clearInterval(panLoop);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const s = cameraState;
    const followed = s.follow?.();
    if (followed) s.goal.set(followed.x, 0, followed.z);
    s.target.x = THREE.MathUtils.damp(s.target.x, s.goal.x, 6, dt);
    s.target.z = THREE.MathUtils.damp(s.target.z, s.goal.z, 6, dt);
    s.yaw = THREE.MathUtils.damp(s.yaw, Math.PI / 4 + s.yawStep * (Math.PI / 2), 7, dt);
    s.zoom = THREE.MathUtils.damp(s.zoom, s.zoomGoal, 8, dt);

    const offset = new THREE.Vector3(Math.sin(s.yaw) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(s.yaw) * Math.cos(PITCH)).multiplyScalar(DISTANCE);
    camera.position.copy(s.target).add(offset);
    camera.lookAt(s.target);
    const ortho = camera as THREE.OrthographicCamera;
    if (Math.abs(ortho.zoom - s.zoom) > 1e-4) {
      ortho.zoom = s.zoom;
      ortho.updateProjectionMatrix();
    }
  });

  return null;
}
