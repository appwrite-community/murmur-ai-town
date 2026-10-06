import { Client, Functions, Messaging, Project, Proxy, Sites, TablesDB, Teams, Users } from 'node-appwrite';
import { env } from './env.ts';

export const client = new Client()
  .setEndpoint(env.endpoint)
  .setProject(env.projectId)
  .setKey(env.apiKey);

export const tablesDB = new TablesDB(client);
export const functions = new Functions(client);
export const teams = new Teams(client);
export const users = new Users(client);
export const project = new Project(client);
export const sites = new Sites(client);
export const proxy = new Proxy(client);
export const messaging = new Messaging(client);

/** Runs a create call and treats "already exists" (409) as success. */
export async function createIfMissing<T>(create: () => Promise<T>): Promise<T | undefined> {
  try {
    return await create();
  } catch (err) {
    if (isConflict(err)) return undefined;
    throw err;
  }
}

export function isConflict(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 409;
}

/** Logs only the safe fields of an Appwrite error (never the raw response). */
export function describeError(err: unknown): string {
  if (typeof err !== 'object' || err === null) return String(err);
  const { code, type, message } = err as { code?: number; type?: string; message?: string };
  return [code, type, message].filter(Boolean).join(' ');
}
