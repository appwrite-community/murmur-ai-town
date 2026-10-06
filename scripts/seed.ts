// Resets the town to the morning of day 1: places, residents, a few
// friendships and one old rumor. Deletes every memory, event, rumor, tick, and whisper.
import { ID } from 'node-appwrite';
import { describeError, tablesDB } from './lib/client.ts';
import { DATABASE } from './schema.ts';
import town from './town.json' with { type: 'json' };

const databaseId = DATABASE.id;
const START_MINUTE = 7 * 60;

const RELATIONSHIPS: [string, string, number, string][] = [
  ['bea', 'mae', 45, 'Housemates at Honey Cottage. Share every bit of news over breakfast.'],
  ['rafa', 'tobias', 35, 'Housemates at Oak Cottage. Rafa talks, Tobias listens.'],
  ['dot', 'otto', -15, 'Dot taught Otto at school and still corrects his speeches.'],
  ['ike', 'wren', 30, 'Old friends at the pond. Wren paints, Ike tells tall tales.'],
  ['juniper', 'lin', 25, 'Lin lends Juniper books about plants.'],
  ['bea', 'rafa', 20, 'Friendly rivals: bread versus pastries.'],
  ['lin', 'wren', 30, 'Housemates at Ivy Cottage.'],
  ['dot', 'mae', 25, 'Dot always asks Mae who gets letters from whom.'],
];

const SEED_RUMOR = {
  id: 'seed-windmill',
  text: 'Someone saw a lantern moving inside the old windmill at midnight.',
  knownBy: 'dot',
};

async function clear(tableId: string) {
  await tablesDB.deleteRows({ databaseId, tableId });
}

try {
  for (const tableId of ['memories', 'events', 'rumors', 'ticks', 'whispers', 'whisper_slots', 'relationships']) {
    await clear(tableId);
  }

  for (const place of town.places) {
    const { id, ...data } = place;
    await tablesDB.upsertRow({ databaseId, tableId: 'places', rowId: id, data });
  }

  for (const resident of town.residents) {
    const { id, ...data } = resident;
    await tablesDB.upsertRow({
      databaseId,
      tableId: 'residents',
      rowId: id,
      data: { ...data, place: data.home, fromPlace: data.home, movedAtTick: 0, activity: 'rest', mood: 'sleepy', emote: null, line: '', talkingTo: null },
    });
  }

  for (const [x, y, affinity, note] of RELATIONSHIPS) {
    const [a, b] = [x, y].sort();
    await tablesDB.upsertRow({ databaseId, tableId: 'relationships', rowId: `${a}__${b}`, data: { a, b, affinity, note, lastTick: 0 } });
  }

  await tablesDB.createRow({ databaseId, tableId: 'rumors', rowId: SEED_RUMOR.id, data: { text: SEED_RUMOR.text, originResidentId: SEED_RUMOR.knownBy, tick: 0, carriers: 1 } });
  await tablesDB.createRow({
    databaseId, tableId: 'memories', rowId: ID.unique(),
    data: { residentId: SEED_RUMOR.knownBy, tick: 0, kind: 'heard', text: SEED_RUMOR.text, rumorId: SEED_RUMOR.id },
  });

  await tablesDB.upsertRow({
    databaseId, tableId: 'world', rowId: 'world',
    data: { tick: 0, day: 1, minuteOfDay: START_MINUTE, lastTickAt: new Date().toISOString(), lastTickMs: 0 },
  });
  await tablesDB.createRow({ databaseId, tableId: 'events', rowId: ID.unique(), data: { tick: 0, kind: 'system', text: 'Morning breaks over Murmur. The town wakes up.' } });

  console.log(`Seeded ${town.places.length} places, ${town.residents.length} residents, ${RELATIONSHIPS.length} relationships.`);
} catch (err) {
  console.error(`Seeding failed: ${describeError(err)}`);
  process.exitCode = 1;
}
