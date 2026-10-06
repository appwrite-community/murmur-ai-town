export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls `check` until it returns a value, or throws after `timeoutMs`. */
export async function waitFor<T>(
  what: string,
  check: () => Promise<T | undefined>,
  { timeoutMs = 120_000, intervalMs = 1_000 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result !== undefined) return result;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}.`);
    await sleep(intervalMs);
  }
}
