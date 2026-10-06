// Creates or updates every Appwrite resource Murmur needs and deploys the Site
// and both functions. Safe to run again: existing resources are kept, and
// missing columns and indexes are added. The town starts paused: run
// `pnpm town start` to schedule the tick function.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Adapter, BuildRuntime, Framework, ID, OrderBy, Query, TablesDBIndexType } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { create as createTarball } from 'tar';
import { createIfMissing, describeError, functions, project, proxy, sites, tablesDB } from './lib/client.ts';
import { env } from './lib/env.ts';
import { functionSettings } from './lib/functions.ts';
import { waitFor } from './lib/wait.ts';
import { DATABASE, FUNCTIONS, SITE, TABLES, type Column, type FunctionConfig, type Table } from './schema.ts';

const databaseId = DATABASE.id;
const root = join(import.meta.dirname, '..');

function createColumn(tableId: string, column: Column) {
  const base = { databaseId, tableId, key: column.key, required: column.required };
  switch (column.type) {
    case 'varchar':
      return tablesDB.createVarcharColumn({ ...base, size: column.size, array: column.array });
    case 'text':
      return tablesDB.createTextColumn(base);
    case 'integer':
      return tablesDB.createIntegerColumn({ ...base, min: column.min, max: column.max, xdefault: column.required ? undefined : column.default });
    case 'datetime':
      return tablesDB.createDatetimeColumn(base);
    case 'enum':
      return tablesDB.createEnumColumn({ ...base, elements: column.elements, xdefault: column.required ? undefined : column.default });
  }
}

async function provisionTable(table: Table) {
  const tableId = table.id;
  const settings = { databaseId, tableId, name: table.name, permissions: table.permissions, rowSecurity: table.rowSecurity };
  const created = await createIfMissing(() => tablesDB.createTable(settings));
  if (!created) await tablesDB.updateTable(settings);

  const { columns: existing } = await tablesDB.listColumns({ databaseId, tableId, queries: [Query.limit(100)] });
  const existingKeys = new Set(existing.map((column) => column.key));
  for (const column of table.columns) {
    if (!existingKeys.has(column.key)) await createColumn(tableId, column);
  }
  await waitFor(`columns of ${tableId}`, async () => {
    const { columns } = await tablesDB.listColumns({ databaseId, tableId, queries: [Query.limit(100)] });
    const failed = columns.find((column) => column.status === 'failed');
    if (failed) throw new Error(`Column ${tableId}.${failed.key} failed: ${failed.error}`);
    return columns.every((column) => column.status === 'available') ? true : undefined;
  });

  const { indexes: existingIndexes } = await tablesDB.listIndexes({ databaseId, tableId });
  const existingIndexKeys = new Set(existingIndexes.map((index) => index.key));
  for (const index of table.indexes) {
    if (existingIndexKeys.has(index.key)) continue;
    await tablesDB.createIndex({
      databaseId,
      tableId,
      key: index.key,
      type: index.type === 'unique' ? TablesDBIndexType.Unique : TablesDBIndexType.Key,
      columns: index.columns,
      orders: index.orders?.map((order) => (order === 'desc' ? OrderBy.Desc : OrderBy.Asc)),
    });
  }
  await waitFor(`indexes of ${tableId}`, async () => {
    const { indexes } = await tablesDB.listIndexes({ databaseId, tableId });
    const failed = indexes.find((index) => index.status === 'failed');
    if (failed) throw new Error(`Index ${tableId}.${failed.key} failed: ${failed.error}`);
    return indexes.every((index) => index.status === 'available') ? true : undefined;
  });
  console.log(`Table ${tableId}`);
}

/** Lets the browser call this project from `pnpm dev` on localhost and from the Site's domain. */
async function provisionWebPlatforms(hostnames: string[]) {
  const { platforms } = await project.listPlatforms();
  const existing = new Set(platforms.map((platform) => ('hostname' in platform ? platform.hostname : '')));
  for (const hostname of hostnames) {
    if (!existing.has(hostname)) {
      await project.createWebPlatform({ platformId: ID.unique(), name: `Murmur (${hostname})`, hostname });
    }
    console.log(`Web platform ${hostname}`);
  }
}

/** Packages a directory (without node_modules, dist, tests, and local env files) into a tarball. */
async function pack(dir: string, name: string) {
  const workDir = mkdtempSync(join(tmpdir(), `${name}-`));
  const tarball = join(workDir, 'code.tar.gz');
  await createTarball(
    { gzip: true, file: tarball, cwd: dir, filter: (path) => !/(^|\/)(node_modules|dist|test|\.env[^/]*)(\/|$)/.test(path) },
    ['.'],
  );
  return { tarball, cleanup: () => rmSync(workDir, { recursive: true, force: true }) };
}

