import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    createPreCutDatabase,
    dropPreCutDatabase,
    findCutStatement,
    readCutMigration,
    splitCutStatements
} from './support/cut-migration.ts';

const scratchName = `hospeda_cut_not_null_scratch_${process.pid}`;
const preCutName = `hospeda_cut_not_null_pre_${process.pid}`;
const tables = ['accommodations', 'gastronomies', 'experiences'] as const;
const required = ['publication_status', 'inactive_since', 'deadlines_version'] as const;
let scratchAdmin: Pool;
let scratch: Pool;
let preCut: Awaited<ReturnType<typeof createPreCutDatabase>>;

function connectionFor(database: string): string {
    const base = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!base) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
    const url = new URL(base);
    url.pathname = `/${database}`;
    return url.toString();
}

beforeAll(async () => {
    scratchAdmin = new Pool({ connectionString: connectionFor('postgres') });
    await scratchAdmin.query(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`);
    await scratchAdmin.query(`CREATE DATABASE "${scratchName}"`);
    const pkgDir = resolve(import.meta.dirname, '../..');
    execFileSync(
        process.execPath,
        [
            resolve(pkgDir, 'node_modules/tsx/dist/cli.mjs'),
            'node_modules/drizzle-kit/bin.cjs',
            'migrate',
            '--config',
            'drizzle.config.ts'
        ],
        {
            cwd: pkgDir,
            env: { ...process.env, HOSPEDA_DATABASE_URL: connectionFor(scratchName) },
            stdio: 'pipe',
            timeout: 180_000
        }
    );
    scratch = new Pool({ connectionString: connectionFor(scratchName) });
    preCut = await createPreCutDatabase({ name: preCutName });
    await preCut.database.query(`INSERT INTO users (id, slug, email)
        VALUES ('00000000-0000-4000-8000-000000000091', 'cut-null-owner', 'cut-null-owner@example.test')`);
    await preCut.database.query(`INSERT INTO destinations
        (id, destination_type, path, slug, name, summary, description, location)
        VALUES ('00000000-0000-4000-8000-000000000092', 'COUNTRY', '/null-test',
            'null-test', 'Null destination', 'Summary', 'Description', '{}'::jsonb)`);
    await preCut.database.query(`INSERT INTO accommodations
        (slug, name, summary, type, description, owner_id, destination_id,
         publication_status, inactive_since, deadlines_version)
        VALUES ('cut-null-accommodation', 'Null accommodation', 'Summary', 'CABIN', 'Description',
            '00000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000092',
            NULL, NULL, NULL)`);
}, 300_000);

afterAll(async () => {
    await scratch?.end();
    await scratchAdmin?.query(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`);
    await scratchAdmin?.end();
    if (preCut) await dropPreCutDatabase(preCut);
});

describe('TEST:V6:39 paso-3 NOT NULL migration', () => {
    it('migrates from zero with three required columns and no default on every listing table', async () => {
        const result = await scratch.query<{
            table_name: string;
            column_name: string;
            is_nullable: string;
            column_default: string | null;
        }>(
            `SELECT table_name, column_name, is_nullable, column_default
             FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = ANY($1::text[]) AND column_name = ANY($2::text[])`,
            [tables, [...required, 'deletion_announced_at']]
        );
        for (const table of tables) {
            for (const column of required) {
                const row = result.rows.find(
                    (item) => item.table_name === table && item.column_name === column
                );
                expect(row?.is_nullable, `${table}.${column}`).toBe('NO');
                expect(row?.column_default, `${table}.${column} default`).toBeNull();
            }
            const deletion = result.rows.find(
                (item) => item.table_name === table && item.column_name === 'deletion_announced_at'
            );
            expect(deletion?.is_nullable, `${table}.deletion_announced_at`).toBe('YES');
        }
    });

    it('rejects an unfilled row and leaves the prior nullable schema after rollback', async () => {
        const statements = splitCutStatements({ sql: readCutMigration() });
        const guard = findCutStatement({
            statements,
            fragment: 'Listing rows without publication state: accommodations'
        });
        const notNull = statements.filter(
            (statement) => statement.includes('ALTER COLUMN') && statement.includes('SET NOT NULL')
        );
        expect(notNull).toHaveLength(9);
        const client = await preCut.database.connect();
        try {
            await client.query('BEGIN');
            await expect(client.query(guard)).rejects.toThrow(
                'Listing rows without publication state'
            );
            for (const statement of notNull) expect(statement).toContain('SET NOT NULL');
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
        const result = await preCut.database.query<{ is_nullable: string }>(
            `SELECT is_nullable FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'accommodations' AND column_name = 'publication_status'`
        );
        expect(result.rows[0]?.is_nullable, 'accommodations.publication_status').toBe('YES');
    });
});
