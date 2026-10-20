// TEST:V6:23 — the cutover passage table belongs to the migration SQL, outside
// the Drizzle schema, and stays absent from the schema drift model.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { protectScratchPool, waitForNoConnections } from './support/scratch-database.ts';

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT_DIR = resolve(PACKAGE_DIR, '../..');
const SCRATCH_DB = `hospeda_scratch_cutover_passage_${process.pid}`;
const EXPECTED_COLUMNS = ['calendar_tokens', 'entity_id', 'entity_type', 'photos', 'slug'];
const PASSAGE_TABLE = 'cutover_v6_deleted_listing';

interface ColumnRow {
    readonly column_name: string;
}

function urlFor({ database }: { readonly database: string }): string {
    const base = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!base) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
    const url = new URL(base);
    url.pathname = `/${database}`;
    return url.toString();
}

function filesUnder({ directory }: { readonly directory: string }): readonly string[] {
    return readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => resolve(entry.parentPath, entry.name));
}

async function extrasFingerprint(): Promise<string> {
    const [relations, constraints, triggers, routines] = await Promise.all([
        scratch.query(
            `SELECT c.relname, c.relkind, c.reloptions
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' ORDER BY c.relname, c.relkind`
        ),
        scratch.query(
            `SELECT conname, contype, pg_get_constraintdef(oid)
             FROM pg_constraint WHERE connamespace = 'public'::regnamespace
             ORDER BY conname, contype`
        ),
        scratch.query(
            `SELECT tgname, pg_get_triggerdef(oid)
             FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname`
        ),
        scratch.query(
            `SELECT p.proname, pg_get_function_identity_arguments(p.oid), pg_get_functiondef(p.oid)
             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)`
        )
    ]);
    return JSON.stringify([relations.rows, constraints.rows, triggers.rows, routines.rows]);
}

let admin: Pool;
let scratch: Pool;

beforeAll(async () => {
    admin = new Pool({ connectionString: urlFor({ database: 'postgres' }) });
    await waitForNoConnections({ admin, database: SCRATCH_DB });
    await admin.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${SCRATCH_DB}"`);
    execFileSync(
        process.execPath,
        [
            resolve(PACKAGE_DIR, 'node_modules/tsx/dist/cli.mjs'),
            'node_modules/drizzle-kit/bin.cjs',
            'migrate',
            '--config',
            'drizzle.config.ts'
        ],
        {
            cwd: PACKAGE_DIR,
            env: { ...process.env, HOSPEDA_DATABASE_URL: urlFor({ database: SCRATCH_DB }) },
            stdio: 'pipe',
            timeout: 180_000
        }
    );
    const extrasScript = resolve(PACKAGE_DIR, 'scripts/apply-postgres-extras.mjs');
    const scratchUrl = urlFor({ database: SCRATCH_DB });
    execFileSync('node', [extrasScript, scratchUrl], {
        cwd: ROOT_DIR,
        stdio: 'pipe',
        timeout: 60_000
    });
    scratch = new Pool({ connectionString: scratchUrl });
    protectScratchPool({ pool: scratch });
}, 240_000);

afterAll(async () => {
    await scratch?.end();
    if (admin) {
        await waitForNoConnections({ admin, database: SCRATCH_DB });
        await admin.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}" WITH (FORCE)`);
        await admin.end();
    }
});

describe('TEST:V6:23 cutover passage table from empty', () => {
    it('has exactly five columns and the entity type/id primary key', async () => {
        const columns = await scratch.query<ColumnRow>(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = $1 ORDER BY column_name`,
            [PASSAGE_TABLE]
        );
        expect(columns.rows.map((row) => row.column_name)).toEqual(EXPECTED_COLUMNS);

        const primaryKey = await scratch.query<{ readonly columns: string[] }>(
            `SELECT json_agg(a.attname ORDER BY key.ordinality) AS columns
             FROM pg_constraint constraint_row
             CROSS JOIN LATERAL unnest(constraint_row.conkey) WITH ORDINALITY AS key(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid = constraint_row.conrelid AND a.attnum = key.attnum
             WHERE constraint_row.conrelid = $1::regclass AND constraint_row.contype = 'p'
             GROUP BY constraint_row.oid`,
            [PASSAGE_TABLE]
        );
        expect(primaryKey.rows).toEqual([{ columns: ['entity_type', 'entity_id'] }]);
    });

    it('is absent from Drizzle schemas and the 0148 snapshot', () => {
        const schemaFiles = filesUnder({ directory: resolve(PACKAGE_DIR, 'src/schemas') });
        expect(
            schemaFiles.filter((path) => readFileSync(path, 'utf8').includes(PASSAGE_TABLE))
        ).toEqual([]);
        const snapshot = readFileSync(
            resolve(PACKAGE_DIR, 'src/migrations/meta/0148_snapshot.json'),
            'utf8'
        );
        expect(snapshot).not.toContain(PASSAGE_TABLE);
    });

    it('has no foreign keys', async () => {
        const result = await scratch.query<{ readonly count: string }>(
            `SELECT count(*)::text AS count FROM pg_constraint
             WHERE conrelid = $1::regclass AND contype = 'f'`,
            [PASSAGE_TABLE]
        );
        expect(result.rows[0]?.count).toBe('0');
    });

    it('keeps the extras schema unchanged when applied twice', async () => {
        const extrasScript = resolve(PACKAGE_DIR, 'scripts/apply-postgres-extras.mjs');
        const scratchUrl = urlFor({ database: SCRATCH_DB });
        const afterFirstApply = await extrasFingerprint();
        execFileSync('node', [extrasScript, scratchUrl], {
            cwd: ROOT_DIR,
            stdio: 'pipe',
            timeout: 60_000
        });
        const afterSecondApply = await extrasFingerprint();
        expect(afterSecondApply).toBe(afterFirstApply);
    });
});