async function waitForBuild(label: string, get: () => Promise<{ $id: string; status: string; buildLogs: string }>) {
  const ready = await waitFor(
    `deployment of ${label}`,
    async () => {
      const current = await get();
      if (current.status === 'failed' || current.status === 'canceled') {
        throw new Error(`Build of ${label} ${current.status}:\n${current.buildLogs}`);
      }
      return current.status === 'ready' ? current : undefined;
    },
    { timeoutMs: 600_000, intervalMs: 3_000 },
  );
  console.log(`${label}: deployment ${ready.$id} is ready`);
}

async function upsertVariable(functionId: string, key: string, value: string | undefined) {
  if (!value) {
    console.log(`  ${functionId}: ${key} is not set in your environment, keeping the current value`);
    return;
  }
  const { variables } = await functions.listVariables({ functionId });
  const existing = variables.find((variable) => variable.key === key);
  if (existing) await functions.updateVariable({ functionId, variableId: existing.$id, key, value, secret: true });
  else await functions.createVariable({ functionId, variableId: ID.unique(), key, value, secret: true });
}

async function provisionFunction(config: FunctionConfig) {
  const created = await createIfMissing(() => functions.create(functionSettings(config, { paused: true })));
  if (!created) {
    // Keep the current paused or running state when provisioning again.
    const current = await functions.get({ functionId: config.id });
    await functions.update(functionSettings(config, { paused: !current.enabled }));
  }
  await upsertVariable(config.id, 'OPENROUTER_API_KEY', process.env.OPENROUTER_API_KEY);

  const { tarball, cleanup } = await pack(join(root, config.dir), config.id);
  try {
    const deployment = await functions.createDeployment({
      functionId: config.id,
      code: InputFile.fromPath(tarball, 'code.tar.gz'),
      activate: true,
    });
    await waitForBuild(`Function ${config.id}`, () => functions.getDeployment({ functionId: config.id, deploymentId: deployment.$id }));
  } finally {
    cleanup();
  }
}

/** The game, built by Appwrite from apps/web and served as a static Site. */
async function provisionSite() {
  const settings = {
    siteId: SITE.id,
    name: SITE.name,
    framework: Framework.Vite,
    buildRuntime: BuildRuntime.Node22,
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    outputDirectory: './dist',
    adapter: Adapter.Static,
    fallbackFile: 'index.html',
  };
  const created = await createIfMissing(() => sites.create(settings));
  if (!created) await sites.update(settings);

  const { variables } = await sites.listVariables({ siteId: SITE.id });
  for (const [key, value] of [['VITE_APPWRITE_ENDPOINT', env.endpoint], ['VITE_APPWRITE_PROJECT_ID', env.projectId]]) {
    const existing = variables.find((variable) => variable.key === key);
    if (existing) await sites.updateVariable({ siteId: SITE.id, variableId: existing.$id, key, value, secret: false });
    else await sites.createVariable({ siteId: SITE.id, variableId: ID.unique(), key, value, secret: false });
  }

  const { tarball, cleanup } = await pack(join(root, 'apps', 'web'), SITE.id);
  try {
    const deployment = await sites.createDeployment({ siteId: SITE.id, code: InputFile.fromPath(tarball, 'code.tar.gz'), activate: true });
    await waitForBuild(`Site ${SITE.id}`, () => sites.getDeployment({ siteId: SITE.id, deploymentId: deployment.$id }));
  } finally {
    cleanup();
  }

  const wanted = process.env.SITE_DOMAIN;
  const { rules } = await proxy.listRules({ queries: [Query.equal('deploymentResourceId', [SITE.id])] });
  if (wanted && !rules.some((rule) => rule.domain === wanted)) await proxy.createSiteRule({ domain: wanted, siteId: SITE.id });
  const domain = wanted ?? rules.map((rule) => rule.domain).sort((a, b) => a.length - b.length)[0];
  if (domain) {
    console.log(`Site URL ${env.endpoint.startsWith('http://') ? 'http' : 'https'}://${domain}`);
    return domain;
  }
  return undefined;
}

const onlySite = process.argv.includes('--only-site');
try {
  if (!onlySite) {
    await createIfMissing(() => tablesDB.create({ databaseId, name: DATABASE.name }));
    console.log(`Database ${databaseId}`);
    for (const table of TABLES) await provisionTable(table);
    for (const config of FUNCTIONS) await provisionFunction(config);
  }
  const domain = process.argv.includes('--skip-site') ? undefined : await provisionSite();
  await provisionWebPlatforms(['localhost', ...(domain ? [domain] : [])]);
  console.log('Done. Next: pnpm seed, then pnpm town start');
} catch (err) {
  console.error(`Provisioning failed: ${describeError(err)}`);
  process.exitCode = 1;
}
