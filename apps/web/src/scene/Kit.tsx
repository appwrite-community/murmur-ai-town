// Renders many copies of Kenney kit models with one InstancedMesh per model part.
import { useGLTF, useTexture } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export type Placement = {
  model: string; // e.g. "town/wall" or "nature/tree_oak"
  variant?: string; // roof texture variant, e.g. "roof-red"
  p: [number, number, number];
  ry?: number;
  s?: number | [number, number, number];
};

const url = (model: string) => `/models/${model}.glb`;

/** Kenney's nature kit ships metallic materials. Make every material matte and soft. */
export function softenMaterial(material: THREE.Material) {
  const m = material as THREE.MeshStandardMaterial;
  if ('metalness' in m) {
    m.metalness = 0;
    m.roughness = 0.85;
  }
  return m;
}

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 };

function useParts(model: string, variant?: string): Part[] {
  const gltf = useGLTF(url(model));
  const texture = useTexture(`/models/town/Textures/${variant ?? 'colormap'}.png`);
  return useMemo(() => {
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    const parts: Part[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      let material = softenMaterial(mesh.material as THREE.Material);
      if (variant) {
        material = (material as THREE.MeshStandardMaterial).clone();
        (material as THREE.MeshStandardMaterial).map = texture;
      }
      parts.push({ geometry: mesh.geometry, material, matrix: mesh.matrixWorld.clone() });
    });
    return parts;
  }, [gltf, texture, variant]);
}

function ModelInstances({ model, variant, items }: { model: string; variant?: string; items: Placement[] }) {
  const parts = useParts(model, variant);
  return (
    <>
      {parts.map((part, index) => (
        <PartInstances key={index} part={part} items={items} />
      ))}
    </>
  );
}

const tmp = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);

function PartInstances({ part, items }: { part: Part; items: Placement[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((item, i) => {
      const s = item.s ?? 1;
      const scale = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
      q.setFromAxisAngle(up, item.ry ?? 0);
      tmp.compose(new THREE.Vector3(...item.p), q, scale).multiply(part.matrix);
      mesh.setMatrixAt(i, tmp);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, part]);
  return <instancedMesh ref={ref} args={[part.geometry, part.material, items.length]} castShadow receiveShadow />;
}

/** Groups placements by model and texture variant and renders each group instanced. */
export function KitBatch({ placements }: { placements: Placement[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, Placement[]>();
    for (const p of placements) {
      const key = `${p.model}|${p.variant ?? ''}`;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [placements]);
  return (
    <>
      {groups.map(([key, items]) => (
        <ModelInstances key={key} model={items[0].model} variant={items[0].variant} items={items} />
      ))}
    </>
  );
}
