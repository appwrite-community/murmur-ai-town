// Reads the state of the town that one tick needs.
import { Query } from 'node-appwrite';

export const DATABASE_ID = 'town';
export const TICK_MINUTES = 30;
const RUMORS_IN_PROMPT = 3;

async function all(tablesDB, tableId, queries = [], limit = 500) {
  const { rows } = await tablesDB.listRows({ databaseId: DATABASE_ID, tableId, queries: [...queries, Query.limit(limit)] });
  return rows;
}

export async function loadTown(tablesDB) {
  const [world, places, residents, recent, rumorMemories, relationships] = await Promise.all([
    tablesDB.getRow({ databaseId: DATABASE_ID, tableId: 'world', rowId: 'world' }),
    all(tablesDB, 'places'),
    all(tablesDB, 'residents'),
    all(tablesDB, 'memories', [Query.orderDesc('tick'), Query.orderDesc('$sequence')], 200),
    all(tablesDB, 'memories', [Query.isNotNull('rumorId'), Query.orderDesc('tick'), Query.orderDesc('$sequence')]),
    all(tablesDB, 'relationships'),
  ]);

  const memoriesByResident = new Map();
  for (const memory of recent) {
    const list = memoriesByResident.get(memory.residentId) ?? [];
    if (list.length < 4 && !memory.rumorId) list.push(memory);
    memoriesByResident.set(memory.residentId, list);
  }

  // The newest rumors each resident knows, newest first. Only these go into the prompt.
  const rumorsByResident = new Map();
  for (const memory of rumorMemories) {
    const list = rumorsByResident.get(memory.residentId) ?? [];
    if (list.length < RUMORS_IN_PROMPT && !list.some((r) => r.rumorId === memory.rumorId)) {
      list.push({ rumorId: memory.rumorId, text: memory.text });
    }
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

/**
 * Who knows each of the given rumors, from every memory in the table.
 * The tick checks shared rumors against this, not against the prompt.
 */
export async function loadRumorKnowledge(tablesDB, rumorIds) {
  const knowledge = new Map(rumorIds.map((id) => [id, new Set()]));
  if (rumorIds.length === 0) return knowledge;
  const rows = await all(tablesDB, 'memories', [Query.equal('rumorId', rumorIds)], 1000);
  for (const memory of rows) knowledge.get(memory.rumorId)?.add(memory.residentId);
  return knowledge;
}
