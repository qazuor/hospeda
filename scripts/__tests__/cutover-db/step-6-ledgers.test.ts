import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { runDatabaseSide } from '../../cutover-v6/step-6/database-side.ts';
import { generateBaselineMigration } from '../../cutover-v6/step-6/generate-baseline.ts';
import {
    type LedgerBackups,
    readBaselineEntry,
    restoreLedgers,
    rewriteLedgers
} from '../../cutover-v6/step-6/ledgers.ts';
import { buildReferenceRowsSql } from '../../cutover-v6/step-6/reference-rows.ts';
import {
    assertRehearsalMatches,
    RehearsalMismatchError
} from '../../cutover-v6/step-6/rehearsal-gate.ts';
import {
    connect,
    createScratch,
    dropScratch,
    requireAdminUrl,
    withDatabase
} from './scratch-db.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const tempDirs: string[] = [];
afterAll(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function runDrizzleMigrate({
    url,
    outDir
}: {
    readonly url: string;
    readonly outDir: string;
}): Promise<void> {
    const configDir = mkdtempSync(path.join(tmpdir(), 'step6-drizzle-config-'));
    tempDirs.push(configDir);
    const configPath = path.join(configDir, 'drizzle.config.ts');
    writeFileSync(
        configPath,
        `export default { dialect: 'postgresql', schema: ${JSON.stringify(path.join(ROOT, 'packages/db/src/schemas'))}, out: ${JSON.stringify(outDir)}, dbCredentials: { url: ${JSON.stringify(url)} }, tablesFilter: ['!search_index'] };\n`
    );
    execFileSync('pnpm', ['exec', 'drizzle-kit', 'migrate', '--config', configPath], {
        cwd: path.join(ROOT, 'packages/db'),
        stdio: 'pipe'
    });
}

async function executeSql(
    client: { query(sql: string): Promise<unknown> },
    sql: string
): Promise<void> {
    for (const statement of sql.split('--> statement-breakpoint'))
        if (statement.trim()) await client.query(statement);
}

describe('TEST:V6:26 (ledgers)', () => {
    it('backs up, rewrites, refuses drift, and restores both histories transactionally', async () => {
        const adminUrl = requireAdminUrl();
        const admin = await connect({ url: adminUrl });
        const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
        const aName = `hospeda_v6_ledger_a_${suffix}`;
        const bName = `hospeda_v6_ledger_b_${suffix}`;
        const created: string[] = [];
        try {
            for (const name of [aName, bName]) {
                await createScratch({ admin, name });
                created.push(name);
            }
            const aUrl = withDatabase({ url: adminUrl, database: aName });
            const bUrl = withDatabase({ url: adminUrl, database: bName });
            const a = await connect({ url: aUrl });
            const b = await connect({ url: bUrl });
            try {
                await runDrizzleMigrate({
                    url: aUrl,
                    outDir: path.join(ROOT, 'packages/db/src/migrations')
                });
                execFileSync('node', ['packages/db/scripts/apply-postgres-extras.mjs', aUrl], {
                    cwd: ROOT,
                    stdio: 'pipe'
                });
                await a.query('DROP TABLE public.cutover_v6_deleted_listing');
                const seedRowsBefore = await a.query(
                    'SELECT * FROM public.seed_migrations ORDER BY name'
                );
                const seedInsert = await a.query(
                    "INSERT INTO public.seed_migrations (name, \"group\", checksum, duration_ms, result) VALUES ('test-ledger-a', 'required', 'a', 1, 'ok'), ('test-ledger-b', 'example', 'b', 2, 'ok') RETURNING *"
                );
                const oldMigrations = await a.query(
                    'SELECT * FROM drizzle.__drizzle_migrations ORDER BY id'
                );
                expect(oldMigrations.rows.length).toBeGreaterThan(100);
                const baselineDir = mkdtempSync(path.join(tmpdir(), 'step6-baseline-ledger-'));
                tempDirs.push(baselineDir);
                const baseline = generateBaselineMigration({ outDir: baselineDir });
                const reference = await buildReferenceRowsSql({ source: a });
                const fullSql = `${readFileSync(baseline.sqlPath, 'utf8').trim()}\n--> statement-breakpoint\n${reference}\n`;
                writeFileSync(baseline.sqlPath, fullSql);
                const entry = readBaselineEntry({ migrationsDir: baselineDir });
                expect(entry.hash).toBe(createHash('sha256').update(fullSql).digest('hex'));
                await executeSql(b, fullSql);
                execFileSync('node', ['packages/db/scripts/apply-postgres-extras.mjs', bUrl], {
                    cwd: ROOT,
                    stdio: 'pipe'
                });
                const originalSeedRows = [...seedRowsBefore.rows, ...seedInsert.rows];
                const stamp = new Date('2026-10-11T12:30:00.000Z');
                const expectedBackups = {
                    migrations: 'drizzle.__drizzle_migrations_bak_20261011123000000',
                    seed: 'public.seed_migrations_bak_20261011123000000'
                };
                await expect(
                    rewriteLedgers({
                        client: a,
                        entry,
                        now: stamp,
                        beforeCommit: async () => {
                            throw new Error('injected before commit');
                        }
                    })
                ).rejects.toThrow('injected before commit');
                expect(
                    (await a.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id')).rows
                ).toEqual(oldMigrations.rows);
                expect(
                    (await a.query('SELECT * FROM public.seed_migrations ORDER BY name')).rows
                ).toEqual(originalSeedRows);
                expect(
                    (
                        await a.query(
                            "SELECT to_regclass('drizzle.__drizzle_migrations_bak_20261011123000000') AS migrations, to_regclass('public.seed_migrations_bak_20261011123000000') AS seed"
                        )
                    ).rows[0]
                ).toEqual({ migrations: null, seed: null });

                const backup = await rewriteLedgers({ client: a, entry, now: stamp });
                expect({ migrations: backup.migrations, seed: backup.seed }).toEqual(
                    expectedBackups
                );
                expect(backup.migrationsCount).toBe(oldMigrations.rows.length);
                expect(backup.seedCount).toBe(seedRowsBefore.rows.length + 2);
                expect((await a.query(`SELECT * FROM ${backup.migrations}`)).rows).toEqual(
                    oldMigrations.rows
                );
                expect((await a.query(`SELECT * FROM ${backup.seed}`)).rows).toEqual(
                    originalSeedRows
                );
                expect(
                    (await a.query('SELECT hash, created_at FROM drizzle.__drizzle_migrations'))
                        .rows
                ).toEqual([{ hash: entry.hash, created_at: String(baseline.when) }]);
                expect((await a.query('SELECT * FROM public.seed_migrations')).rows).toEqual([]);
                const beforeMigrate = await a.query('SELECT * FROM drizzle.__drizzle_migrations');
                const beforeFingerprint = await (
                    await import('../../cutover-v6/step-6/schema-fingerprint.ts')
                ).fingerprintSchema({ client: a });
                await runDrizzleMigrate({ url: aUrl, outDir: baselineDir });
                expect((await a.query('SELECT * FROM drizzle.__drizzle_migrations')).rows).toEqual(
                    beforeMigrate.rows
                );
                expect(
                    await (
                        await import('../../cutover-v6/step-6/schema-fingerprint.ts')
                    ).fingerprintSchema({ client: a })
                ).toEqual(beforeFingerprint);

                await a.query('UPDATE drizzle.__drizzle_migrations SET created_at = $1', [
                    baseline.when - 1
                ]);
                await expect(
                    runDrizzleMigrate({ url: aUrl, outDir: baselineDir })
                ).rejects.toThrow();
                await a.query('UPDATE drizzle.__drizzle_migrations SET created_at = $1', [
                    baseline.when
                ]);
                expect(
                    (await a.query('SELECT hash, created_at FROM drizzle.__drizzle_migrations'))
                        .rows
                ).toEqual([{ hash: entry.hash, created_at: String(baseline.when) }]);

                const newDir = mkdtempSync(path.join(tmpdir(), 'step6-new-migration-'));
                tempDirs.push(newDir);
                execFileSync('cp', ['-R', `${baselineDir}/.`, newDir]);
                const newer = {
                    ...baseline,
                    tag: '0001_after_baseline',
                    when: baseline.when + 1000
                };
                const newerSql =
                    'CREATE TABLE public.step6_new_migration_probe (id integer PRIMARY KEY);\n';
                writeFileSync(path.join(newDir, `${newer.tag}.sql`), newerSql);
                const journalPath = path.join(newDir, 'meta/_journal.json');
                const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
                    entries: unknown[];
                };
                journal.entries.push({
                    idx: 1,
                    version: '7',
                    when: newer.when,
                    tag: newer.tag,
                    breakpoints: true
                });
                writeFileSync(journalPath, JSON.stringify(journal, null, 2));
                await runDrizzleMigrate({ url: aUrl, outDir: newDir });
                expect(
                    (
                        await a.query(
                            'SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations'
                        )
                    ).rows[0]?.count
                ).toBe(2);
                expect(
                    (
                        await a.query(
                            "SELECT to_regclass('public.step6_new_migration_probe') AS name"
                        )
                    ).rows[0]?.name
                ).toBe('step6_new_migration_probe');

                await assertRehearsalMatches({ cutClient: a, builtClient: b });
                await b.query('DROP INDEX public."catalog_key_slug_idx"');
                await expect(
                    assertRehearsalMatches({ cutClient: a, builtClient: b })
                ).rejects.toMatchObject({
                    name: 'RehearsalMismatchError',
                    differences: expect.arrayContaining([
                        expect.stringContaining('catalog_key_slug_idx')
                    ])
                });
                const fullBackup = path.join(baselineDir, 'database.dump');
                writeFileSync(fullBackup, 'test backup placeholder');
                await expect(
                    runDatabaseSide({
                        targetUrl: aUrl,
                        builtUrl: bUrl,
                        migrationsDir: baselineDir,
                        confirmFullBackup: fullBackup,
                        connect: async ({ url }) => (url === aUrl ? a : b)
                    })
                ).rejects.toBeInstanceOf(RehearsalMismatchError);
                expect(
                    (await a.query('SELECT * FROM drizzle.__drizzle_migrations')).rows
                ).toHaveLength(2);
                await expect(
                    runDatabaseSide({
                        targetUrl: aUrl,
                        builtUrl: bUrl,
                        migrationsDir: baselineDir,
                        connect: async ({ url }) => (url === aUrl ? a : b)
                    })
                ).rejects.toThrow('confirm-full-backup');
                const emptyBackup = path.join(baselineDir, 'empty.dump');
                writeFileSync(emptyBackup, '');
                await expect(
                    runDatabaseSide({
                        targetUrl: aUrl,
                        builtUrl: bUrl,
                        migrationsDir: baselineDir,
                        confirmFullBackup: emptyBackup,
                        connect: async ({ url }) => (url === aUrl ? a : b)
                    })
                ).rejects.toThrow('non-empty');

                const passage = await a.query(
                    'CREATE TABLE public.cutover_v6_deleted_listing (id integer)'
                );
                expect(passage).toBeDefined();
                await expect(
                    rewriteLedgers({
                        client: a,
                        entry: readBaselineEntry({ migrationsDir: baselineDir })
                    })
                ).rejects.toThrow('cutover_v6_deleted_listing');
                await a.query('DROP TABLE public.cutover_v6_deleted_listing');

                const originalLedger = oldMigrations.rows;
                const originalSeed = originalSeedRows;
                await restoreLedgers({ client: a, backups: backup as LedgerBackups });
                expect(
                    (await a.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id')).rows
                ).toEqual(originalLedger);
                expect(
                    (await a.query('SELECT * FROM public.seed_migrations ORDER BY name')).rows
                ).toEqual(originalSeed);

                await expect(
                    rewriteLedgers({
                        client: a,
                        entry,
                        now: new Date('2026-10-11T12:31:00.000Z'),
                        afterCommitVerify: async () => {
                            throw new Error('injected after commit');
                        }
                    })
                ).rejects.toThrow('original ledgers were restored');
                expect(
                    (await a.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id')).rows
                ).toEqual(originalLedger);
                expect(
                    (await a.query('SELECT * FROM public.seed_migrations ORDER BY name')).rows
                ).toEqual(originalSeed);
            } finally {
                await Promise.all([a.end(), b.end()]);
            }
        } finally {
            for (const name of created) await dropScratch({ admin, name });
            await admin.end();
        }
    });
});
