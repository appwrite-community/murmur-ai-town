// Every Appwrite resource Murmur uses, in one place.
import { Permission, ProjectKeyScopes, Role } from 'node-appwrite';

export type Column =
  | { key: string; type: 'varchar'; size: number; required: boolean; array?: boolean }
  | { key: string; type: 'text'; required: boolean }
  | { key: string; type: 'integer'; required: boolean; min?: number; max?: number; default?: number }
  | { key: string; type: 'datetime'; required: boolean }
  | { key: string; type: 'enum'; elements: string[]; required: boolean; default?: string };

export type Index = { key: string; type: 'key' | 'unique'; columns: string[]; orders?: ('asc' | 'desc')[] };

export type Table = {
  id: string;
  name: string;
  permissions: string[];
  rowSecurity: boolean;
  columns: Column[];
  indexes: Index[];
};

export const DATABASE = { id: 'town', name: 'Town' };

const ACTIVITIES = ['move', 'talk', 'work', 'rest', 'react'];
const MOODS = ['cheerful', 'content', 'curious', 'excited', 'anxious', 'grumpy', 'suspicious', 'sad', 'sleepy'];
const EMOTES = ['happy', 'laugh', 'surprised', 'thinking', 'love', 'sad', 'angry', 'shrug', 'sleepy'];
const id = (key: string, required = true): Column => ({ key, type: 'varchar', size: 36, required });

// Anyone can watch the town. Only the functions (API key) write to these tables.
const publicRead = [Permission.read(Role.any())];

