// TEST:V6:15 — the schema walk over a database built from empty: every table hanging from a
// listing (FK to accommodations, gastronomies or experiences, or an `entity_type` column) has a
// row in the PURGED closed list that GUARD:G-R9 reads (scripts/guards/purged-closed-list.json).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { protectScratchPool, waitForNoConnections } from './support/scratch-database.ts';

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT_DIR = resolve(PACKAGE_DIR, '../..');
const SCRATCH_DB = `hospeda_scratch_purged_list_${process.pid}`;
const LIST_PATH = resolve(ROOT_DIR, 'scripts/guards/purged-closed-list.json');

/**
 * The cutover passage table is excluded by name: "La tabla de paso del corte no entra en su
 * recorrido" (catalog GUARD:G-R9; `.specs/HOS-1352-billing-verticals-redesign/
 * spec-consolidada/10-corte/V6.md:49-51`). It lives only in the SQL of the cutover migration,
 * outside the Drizzle schema, but a database built from the migrations does have it.
 */
const PASSAGE_TABLE = 'cutover_v6_deleted_listing';

/** The 9 legacy `entity_type` tables, `fix_request` (the spec's `pedido_de_arreglo`) and `domain_event`. */
const EXPECTED_ENTITY_TYPE = [
    'domain_event',
    'entity_comments',
    'entity_view_monthly_rollups',
    'entity_views',
    'fix_request',
    'qr_codes',
    'r_entity_tag',
    'revalidation_config',
    'revalidation_log',
    'social_audit_log',
    'user_bookmarks'
] as const;

interface ListRow {
    readonly table: string;
    readonly hangsBy: 'fk' | 'entity_type' | 'none';
}

interface TableRow {
    readonly table_name: string;
}

function urlFor({ database }: { readonly database: string }): string {
    const base = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!base) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
    const url = new URL(base);
    url.pathname = `/${database}`;
    return url.toString();
}

function readList(): readonly ListRow[] {
    return JSON.parse(readFileSync(LIST_PATH, 'utf8')) as readonly ListRow[];
}

let admin: Pool;
let scratch: Pool;
let byFk: readonly string[] = [];
let byEntityType: readonly string[] = [];

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
    const scratchUrl = urlFor({ database: SCRATCH_DB });
    execFileSync('node', [resolve(PACKAGE_DIR, 'scripts/apply-postgres-extras.mjs'), scratchUrl], {
        cwd: ROOT_DIR,
        stdio: 'pipe',
        timeout: 60_000
    });
    scratch = new Pool({ connectionString: scratchUrl });
    protectScratchPool({ pool: scratch });

    const fk = await scratch.query<TableRow>(
        `SELECT DISTINCT c.relname AS table_name
         FROM pg_constraint k
         JOIN pg_class c ON c.oid = k.conrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_class target ON target.oid = k.confrelid
         WHERE k.contype = 'f' AND n.nspname = 'public'
           AND target.relname IN ('accommodations', 'gastronomies', 'experiences')
         ORDER BY c.relname`
    );
    byFk = fk.rows.map((row) => row.table_name);
    const entityType = await scratch.query<TableRow>(
        `SELECT DISTINCT c.table_name
         FROM information_schema.columns c
         JOIN information_schema.tables t
           ON t.table_schema = c.table_schema AND t.table_name = c.table_name
         WHERE c.table_schema = 'public' AND c.column_name = 'entity_type'
           AND t.table_type = 'BASE TABLE'
         ORDER BY c.table_name`
    );
    byEntityType = entityType.rows.map((row) => row.table_name);
}, 240_000);

afterAll(async () => {
    await scratch?.end();
    if (admin) {
        await waitForNoConnections({ admin, database: SCRATCH_DB });
        await admin.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}" WITH (FORCE)`);
        await admin.end();
    }
});

describe('TEST:V6:15 the schema walk over a database built from empty', () => {
    it('finds 29 tables by FK and the 11 expected by entity_type, plus the passage table', () => {
        expect(byFk).toHaveLength(29);
        // The passage table is seen by the catalog walk and excluded by name (see PASSAGE_TABLE).
        expect(byEntityType).toContain(PASSAGE_TABLE);
        expect(byFk).not.toContain(PASSAGE_TABLE);
        const walked = byEntityType.filter((table) => table !== PASSAGE_TABLE);
        expect(walked).toEqual([...EXPECTED_ENTITY_TYPE]);
    });

    it('has a PURGED closed list row for every walked table', () => {
        const listed = new Set(readList().map((row) => row.table));
        const walked = [...byFk, ...byEntityType].filter((table) => table !== PASSAGE_TABLE);
        expect(walked.filter((table) => !listed.has(table))).toEqual([]);
    });

    it('matches what the list marks as hanging by fk and by entity_type', () => {
        const list = readList();
        const listFk = list.filter((row) => row.hangsBy === 'fk').map((row) => row.table);
        const listEntityType = list
            .filter((row) => row.hangsBy === 'entity_type')
            .map((row) => row.table);
        expect([...byFk].sort()).toEqual([...listFk].sort());
        const walkedEntityType = byEntityType.filter(
            (table) => table !== PASSAGE_TABLE && !byFk.includes(table)
        );
        expect([...walkedEntityType].sort()).toEqual([...listEntityType].sort());
    });
});
