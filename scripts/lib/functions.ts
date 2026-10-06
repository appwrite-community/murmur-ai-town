import { Runtime } from 'node-appwrite';
import type { FunctionConfig } from '../schema.ts';

/**
 * The full settings of a function. A paused function is disabled and has no
 * schedule, so it never calls the model.
 */
export function functionSettings(config: FunctionConfig, { paused }: { paused: boolean }) {
  return {
    functionId: config.id,
    name: config.name,
    runtime: Runtime.Node22,
    execute: [],
    events: config.events,
    schedule: paused ? '' : config.schedule,
    timeout: config.timeout,
    scopes: config.scopes,
    enabled: !paused,
    logging: true,
    entrypoint: 'src/main.js',
    commands: 'npm install',
  };
}
