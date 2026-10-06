// The art layout of Murmur. Place IDs match the `places` table.
// Units are Kenney kit cells (1 unit = one wall width). +x is east, +z is south.

export type Vec2 = [number, number];
export type Side = 'n' | 's' | 'e' | 'w';
export type RoofColor = 'red' | 'teal' | 'blue' | 'purple' | 'orange';

export type BuildingDef = {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  floors: 1 | 2;
  door: Side;
  roof: RoofColor;
  upper?: 'wood' | 'stone';
  chimney?: boolean;
  sign?: string;
  windowsLit?: boolean;
};

/** Where residents stand when they are at a place. */
export const ANCHORS: Record<string, Vec2> = {
  square: [0, 0],
  town_hall: [0, -6.4],
  bakery: [-8, -3.9],
  cafe: [8, -3.6],
  library: [-9.6, 3],
  workshop: [9.7, 3],
  pond: [-3.2, 9.3],
  garden: [5.4, 8.3],
  honey_cottage: [-13.2, -6.4],
  ivy_cottage: [-15.4, 6.4],
  fern_cottage: [-11.6, 13.4],
  oak_cottage: [15.6, -3.2],
  maple_cottage: [13.4, 13.0],
};

export const BUILDINGS: BuildingDef[] = [
  { id: 'town_hall', x: 0, z: -9.5, w: 5, d: 4, floors: 2, door: 's', roof: 'blue', upper: 'stone', sign: 'Town Hall' },
  { id: 'bakery', x: -8, z: -6, w: 3, d: 3, floors: 1, door: 's', roof: 'orange', chimney: true, sign: 'Bakery' },
  { id: 'cafe', x: 8, z: -6, w: 3, d: 3, floors: 2, door: 's', roof: 'teal', upper: 'wood', sign: 'Cafe' },
  { id: 'library', x: -12, z: 3, w: 3, d: 4, floors: 2, door: 'e', roof: 'purple', upper: 'wood', sign: 'Library' },
  { id: 'workshop', x: 12, z: 3, w: 3, d: 3, floors: 1, door: 'w', roof: 'red', chimney: true, sign: 'Workshop' },
  { id: 'honey_cottage', x: -14.5, z: -9, w: 2, d: 2, floors: 1, door: 'e', roof: 'orange', chimney: true },
  { id: 'ivy_cottage', x: -17, z: 4, w: 2, d: 3, floors: 1, door: 'e', roof: 'teal' },
  { id: 'fern_cottage', x: -13.5, z: 15.5, w: 3, d: 2, floors: 1, door: 'n', roof: 'red', chimney: true },
  { id: 'oak_cottage', x: 17, z: -5, w: 2, d: 2, floors: 2, door: 'w', roof: 'blue', upper: 'wood' },
  { id: 'maple_cottage', x: 15.5, z: 15.5, w: 3, d: 2, floors: 1, door: 'n', roof: 'red', chimney: true },
];

/** Path network. Residents walk along these edges between anchors. */
export const PATH_NODES: Record<string, Vec2> = {
  ...ANCHORS,
  n1: [0, -3.4],
  w1: [-4.6, -1.6],
  w2: [-5.6, 2.6],
  e1: [4.6, -1.6],
  e2: [5.6, 2.6],
  s1: [0, 4.4],
  sw: [-2.6, 6.6],
  se: [2.8, 6.6],
  hw: [-11.2, -5.0],
  iw: [-12.6, 5.6],
  fw: [-8.4, 11.6],
  oe: [12.6, -2.6],
  me: [9.6, 11.6],
};

export const PATH_EDGES: [string, string][] = [
  ['square', 'n1'], ['n1', 'town_hall'],
  ['square', 'w1'], ['w1', 'bakery'], ['bakery', 'hw'], ['hw', 'honey_cottage'],
  ['square', 'e1'], ['e1', 'cafe'], ['cafe', 'oe'], ['oe', 'oak_cottage'],
  ['w1', 'w2'], ['w2', 'library'], ['library', 'iw'], ['iw', 'ivy_cottage'],
  ['e1', 'e2'], ['e2', 'workshop'], ['workshop', 'oe'],
  ['square', 's1'], ['s1', 'sw'], ['sw', 'pond'], ['s1', 'se'], ['se', 'garden'],
  ['w2', 'sw'], ['e2', 'se'],
  ['pond', 'fw'], ['fw', 'fern_cottage'],
  ['garden', 'me'], ['me', 'maple_cottage'],
];

export const POND = { x: -8, z: 10.5, rx: 4.4, rz: 2.8 };
export const GARDEN = { x: 7.5, z: 11, w: 5, d: 3 };
export const ISLAND = { rx: 23, rz: 21 };

const adjacency = new Map<string, string[]>();
for (const [a, b] of PATH_EDGES) {
  adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
  adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Shortest route between two path nodes (Dijkstra on a tiny graph). */
export function route(from: string, to: string): Vec2[] {
  if (from === to || !PATH_NODES[from] || !PATH_NODES[to]) return [PATH_NODES[to] ?? [0, 0]];
  const best = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const open = new Set([from]);
  while (open.size) {
    let current = '';
    for (const node of open) if (!current || best.get(node)! < best.get(current)!) current = node;
    open.delete(current);
    if (current === to) break;
    for (const next of adjacency.get(current) ?? []) {
      const cost = best.get(current)! + dist(PATH_NODES[current], PATH_NODES[next]);
      if (cost < (best.get(next) ?? Infinity)) {
        best.set(next, cost);
        prev.set(next, current);
        open.add(next);
      }
    }
  }
  const nodes = [to];
  while (nodes[0] !== from && prev.has(nodes[0])) nodes.unshift(prev.get(nodes[0])!);
  return nodes.map((n) => PATH_NODES[n]);
}

/** The nearest path node to a point, so a walk can start from wherever a resident stands. */
export function nearestNode(p: Vec2): string {
  let bestId = 'square';
  let bestD = Infinity;
  for (const [id, node] of Object.entries(PATH_NODES)) {
    const d = dist(p, node);
    if (d < bestD) {
      bestD = d;
      bestId = id;
    }
  }
  return bestId;
}

/** A spot near the anchor for each resident, so people at one place do not overlap. */
export function standingSpot(place: string, slot: number): Vec2 {
  const [x, z] = ANCHORS[place] ?? [0, 0];
  if (place === 'square') {
    const a = (slot / 10) * Math.PI * 2 + 0.4;
    return [x + Math.cos(a) * 2.6, z + Math.sin(a) * 2.6];
  }
  const a = slot * 2.399; // golden angle
  const r = 0.55 + 0.32 * Math.sqrt(slot);
  return [x + Math.cos(a) * r, z + Math.sin(a) * r * 0.8];
}
