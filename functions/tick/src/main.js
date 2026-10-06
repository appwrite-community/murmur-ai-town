// One tick of the town: runs every minute on a schedule.
import { Client, TablesDB } from 'node-appwrite';
import { completeJson } from './llm.js';
import { conversationPrompt, planPrompt } from './prompts.js';
import { pairConversations, sharedRumorIds, validateConversations, validatePlan } from './rules.js';
import { buildOperations, commitTick } from './commit.js';
import { DATABASE_ID, loadRumorKnowledge, loadTown, nextClock } from './town.js';

export default async (context) => {
  try {
    return await tick(context);
  } catch (err) {
    // Log the network cause too: fetch errors hide it in err.cause.
    const causes = [err.cause, ...(err.cause?.errors ?? [])].filter(Boolean);
    const detail = causes.map((c) => [c.code, c.errno, c.syscall, c.address, c.port, c.hostname].filter(Boolean).join(' ')).join('; ');
    context.error(`Tick failed: ${err.message}${detail ? ` (cause: ${detail}; endpoint ${process.env.APPWRITE_FUNCTION_API_ENDPOINT})` : ''}`);
    throw err;
  }
};

async function tick({ req, res, log, error }) {
  const started = Date.now();
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);
  const tablesDB = new TablesDB(client);

  const ctx = await loadTown(tablesDB);
  const next = nextClock(ctx.world);

  // 1. Every resident gets one action from the closed set.
  const plan = await completeJson({ ...planPrompt(ctx), log });
  const { planned, rejected } = validatePlan(plan.actions, ctx);
  const conversations = pairConversations(planned, ctx.residents);

  // 2. Residents who meet talk, and may pass on rumors they know.
  let talks = [];
  let knowledge = new Map();
  if (conversations.length > 0) {
    const raw = await completeJson({ ...conversationPrompt(ctx, conversations), log });
    // Check shared rumors against every memory in the table, not only the ones in the prompt.
    knowledge = await loadRumorKnowledge(tablesDB, sharedRumorIds(raw.conversations));
    const checked = validateConversations(raw.conversations, conversations, knowledge);
    talks = checked.results;
    rejected.push(...checked.rejected);
  }

  // 3. Write the whole tick in one transaction.
  const stats = { startedAt: new Date(started).toISOString(), ms: Date.now() - started, rejected: rejected.length };
  const operations = buildOperations({ ctx, next, planned, talks, knowledge, stats });
  try {
    await commitTick(tablesDB, operations);
  } catch (err) {
    // A conflict is a harmless overlap only when another run wrote this tick.
    const written = err.type === 'transaction_conflict'
      && (await tablesDB.getRow({ databaseId: DATABASE_ID, tableId: 'ticks', rowId: `tick-${next.tick}` }).catch(() => null));
    if (written) {
      log(`Tick ${next.tick} was already written by another run. Nothing changed.`);
      return res.json({ tick: next.tick, skipped: true });
    }
    error(`Tick ${next.tick} failed: ${err.message}`);
    throw err;
  }

  for (const reason of rejected) log(`Replaced: ${JSON.stringify(reason)}`);
  log(`Tick ${next.tick}: ${operations.length} operations, ${talks.length} conversations, ${rejected.length} replaced, ${Date.now() - started} ms`);
  return res.json({ tick: next.tick, operations: operations.length, conversations: talks.length, rejected: rejected.length, ms: Date.now() - started });
}
