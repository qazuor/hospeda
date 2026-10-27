// TEST:V6:17 (AC:V6:16, HOS-1478 — V6.8a) — the listing publication model, FROM
// SCRATCH.
//
// A database built with the branch's migrations, from empty, carries the model of
// `V/02` §2.5 on the three listing tables (`accommodations`, `gastronomies`,
// `experiences`): the `publication_status` state of `V/03` §9 with its six
// values, `inactive_since` (spec `inactiva_desde`), `deadlines_version` (spec
// `plazos_version`), `deletion_announced_at` (spec `borrado_anunciado`, nullable),
// `owner_id` NOT NULL; and `fix_request` (spec `pedido_de_arreglo`) with its
// partial unique index: at most one OPEN request per listing.
//
// V6.8a added the publication columns as nullable. V6.9 fills them through
// write `C` and enforces NOT NULL without a default. V6.9b (HOS-1641) drops the
// six legacy columns — `lifecycle_state`, `visibility` and `moderation_state` on
// the three tables, plus `owner_suspended`, `plan_restricted` and
// `billing_unpublished_at` on `accommodations` — and indexes
// `publication_status` (alone and with `destination_id`) on each table.
//
// Self-contained on purpose: it creates its OWN uniquely named database, applies
// the chain with real `drizzle-kit migrate`, and drops only that database.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { protectScratchPool, waitForNoConnections } from './support/scratch-database.ts';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH_DB = `hospeda_scratch_listing_model_${process.pid}`;

const LISTING_TABLES = ['accommodations', 'gastronomies', 'experiences'] as const;

const PUBLICATION_STATUSES = [
    'DRAFT',
    'PUBLISHED',
    'UNPUBLISHED_BY_BILLING',
    'ARCHIVED',
    'MODERATED',
    'PURGED'
] as const;

interface ColumnRow {
    readonly column_name: string;
    readonly is_nullable: 'YES' | 'NO';
    readonly column_default: string | null;
    readonly data_type: string;
    readonly udt_name: string;
}

function urlFor({ database }: { readonly database: string }): string {
    const base = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!base) throw new Error('HOSPEDA_TEST_DATABASE_URL is not set');
    const url = new URL(base);
    url.pathname = `/${database}`;
    return url.toString();
}

async function columnsOf({
    table
}: {
    readonly table: string;
}): Promise<ReadonlyMap<string, ColumnRow>> {
    const result = await scratch.query<ColumnRow>(
        `SELECT column_name, is_nullable, column_default, data_type, udt_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [table]
    );
    return new Map(result.rows.map((row) => [row.column_name, row]));
}

let admin: Pool;
let scratch: Pool;

beforeAll(async () => {
    admin = new Pool({ connectionString: urlFor({ database: 'postgres' }) });
    await admin.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}"`);
    await admin.query(`CREATE DATABASE "${SCRATCH_DB}"`);
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
            env: { ...process.env, HOSPEDA_DATABASE_URL: urlFor({ database: SCRATCH_DB }) },
            stdio: 'pipe',
            timeout: 180_000
        }
    );
    scratch = new Pool({ connectionString: urlFor({ database: SCRATCH_DB }) });
    protectScratchPool({ pool: scratch });
}, 200_000);

afterAll(async () => {
    await scratch?.end();
    await waitForNoConnections({ admin, database: SCRATCH_DB });
    await admin?.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}" WITH (FORCE)`);
    await admin?.end();
});

describe('the publication_status enum (TEST:V6:17)', () => {
    it('has exactly the six states of V/03 §9, in order', async () => {
        const result = await scratch.query<{ label: string }>(
            `SELECT e.enumlabel AS label
             FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'publication_status_enum'
             ORDER BY e.enumsortorder`
        );
        expect(result.rows.map((row) => row.label)).toEqual([...PUBLICATION_STATUSES]);
    });
});

