// TEST:U1:2 — legacy schema migration FROM EMPTY (HOS-1416).
//
// Migrating a blank database with the FULL migration chain (0000 → current,
// applied by `test/integration/global-setup.ts` via real `drizzle-kit migrate`
// before any worker starts — SPEC-178 carril 1) must produce the post-demolition
// world:
//
//   AC:U1:2 / AC:U1:1 — NO legacy billing table is created:
//     - no `billing_*` table at all, EXCEPT `billing_notification_log` (which
//       survives the demolition);
//     - no `entity_subscriptions`, no `partner_subscriptions`, no
//       `featured_listing_addon_grants`.
//   And `accommodations` carries its three billing columns
//     (`owner_suspended`, `plan_restricted`, `billing_unpublished_at`),
//     which survive the demolition with their readers.
//
// The companion file `legacy-schema-migration-over-data.test.ts` proves the
// same migration chain applied OVER pre-0125 data. This one proves the chain
// is coherent from scratch — a fresh environment never sees a legacy table.
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

/** Every public table in the migrated database. */
async function publicTables(): Promise<Set<string>> {
    const result = await getTestPool().query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    return new Set(result.rows.map((r) => r.table_name));
}

/** Columns of one table in the migrated database. */
async function columnsOf(table: string): Promise<Set<string>> {
    const result = await getTestPool().query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [table]
    );
    return new Set(result.rows.map((r) => r.column_name));
}

const SURVIVING_BILLING_TABLE = 'billing_notification_log';
const LEGACY_NAMED_TABLES = [
    'entity_subscriptions',
    'partner_subscriptions',
    'featured_listing_addon_grants'
];

afterAll(async () => {
    await closeTestPool();
});

describe('TEST:U1:2 — full migration chain over an empty database (HOS-1416)', () => {
    it('creates no legacy billing_* table other than billing_notification_log', async () => {
        const tables = await publicTables();

        const legacyBilling = [...tables].filter(
            (t) => t.startsWith('billing_') && t !== SURVIVING_BILLING_TABLE
        );

        expect(legacyBilling).toEqual([]);
        expect(tables.has(SURVIVING_BILLING_TABLE)).toBe(true);
    });

    it('creates none of the named legacy subscription/grant tables', async () => {
        const tables = await publicTables();

        for (const table of LEGACY_NAMED_TABLES) {
            expect(tables.has(table), `${table} must not be created`).toBe(false);
        }
    });

    it('gives accommodations its three surviving billing columns', async () => {
        const columns = await columnsOf('accommodations');

        expect(columns.has('owner_suspended')).toBe(true);
        expect(columns.has('plan_restricted')).toBe(true);
        expect(columns.has('billing_unpublished_at')).toBe(true);
    });

    it('leaves billing_notification_log without the demolished customer_id column', async () => {
        const columns = await columnsOf(SURVIVING_BILLING_TABLE);

        expect(columns.has('customer_id')).toBe(false);
    });
});
