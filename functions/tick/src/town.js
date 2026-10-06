// Reads the state of the town that one tick needs.
import { Query } from 'node-appwrite';

export const DATABASE_ID = 'town';
export const TICK_MINUTES = 30;

async function all(tablesDB, tableId, queries = []) {
  const { rows } = await tablesDB.listRows({ databaseId: DATABASE_ID, tableId, queries: [...queries, Query.limit(500)] });
  return rows;
}

export async function loadTown(tablesDB) {
  const [world, places, residents, recent, rumorMemories, relationships] = await Promise.all([
    tablesDB.getRow({ databaseId: DATABASE_ID, tableId: 'world', rowId: 'world' }),
    all(tablesDB, 'places'),
    all(tablesDB, 'residents'),
    all(tablesDB, 'memories', [Query.orderDesc('tick'), Query.orderDesc('$sequence'), Query.limit(200)]),
    all(tablesDB, 'memories', [Query.isNotNull('rumorId'), Query.orderAsc('tick')]),
    all(tablesDB, 'relationships'),
  ]);

  const memoriesByResident = new Map();
  for (const memory of recent) {
    const list = memoriesByResident.get(memory.residentId) ?? [];
    if (list.length < 4 && !memory.rumorId) list.push(memory);
    memoriesByResident.set(memory.residentId, list);
  }

  // The latest version of each rumor a resident knows.
  const rumorsByResident = new Map();
  for (const memory of rumorMemories) {
    const list = rumorsByResident.get(memory.residentId) ?? [];
    const index = list.findIndex((r) => r.rumorId === memory.rumorId);
    const entry = { rumorId: memory.rumorId, text: memory.text };
    if (index >= 0) list[index] = entry;
    else list.push(entry);
    rumorsByResident.set(memory.residentId, list);
  }

  const relationshipsByResident = new Map();
  for (const rel of relationships) {
    for (const [self, other] of [[rel.a, rel.b], [rel.b, rel.a]]) {
      const list = relationshipsByResident.get(self) ?? [];
      list.push({ other, affinity: rel.affinity });
      relationshipsByResident.set(self, list);
    }
  }
  for (const list of relationshipsByResident.values()) {
    list.sort((x, y) => Math.abs(y.affinity) - Math.abs(x.affinity)).splice(3);
  }

  return {
    world,
    day: world.day,
    minuteOfDay: world.minuteOfDay,
    places,
    residents,
    relationships,
    memoriesByResident,
    rumorsByResident,
    relationshipsByResident,
  };
}

/** The clock after one more tick. */
export function nextClock(world) {
  const total = world.minuteOfDay + TICK_MINUTES;
  return {
    tick: world.tick + 1,
    minuteOfDay: total % 1440,
    day: world.day + Math.floor(total / 1440),
  };
}