/** The twelve (table, column) pairs that V6.9b dropped. */
const DROPPED_COLUMNS: ReadonlyArray<readonly [string, string]> = [
    ...LISTING_TABLES.flatMap((table) =>
        ['lifecycle_state', 'visibility', 'moderation_state'].map(
            (column) => [table, column] as const
        )
    ),
    ['accommodations', 'owner_suspended'],
    ['accommodations', 'plan_restricted'],
    ['accommodations', 'billing_unpublished_at']
];

describe('the six legacy listing columns are gone (TEST:V6:17, HOS-1641)', () => {
    it('no listing table carries any of the twelve dropped (table, column) pairs', async () => {
        const result = await scratch.query<{ table_name: string; column_name: string }>(
            `SELECT table_name, column_name
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
            [[...LISTING_TABLES]]
        );
        const present = new Set(result.rows.map((row) => `${row.table_name}.${row.column_name}`));
        expect(DROPPED_COLUMNS).toHaveLength(12);
        // Sanity: the query does see the listing tables.
        expect(present.has('accommodations.publication_status')).toBe(true);
        expect(
            DROPPED_COLUMNS.map(([table, column]) => `${table}.${column}`).filter((pair) =>
                present.has(pair)
            )
        ).toEqual([]);
    });

    it.each(
        LISTING_TABLES
    )('%s has the two publication_status indexes that replaced the old ones', async (table) => {
        const result = await scratch.query<{ indexname: string; indexdef: string }>(
            `SELECT indexname, indexdef FROM pg_indexes
                 WHERE schemaname = 'public' AND tablename = $1`,
            [table]
        );
        const byName = new Map(result.rows.map((row) => [row.indexname, row.indexdef]));
        expect(byName.get(`${table}_publicationStatus_idx`)).toMatch(/\(publication_status\)$/);
        expect(byName.get(`${table}_destinationId_publicationStatus_idx`)).toMatch(
            /\(destination_id, publication_status\)$/
        );
    });
});

describe.each(LISTING_TABLES)('listing table %s (TEST:V6:17)', (table) => {
    it('carries publication_status typed by the enum, NOT NULL and without default', async () => {
        const column = (await columnsOf({ table })).get('publication_status');
        expect(column?.udt_name).toBe('publication_status_enum');
        expect(column?.is_nullable).toBe('NO');
        expect(column?.column_default).toBeNull();
    });

    it('carries inactive_since (spec inactiva_desde), NOT NULL and without default', async () => {
        const column = (await columnsOf({ table })).get('inactive_since');
        expect(column?.data_type).toBe('timestamp with time zone');
        expect(column?.is_nullable).toBe('NO');
        expect(column?.column_default).toBeNull();
    });

    it('carries deadlines_version (spec plazos_version), NOT NULL and without default', async () => {
        const column = (await columnsOf({ table })).get('deadlines_version');
        expect(column?.data_type).toBe('integer');
        expect(column?.is_nullable).toBe('NO');
        expect(column?.column_default).toBeNull();
    });

    it('carries deletion_announced_at (spec borrado_anunciado), nullable', async () => {
        const column = (await columnsOf({ table })).get('deletion_announced_at');
        expect(column?.data_type).toBe('timestamp with time zone');
        expect(column?.is_nullable).toBe('YES');
        expect(column?.column_default).toBeNull();
    });

    it('has a single, non-nullable owner_id (no relation table)', async () => {
        const column = (await columnsOf({ table })).get('owner_id');
        expect(column?.data_type).toBe('uuid');
        expect(column?.is_nullable).toBe('NO');
    });
});

describe('fix_request, spec pedido_de_arreglo (TEST:V6:17)', () => {
    it('has the columns of V/02 §2.5 with their nullability', async () => {
        const columns = await columnsOf({ table: 'fix_request' });
        const shape = Object.fromEntries(
            [...columns.values()].map((column) => [column.column_name, column.is_nullable])
        );
        expect(shape).toEqual({
            id: 'NO',
            entity_type: 'NO',
            entity_id: 'NO',
            reason: 'NO',
            suggested_date: 'YES',
            owner_reported_fixed_at: 'YES',
            opened_by_id: 'NO',
            opened_at: 'NO',
            closed_at: 'YES',
            closed_by_id: 'YES',
            updated_at: 'NO'
        });
    });

    it('has the partial unique index over the open requests', async () => {
        const result = await scratch.query<{ indexdef: string }>(
            `SELECT indexdef FROM pg_indexes
             WHERE tablename = 'fix_request' AND indexname = 'fix_request_one_open_per_listing_uidx'`
        );
        const definition = result.rows[0]?.indexdef ?? '';
        expect(definition).toMatch(/^CREATE UNIQUE INDEX/);
        expect(definition).toContain('(entity_type, entity_id)');
        expect(definition).toMatch(/WHERE \(closed_at IS NULL\)$/);
    });

    it('rejects a second open request for the same listing and admits it once the first is closed', async () => {
        const client = await scratch.connect();
        try {
            await client.query('BEGIN');
            // Arrange: an admin user (the only FK the table carries).
            const user = await client.query<{ id: string }>(
                `INSERT INTO users (slug, display_name, email)
                 VALUES ('fix-request-admin', 'Admin', 'fix-request-admin@local.test')
                 RETURNING id`
            );
            const adminId = user.rows[0]?.id;
            const listingId = '00000000-0000-4000-8000-000000000001';
            const open = `INSERT INTO fix_request (entity_type, entity_id, reason, opened_by_id)
                          VALUES ('venue', $1, 'Fix the photos', $2) RETURNING id`;
            const first = await client.query<{ id: string }>(open, [listingId, adminId]);

            // Act + Assert: a second OPEN request on the same listing is rejected.
            await client.query('SAVEPOINT second_open');
            await expect(client.query(open, [listingId, adminId])).rejects.toMatchObject({
                code: '23505'
            });
            await client.query('ROLLBACK TO SAVEPOINT second_open');

            // The same listing in ANOTHER vertical is a different listing.
            await client.query(
                `INSERT INTO fix_request (entity_type, entity_id, reason, opened_by_id)
                 VALUES ('experience', $1, 'Fix the schedule', $2)`,
                [listingId, adminId]
            );

            // Once the first is closed, a new open request is admitted.
            await client.query(
                'UPDATE fix_request SET closed_at = now(), closed_by_id = $2 WHERE id = $1',
                [first.rows[0]?.id, adminId]
            );
            await expect(client.query(open, [listingId, adminId])).resolves.toBeDefined();
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });

    it('admits only the three listing verticals as entity_type', async () => {
        const client = await scratch.connect();
        try {
            await client.query('BEGIN');
            const user = await client.query<{ id: string }>(
                `INSERT INTO users (slug, display_name, email)
                 VALUES ('fix-request-admin-2', 'Admin', 'fix-request-admin-2@local.test')
                 RETURNING id`
            );
            await expect(
                client.query(
                    `INSERT INTO fix_request (entity_type, entity_id, reason, opened_by_id)
                     VALUES ('partner', gen_random_uuid(), 'x', $1)`,
                    [user.rows[0]?.id]
                )
            ).rejects.toMatchObject({ code: '23514' });
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });

    it('rejects a closer on a request that is still open (closed_by_id without closed_at)', async () => {
        const client = await scratch.connect();
        try {
            await client.query('BEGIN');
            const user = await client.query<{ id: string }>(
                `INSERT INTO users (slug, display_name, email)
                 VALUES ('fix-request-admin-3', 'Admin', 'fix-request-admin-3@local.test')
                 RETURNING id`
            );
            const adminId = user.rows[0]?.id;
            await expect(
                client.query(
                    `INSERT INTO fix_request
                         (entity_type, entity_id, reason, opened_by_id, closed_by_id, closed_at)
                     VALUES ('accommodation', gen_random_uuid(), 'x', $1, $1, NULL)`,
                    [adminId]
                )
            ).rejects.toMatchObject({ code: '23514' });
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });
});
