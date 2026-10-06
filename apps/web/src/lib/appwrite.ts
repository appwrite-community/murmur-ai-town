import { Account, Channel, Client, ID, Permission, Query, Realtime, Role, TablesDB } from 'appwrite';
import type { Memory, Place, Relationship, Resident, Rumor, TownEvent, Whisper, World } from './types';

export const DATABASE_ID = 'town';

export const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const account = new Account(client);
const tablesDB = new TablesDB(client);
const realtime = new Realtime(client);

/** Every visitor gets an anonymous session, so they can whisper without signing up. */
export async function ensureVisitor(): Promise<string> {
  try {
    return (await account.get()).$id;
  } catch {
    return (await account.createAnonymousSession()).userId;
  }
}

function rows<T>(tableId: string, queries: string[] = []) {
  return tablesDB.listRows<T & never>({ databaseId: DATABASE_ID, tableId, queries }).then((r) => r.rows as unknown as T[]);
}

export async function loadTown() {
  const [world, places, residents, events, rumors] = await Promise.all([
    tablesDB.getRow({ databaseId: DATABASE_ID, tableId: 'world', rowId: 'world' }) as unknown as Promise<World>,
    rows<Place>('places', [Query.limit(100)]),
    rows<Resident>('residents', [Query.limit(100)]),
    rows<TownEvent>('events', [Query.orderDesc('$sequence'), Query.limit(60)]),
    rows<Rumor>('rumors', [Query.orderDesc('$sequence'), Query.limit(30)]),
  ]);
  return { world, places, residents, events, rumors };
}

export async function loadResidentDetails(residentId: string) {
  const [memories, relationships] = await Promise.all([
    rows<Memory>('memories', [Query.equal('residentId', [residentId]), Query.orderDesc('tick'), Query.orderDesc('$sequence'), Query.limit(6)]),
    rows<Relationship>('relationships', [Query.or([Query.equal('a', [residentId]), Query.equal('b', [residentId])]), Query.orderDesc('affinity'), Query.limit(20)]),
  ]);
  return { memories, relationships };
}

/**
 * One Realtime subscription for everything the town shows. Resolves once the
 * subscription is active, so the caller can load the town after it.
 */
export async function subscribeToTown(handlers: {
  world: (row: World) => void;
  resident: (row: Resident) => void;
  event: (row: TownEvent) => void;
  rumor: (row: Rumor) => void;
  whisper: (row: Whisper) => void;
}) {
  const town = Channel.tablesdb(DATABASE_ID);
  const tables = {
    world: town.table('world').row(),
    residents: town.table('residents').row(),
    events: town.table('events').row(),
    rumors: town.table('rumors').row(),
    whispers: town.table('whispers').row(),
  };
  const subscription = await realtime.subscribe(Object.values(tables), (message) => {
    // Rows are only deleted when the town is reset. Reload the page to see the new town.
    if (message.events.some((e) => e.endsWith('.delete'))) return;
    const row = message.payload as never;
    const has = (table: string) => message.channels.some((c) => c.includes(`.tables.${table}.`));
    if (has('world')) handlers.world(row);
    else if (has('residents')) handlers.resident(row);
    else if (has('events')) handlers.event(row);
    else if (has('rumors')) handlers.rumor(row);
    else if (has('whispers')) handlers.whisper(row);
  });
  return () => subscription.unsubscribe();
}

/** Visitors can only create whispers. The row is readable by the visitor who wrote it. */
export function sendWhisper(visitorId: string, residentId: string, text: string) {
  return tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: 'whispers',
    rowId: ID.unique(),
    data: { residentId, text },
    permissions: [Permission.read(Role.user(visitorId))],
  }) as unknown as Promise<Whisper>;
}

/** Everyone who knows a rumor, in the order they heard it. */
export function loadRumorTrail(rumorId: string) {
  return rows<Memory>('memories', [Query.equal('rumorId', [rumorId]), Query.orderAsc('tick'), Query.orderAsc('$sequence'), Query.limit(50)]);
}
