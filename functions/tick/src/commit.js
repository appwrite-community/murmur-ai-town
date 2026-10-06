// Turns a validated tick into TablesDB operations and commits them in one transaction.
import { ID } from 'node-appwrite';
import { DATABASE_ID } from './town.js';

const MAX_OPERATIONS = 100; // The transaction limit on the Free plan.

function op(action, tableId, rowId, data) {
  return { action, databaseId: DATABASE_ID, tableId, rowId, data };
}

export function buildOperations({ ctx, next, planned, talks, knowledge = new Map(), stats }) {
  const byId = new Map(ctx.residents.map((r) => [r.$id, r]));
  const placeName = (id) => ctx.places.find((p) => p.$id === id)?.name ?? id;
  const name = (id) => byId.get(id).name.split(' ')[0];
  const now = new Date().toISOString();

  // The tick row is the lock: a second run that tries to create the same
  // tick ID makes the whole transaction fail with a conflict.
  const core = [
    op('create', 'ticks', `tick-${next.tick}`, { startedAt: stats.startedAt, ms: stats.ms, actions: planned.size, rejected: stats.rejected, conversations: talks.length }),
    op('update', 'world', 'world', { tick: next.tick, day: next.day, minuteOfDay: next.minuteOfDay, lastTickAt: now, lastTickMs: stats.ms }),
  ];

  const firstLine = new Map();
  for (const talk of talks) {
    for (const line of talk.lines) if (!firstLine.has(line.speaker)) firstLine.set(line.speaker, line.text);
  }
  const talking = new Map(talks.flatMap((t) => [[t.residents[0], t.residents[1]], [t.residents[1], t.residents[0]]]));

  for (const [id, action] of planned) {
    const resident = byId.get(id);
    const moving = action.type === 'move';
    const inTalk = talking.has(id);
    core.push(op('update', 'residents', id, {
      place: moving ? action.place : resident.place,
      fromPlace: moving ? resident.place : resident.fromPlace,
      movedAtTick: moving ? next.tick : resident.movedAtTick,
      activity: inTalk ? 'talk' : action.type === 'talk' ? 'react' : action.type,
      mood: action.mood,
      emote: action.emote ?? null,
      line: inTalk ? firstLine.get(id) ?? '' : action.line,
      talkingTo: inTalk ? talking.get(id) : null,
    }));
  }

  const story = []; // conversations and rumors: always written
  const extras = []; // moves and reactions: dropped first if the tick is too big

  for (const talk of talks) {
    const [a, b] = talk.residents;
    story.push(op('create', 'events', ID.unique(), {
      tick: next.tick, kind: 'talk', place: talk.place, residentIds: talk.residents,
      text: `${name(a)} and ${name(b)} talk at ${placeName(talk.place)}`,
      lines: JSON.stringify(talk.lines),
    }));
    for (const memory of talk.memories) {
      story.push(op('create', 'memories', ID.unique(), { residentId: memory.resident, tick: next.tick, kind: 'conversation', text: memory.text }));
    }
    for (const share of talk.shared) {
      story.push(op('create', 'memories', ID.unique(), {
        residentId: share.listener, tick: next.tick, kind: 'heard', text: share.retelling,
        rumorId: share.rumorId, fromResidentId: share.speaker,
      }));
      story.push(op('create', 'events', ID.unique(), {
        tick: next.tick, kind: 'rumor', place: talk.place, residentIds: [share.speaker, share.listener],
        rumorId: share.rumorId, text: `${name(share.speaker)} told ${name(share.listener)}: «${share.retelling}»`,
      }));
    }

    const [x, y] = [a, b].sort();
    const current = ctx.relationships.find((r) => r.$id === `${x}__${y}`);
    const delta = talk.feelings.reduce((sum, f) => sum + f.delta, 0) / Math.max(1, talk.feelings.length);
    const affinity = Math.max(-100, Math.min(100, Math.round((current?.affinity ?? 0) + delta)));
    // Create the pair the first time two residents talk, update it after that.
    story.push(current
      ? op('update', 'relationships', current.$id, { affinity, lastTick: next.tick })
      : op('create', 'relationships', `${x}__${y}`, { a: x, b: y, affinity, lastTick: next.tick, note: '' }));
  }

  // How many residents know each rumor after this tick.
  const carriers = new Map();
  for (const talk of talks) {
    for (const share of talk.shared) {
      carriers.set(share.rumorId, (carriers.get(share.rumorId) ?? knowledge.get(share.rumorId)?.size ?? 0) + 1);
    }
  }
  for (const [rumorId, count] of carriers) story.push(op('update', 'rumors', rumorId, { carriers: count }));

  for (const [id, action] of planned) {
    if (action.type === 'move') {
      extras.push(op('create', 'events', ID.unique(), {
        tick: next.tick, kind: 'move', place: action.place, residentIds: [id], text: `${name(id)} walks to ${placeName(action.place)}`,
      }));
    } else if (action.type === 'react' && action.line) {
      extras.push(op('create', 'events', ID.unique(), {
        tick: next.tick, kind: 'react', place: byId.get(id).place, residentIds: [id], text: `${name(id)}: "${action.line}"`,
      }));
    }
  }

  // At most 3 conversations with 2 shared rumors each keep the tick far below the limit.
  if (core.length + story.length > MAX_OPERATIONS) throw new Error(`Tick needs ${core.length + story.length} operations`);
  const room = MAX_OPERATIONS - core.length - story.length;
  return [...core, ...story, ...extras.slice(0, Math.max(0, room))];
}

/** Stages every operation and commits. Nothing is written unless the commit succeeds. */
export async function commitTick(tablesDB, operations) {
  const transaction = await tablesDB.createTransaction({ ttl: 120 });
  try {
    await tablesDB.createOperations({ transactionId: transaction.$id, operations });
    await tablesDB.updateTransaction({ transactionId: transaction.$id, commit: true });
  } catch (err) {
    await tablesDB.updateTransaction({ transactionId: transaction.$id, rollback: true }).catch(() => {});
    throw err;
  }
}