export const TABLES: Table[] = [
  {
    id: 'world',
    name: 'World',
    permissions: publicRead,
    rowSecurity: false,
    columns: [
      { key: 'tick', type: 'integer', required: true, min: 0 },
      { key: 'day', type: 'integer', required: true, min: 1 },
      { key: 'minuteOfDay', type: 'integer', required: true, min: 0, max: 1439 },
      { key: 'lastTickAt', type: 'datetime', required: false },
      { key: 'lastTickMs', type: 'integer', required: false, min: 0 },
    ],
    indexes: [],
  },
  {
    id: 'places',
    name: 'Places',
    permissions: publicRead,
    rowSecurity: false,
    columns: [
      { key: 'name', type: 'varchar', size: 64, required: true },
      { key: 'kind', type: 'enum', elements: ['work', 'home', 'outdoor'], required: true },
      { key: 'description', type: 'varchar', size: 200, required: true },
    ],
    indexes: [],
  },
  {
    id: 'residents',
    name: 'Residents',
    permissions: publicRead,
    rowSecurity: false,
    columns: [
      { key: 'name', type: 'varchar', size: 64, required: true },
      { key: 'job', type: 'varchar', size: 64, required: true },
      { key: 'persona', type: 'varchar', size: 400, required: true },
      id('workplace'),
      id('home'),
      id('place'),
      id('fromPlace'),
      { key: 'movedAtTick', type: 'integer', required: false, min: 0, default: 0 },
      { key: 'activity', type: 'enum', elements: ACTIVITIES, required: true },
      { key: 'mood', type: 'enum', elements: MOODS, required: true },
      { key: 'emote', type: 'enum', elements: EMOTES, required: false },
      { key: 'line', type: 'varchar', size: 200, required: false },
      id('talkingTo', false),
      { key: 'character', type: 'varchar', size: 64, required: true },
      { key: 'color', type: 'varchar', size: 16, required: true },
    ],
    indexes: [],
  },
  {
    id: 'memories',
    name: 'Memories',
    permissions: publicRead,
    rowSecurity: false,
    columns: [
      id('residentId'),
      { key: 'tick', type: 'integer', required: true, min: 0 },
      { key: 'kind', type: 'enum', elements: ['conversation', 'heard', 'whisper', 'observation'], required: true },
      { key: 'text', type: 'varchar', size: 400, required: true },
      id('rumorId', false),
      id('fromResidentId', false),
    ],
    indexes: [
      { key: 'resident_tick', type: 'key', columns: ['residentId', 'tick'], orders: ['asc', 'desc'] },
      { key: 'tick', type: 'key', columns: ['tick'], orders: ['desc'] },
      { key: 'rumor', type: 'key', columns: ['rumorId'] },
    ],
  },
  {
    id: 'relationships',
    name: 'Relationships',
    permissions: publicRead,
    rowSecurity: false,
    columns: [
      id('a'),
      id('b'),
      { key: 'affinity', type: 'integer', required: true, min: -100, max: 100 },
      { key: 'note', type: 'varchar', size: 200, required: false },
      { key: 'lastTick', type: 'integer', required: false, min: 0, default: 0 },
    ],
    indexes: [],
  },
  {
    id: 'events',
    name: 'Events',
    permissions: publicRead,
    rowSecurity: false,
    columns: [
      { key: 'tick', type: 'integer', required: true, min: 0 },
      { key: 'kind', type: 'enum', elements: ['move', 'talk', 'rumor', 'whisper', 'react', 'system'], required: true },
      { key: 'text', type: 'varchar', size: 400, required: true },
      { key: 'residentIds', type: 'varchar', size: 36, required: false, array: true },
      id('place', false),
      id('rumorId', false),
      { key: 'lines', type: 'text', required: false },
    ],
    indexes: [{ key: 'tick', type: 'key', columns: ['tick'], orders: ['desc'] }],
  },
  {
    id: 'rumors',
    name: 'Rumors',
    permissions: publicRead,
    rowSecurity: false,
    columns: [
      { key: 'text', type: 'varchar', size: 200, required: true },
      id('originResidentId'),
      { key: 'tick', type: 'integer', required: true, min: 0 },
      { key: 'carriers', type: 'integer', required: true, min: 0 },
    ],
    indexes: [],
  },
  {
    // The tick lock. Row ID tick-<n>. Nobody but the tick function reads or writes it.
    id: 'ticks',
    name: 'Ticks',
    permissions: [],
    rowSecurity: false,
    columns: [
      { key: 'startedAt', type: 'datetime', required: true },
      { key: 'ms', type: 'integer', required: true, min: 0 },
      { key: 'actions', type: 'integer', required: true, min: 0 },
      { key: 'rejected', type: 'integer', required: true, min: 0 },
      { key: 'conversations', type: 'integer', required: true, min: 0 },
    ],
    indexes: [],
  },
  {
    // Visitors (anonymous sessions) can only create whispers and read their own.
    id: 'whispers',
    name: 'Whispers',
    permissions: [Permission.create(Role.users())],
    rowSecurity: true,
    columns: [
      id('residentId'),
      { key: 'text', type: 'varchar', size: 200, required: true },
      { key: 'status', type: 'enum', elements: ['pending', 'heard', 'rate_limited', 'rejected'], required: false, default: 'pending' },
      { key: 'reply', type: 'varchar', size: 200, required: false },
      { key: 'emote', type: 'enum', elements: EMOTES, required: false },
      id('visitorId', false),
    ],
    indexes: [],
  },
  {
    id: 'whisper_slots',
    name: 'Whisper slots',
    permissions: [],
    rowSecurity: false,
    columns: [
      id('visitorId'),
      { key: 'window', type: 'integer', required: true, min: 0 },
    ],
    indexes: [],
  },
];

export type FunctionConfig = {
  id: string;
  name: string;
  dir: string;
  events: string[];
  schedule: string;
  timeout: number;
  scopes: ProjectKeyScopes[];
};

export const FUNCTIONS: FunctionConfig[] = [
  {
    id: 'tick',
    name: 'Tick',
    dir: 'functions/tick',
    events: [],
    schedule: '* * * * *',
    timeout: 120,
    scopes: [ProjectKeyScopes.RowsRead, ProjectKeyScopes.RowsWrite],
  },
  {
    id: 'whisper',
    name: 'Whisper',
    dir: 'functions/whisper',
    events: [`tablesdb.${DATABASE.id}.tables.whispers.rows.*.create`],
    schedule: '',
    timeout: 60,
    scopes: [ProjectKeyScopes.RowsRead, ProjectKeyScopes.RowsWrite],
  },
];

export const SITE = { id: 'murmur', name: 'Murmur' };
