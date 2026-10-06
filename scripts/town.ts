// Starts, stops, or steps the town.
//   pnpm town start   schedule the tick function every minute and enable both functions
//   pnpm town stop    disable both functions and remove the schedule (no model calls)
//   pnpm town step    run one tick now, then restore the previous state
//   pnpm town status  show the clock and the function state
import { ExecutionMethod } from 'node-appwrite';
import { describeError, functions, tablesDB } from './lib/client.ts';
import { functionSettings } from './lib/functions.ts';
import { DATABASE, FUNCTIONS } from './schema.ts';

const tick = FUNCTIONS.find((f) => f.id === 'tick')!;

async function setPaused(paused: boolean) {
  for (const config of FUNCTIONS) await functions.update(functionSettings(config, { paused }));
  console.log(paused ? 'The town is paused.' : 'The town is running. The tick function runs every minute.');
}

async function step() {
  const current = await functions.get({ functionId: tick.id });
  if (!current.enabled) await functions.update({ ...functionSettings(tick, { paused: true }), enabled: true });
  try {
    const execution = await functions.createExecution({ functionId: tick.id, async: false, method: ExecutionMethod.POST, path: '/' });
    console.log(`${execution.status} in ${execution.duration.toFixed(1)} s: ${execution.responseBody}`);
    if (execution.errors) console.log(execution.errors);
  } finally {
    if (!current.enabled) await functions.update(functionSettings(tick, { paused: true }));
  }
}

async function status() {
  const world = await tablesDB.getRow({ databaseId: DATABASE.id, tableId: 'world', rowId: 'world' });
  const hh = String(Math.floor(world.minuteOfDay / 60)).padStart(2, '0');
  const mm = String(world.minuteOfDay % 60).padStart(2, '0');
  console.log(`Tick ${world.tick}, day ${world.day}, ${hh}:${mm}, last tick ${world.lastTickAt ?? 'never'} (${world.lastTickMs ?? '-'} ms)`);
  for (const config of FUNCTIONS) {
    const fn = await functions.get({ functionId: config.id });
    console.log(`${fn.$id}: ${fn.enabled ? 'enabled' : 'disabled'}, schedule "${fn.schedule}"`);
  }
}

const command = process.argv[2];
try {
  if (command === 'start') await setPaused(false);
  else if (command === 'stop') await setPaused(true);
  else if (command === 'step') await step();
  else if (command === 'status') await status();
  else console.log('Usage: pnpm town start | stop | step | status');
} catch (err) {
  console.error(describeError(err));
  process.exitCode = 1;
}
