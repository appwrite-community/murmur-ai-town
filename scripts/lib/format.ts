import { createHash } from 'node:crypto';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export const money = (cents: number) => usd.format(cents / 100);
export const shortDate = (ms: number) => monthDay.format(new Date(ms));
export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A stable pseudo-random code, so seeding twice writes the same values. */
export function stableCode(seed: string, length: number): string {
  const bytes = createHash('sha256').update(seed).digest();
  return Array.from({ length }, (_, i) => BASE32[bytes[i]! % BASE32.length]).join('');
}

/** A stable ID in the same shape as the IDs Appwrite generates. */
export const stableId = (seed: string) => createHash('sha256').update(seed).digest('hex').slice(0, 20);
