// TEST:U1:3 — legacy schema migration OVER DATA (HOS-1416).
//
// Builds a REAL pre-0125 database (the legacy qzpay billing system's schema:
// migrations 0000→0124 replayed from the journal, exactly as the VPS held
// them), fills the old billing tables and `accommodations` with rows, then
// applies the demolition migration 0125 and everything after it. It must end
// in the post-demolition world with the surviving data intact:
//
//   - every legacy billing table is DROPPED (all `billing_*`, plus
//     `entity_subscriptions`, `partner_subscriptions`,
//     `featured_listing_addon_grants`);
//   - the notification log SURVIVES — renamed to `notification_log` by HOS-1419
//     — without its `customer_id` column, keeping the row that was written
//     before the migration;
//   - `accommodations` keeps its three billing columns with THEIR DATA —
//     `owner_suspended`, `plan_restricted` and `billing_unpublished_at`
//     arrive exactly as they were written pre-migration, in both the set and
//     the unset shape.
//
// Unlike the shared integration database (provisioned by global-setup at the
// LATEST migration), this file provisions and tears down its OWN ephemeral
// database so it can stand on the pre-0125 side of history.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_PKG = resolve(__dirname, '../..');
const MIGRATIONS_DIR = join(REPO_PKG, 'src/migrations');

const LEGACY_DB_NAME = 'hospeda_migration_legacy_test';
const CONNECTION_BASE =
    process.env.HOSPEDA_TEST_DATABASE_URL ||
    'postgresql://hospeda_user:hospeda_pass@localhost:5436/postgres';

/** The demolition migration and its tag, read straight from the journal. */
const DEMOLITION_TAG = '0125_robust_cassandra_nova';

function adminConnectionString(): string {
    const url = new URL(CONNECTION_BASE);
    url.pathname = '/postgres';
    return url.toString();
}

function legacyDbConnectionString(): string {
    const url = new URL(CONNECTION_BASE);
    url.pathname = `/${LEGACY_DB_NAME}`;
    return url.toString();
}

interface JournalEntry {
    idx: number;
    tag: string;
}

/** The migration journal, in apply order. */
function readJournal(): JournalEntry[] {
    const journal = JSON.parse(
        readFileSync(join(MIGRATIONS_DIR, 'meta/_journal.json'), 'utf8')
    ) as { entries: JournalEntry[] };
    return journal.entries.sort((a, b) => a.idx - b.idx);
}

/**
 * Applies one migration file: each `--> statement-breakpoint` chunk goes to
 * the server as its own simple query, the same shape drizzle-kit feeds it.
 */
async function applyMigrationFile(pool: Pool, tag: string): Promise<void> {
    const sql = readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
        const trimmed = statement.trim();
        if (trimmed.length === 0) continue;
        await pool.query(trimmed);
    }
}

let adminPool: Pool;
let legacyPool: Pool;

beforeAll(async () => {
    adminPool = new Pool({ connectionString: adminConnectionString() });

    // 1. Fresh ephemeral database (drop leftovers from killed runs).
    await adminPool.query(`DROP DATABASE IF EXISTS ${LEGACY_DB_NAME}`);
    await adminPool.query(`CREATE DATABASE ${LEGACY_DB_NAME}`);

    legacyPool = new Pool({ connectionString: legacyDbConnectionString() });
    await legacyPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await legacyPool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await legacyPool.query('CREATE EXTENSION IF NOT EXISTS "unaccent"');

    // 2. Replay 0000→0124: the pre-demolition schema, from the journal.
    const entries = readJournal();
    const demolitionIdx = entries.find((e) => e.tag === DEMOLITION_TAG)?.idx;
    if (demolitionIdx === undefined) {
        throw new Error(`Journal has no entry for ${DEMOLITION_TAG}`);
    }
    for (const entry of entries.filter((e) => e.idx < demolitionIdx)) {
        await applyMigrationFile(legacyPool, entry.tag);
    }

    // 3. Seed the old system's rows (columns exactly as 0124 declared them).
    const userId = '11111111-1111-4111-8111-111111111111';
    const destinationId = '22222222-2222-4222-8222-222222222222';
    const customerId = '33333333-3333-4333-8333-333333333333';
    const planId = '44444444-4444-4444-8444-444444444444';
    const subscriptionId = '55555555-5555-4555-8555-555555555555';

    await legacyPool.query(
        `INSERT INTO "users" ("id", "slug", "email") VALUES ($1, 'legacy-owner', 'legacy-owner@example.test')`,
        [userId]
    );
    await legacyPool.query(
        `INSERT INTO "destinations"
             ("id", "destination_type", "path", "slug", "name", "summary", "description", "location")
         VALUES ($1, 'COUNTRY', '/argentina', 'argentina', 'Argentina', 'Legacy fixture country', 'Legacy fixture country description', '{}'::jsonb)`,
        [destinationId]
    );
    // Two accommodations: the SET shape (booleans true, timestamp present)
    // and the UNSET shape (booleans false, timestamp NULL) — the demolition
    // must preserve both exactly.
    await legacyPool.query(
        `INSERT INTO "accommodations"
             ("slug", "name", "summary", "type", "description", "owner_id", "destination_id",
              "lifecycle_state", "visibility",
              "owner_suspended", "plan_restricted", "billing_unpublished_at")
         VALUES
             ('legacy-suspended-cabin', 'Legacy Suspended Cabin', 'Suspended before the demolition.',
              'CABIN', 'A cabin suspended for unpaid billing.', $1, $2, 'DRAFT', 'PRIVATE',
              TRUE, TRUE, '2026-09-15T10:30:00Z'),
             ('legacy-clean-cabin', 'Legacy Clean Cabin', 'Never suspended.',
              'CABIN', 'A cabin in good standing.', $1, $2, 'DRAFT', 'PRIVATE',
              FALSE, FALSE, NULL)`,
        [userId, destinationId]
    );
    await legacyPool.query(
        `INSERT INTO "billing_customers" ("id", "external_id", "email", "name")
         VALUES ($1, 'mp-legacy-customer', 'legacy-customer@example.test', 'Legacy Customer')`,
        [customerId]
    );
    await legacyPool.query(
        `INSERT INTO "billing_plans" ("id", "name", "display_name", "monthly_price_ars", "product_domain")
         VALUES ($1, 'owner-legacy', 'Owner Legacy', 1800000, 'accommodation')`,
        [planId]
    );
    await legacyPool.query(
        `INSERT INTO "billing_subscriptions"
             ("id", "customer_id", "plan_id", "status", "billing_interval",
              "current_period_start", "current_period_end", "product_domain")
         VALUES ($1, $2, $3, 'active', 'monthly', '2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z', 'accommodation')`,
        [subscriptionId, customerId, planId]
    );
    await legacyPool.query(
        `INSERT INTO "billing_notification_log"
             ("customer_id", "type", "channel", "recipient", "subject", "status", "metadata")
         VALUES ($1, 'payment_failed', 'email', 'legacy-customer@example.test', 'Legacy log row', 'sent', '{}'::jsonb)`,
        [customerId]
    );

    // Sanity: the legacy world actually exists before the demolition runs.
    const pre = await legacyPool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    const preTables = new Set(pre.rows.map((r) => r.table_name));
    expect(preTables.has('billing_customers')).toBe(true);
    expect(preTables.has('billing_subscriptions')).toBe(true);
    expect(preTables.has('entity_subscriptions')).toBe(true);
    expect(preTables.has('partner_subscriptions')).toBe(true);
    expect(preTables.has('featured_listing_addon_grants')).toBe(true);
    expect(
        (
            await legacyPool.query(`SELECT column_name FROM information_schema.columns
         WHERE table_name = 'billing_notification_log' AND column_name = 'customer_id'`)
        ).rowCount
    ).toBe(1);

    // 4. Apply the demolition (0125) and every migration after it.
    for (const entry of entries.filter((e) => e.idx >= demolitionIdx)) {
        await applyMigrationFile(legacyPool, entry.tag);
    }
}, 300_000);

afterAll(async () => {
    if (legacyPool) await legacyPool.end();
    if (adminPool) {
        try {
            await adminPool.query(
                `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
                 WHERE datname = $1 AND pid <> pg_backend_pid()`,
                [LEGACY_DB_NAME]
            );
            await adminPool.query(`DROP DATABASE IF EXISTS ${LEGACY_DB_NAME}`);
        } finally {
            await adminPool.end();
        }
    }
});

describe('TEST:U1:3 — demolition migration over legacy data (HOS-1416)', () => {
    it('drops every legacy billing table', async () => {
        const result = await legacyPool.query<{ table_name: string }>(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
        );
        const tables = new Set(result.rows.map((r) => r.table_name));

        const legacyBilling = [...tables].filter(
            (t) => t.startsWith('billing_') && t !== 'billing_deadline_version'
        );
        expect(legacyBilling).toEqual([]);
        expect(tables.has('notification_log')).toBe(true);

        for (const table of [
            'entity_subscriptions',
            'partner_subscriptions',
            'featured_listing_addon_grants'
        ]) {
            expect(tables.has(table), `${table} must be dropped`).toBe(false);
        }
    });

    it('keeps the notification log alive as notification_log, without customer_id, row intact', async () => {
        const columns = await legacyPool.query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'notification_log'`
        );
        const names = new Set(columns.rows.map((r) => r.column_name));
        expect(names.has('customer_id')).toBe(false);

        const rows = await legacyPool.query<{ type: string; recipient: string; status: string }>(
            `SELECT "type", "recipient", "status" FROM "notification_log"`
        );
        expect(rows.rowCount).toBe(1);
        expect(rows.rows[0]).toEqual({
            type: 'payment_failed',
            recipient: 'legacy-customer@example.test',
            status: 'sent'
        });
    });

    it('preserves the three accommodations billing columns with their data', async () => {
        const columns = await legacyPool.query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'accommodations'`
        );
        const names = new Set(columns.rows.map((r) => r.column_name));
        expect(names.has('owner_suspended')).toBe(true);
        expect(names.has('plan_restricted')).toBe(true);
        expect(names.has('billing_unpublished_at')).toBe(true);

        const rows = await legacyPool.query<{
            slug: string;
            owner_suspended: boolean;
            plan_restricted: boolean;
            billing_unpublished_at: Date | null;
        }>(
            `SELECT "slug", "owner_suspended", "plan_restricted", "billing_unpublished_at"
             FROM "accommodations" WHERE "slug" IN ('legacy-suspended-cabin', 'legacy-clean-cabin')
             ORDER BY "slug"`
        );
        expect(rows.rowCount).toBe(2);

        const [clean, suspended] = rows.rows;
        expect(suspended.slug).toBe('legacy-suspended-cabin');
        expect(suspended.owner_suspended).toBe(true);
        expect(suspended.plan_restricted).toBe(true);
        expect(suspended.billing_unpublished_at).not.toBeNull();
        expect(suspended.billing_unpublished_at?.toISOString()).toBe('2026-09-15T10:30:00.000Z');

        expect(clean.slug).toBe('legacy-clean-cabin');
        expect(clean.owner_suspended).toBe(false);
        expect(clean.plan_restricted).toBe(false);
        expect(clean.billing_unpublished_at).toBeNull();
    });
});
