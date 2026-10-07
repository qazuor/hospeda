// TEST:U1:14 — the HOS-1419 untangle migration applied OVER live-style data.
//
// Builds an isolated database at the state right BEFORE the HOS-1419 structural
// migration (`0128_*`, every journal entry before it replayed), fills it with
// what the old billing left behind in surviving tables:
//
//   - `role_permission` and `user_permission` rows carrying old-billing
//     permission values, next to rows that must survive;
//   - a `partners` row with the six billing columns populated, plus its
//     alliance window (`starts_at` / `ends_at`);
//   - a `billing_notification_log` row,
//
// then applies `0128_*`. It must remove those permission rows and columns,
// keep the unrelated grants, leave `starts_at` / `ends_at` exactly as they were,
// and carry the notification log row over to `notification_log`.
//
// Like `old-grouping-over-data.test.ts`, this file provisions and tears down
// its OWN database so it can stand on the pre-migration side of history.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/migrations');
const dbName = 'hospeda_old_billing_untangle_test';
const baseUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
if (!baseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${dbName}`;

/** The structural migration HOS-1419 generates (prefix fixed by the journal order). */
const TARGET_PREFIX = '0128_';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';
const STARTS_AT = '2026-03-01T12:00:00.000Z';
const ENDS_AT = '2027-03-01T12:00:00.000Z';

/** Old-billing permission values seeded before the migration (decision 3). */
const OLD_BILLING_PERMISSIONS = [
    'billing.readAll',
    'billing.manage',
    'billing.view.own',
    'billing.addon.purchase',
    'subscription.manage',
    'subscription.view.own',
    'subscriptionItem.view',
    'pricingPlan.view',
    'accommodationListingPlan.view',
    'serviceListingPlan.view',
    'benefitListingPlan.view'
];

/** Grants that must survive the migration untouched. */
const SURVIVING_PERMISSIONS = ['billing.settings.view', 'gastronomy.create'];

const PARTNER_BILLING_COLUMNS = [
    'subscription_status',
    'plan_id',
    'subscription_id',
    'unpaid_notice_sent_at',
    'payment_review_state',
    'payment_confirmed_through'
];

interface JournalEntry {
    idx: number;
    tag: string;
}

let admin: Pool;
let db: Pool;

async function apply(tag: string): Promise<void> {
    const content = readFileSync(join(migrationDir, `${tag}.sql`), 'utf8');
    for (const chunk of content.split('--> statement-breakpoint')) {
        if (chunk.trim()) await db.query(chunk.trim());
    }
}

beforeAll(async () => {
    admin = new Pool({ connectionString: adminUrl.toString() });
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.query(`CREATE DATABASE ${dbName}`);
    db = new Pool({ connectionString: testUrl.toString() });
    await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await db.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await db.query('CREATE EXTENSION IF NOT EXISTS "unaccent"');

    const journal = JSON.parse(readFileSync(join(migrationDir, 'meta/_journal.json'), 'utf8')) as {
        entries: JournalEntry[];
    };
    const target = journal.entries.find((entry) => entry.tag.startsWith(TARGET_PREFIX));
    if (!target) throw new Error(`${TARGET_PREFIX} migration absent from journal`);
    for (const entry of journal.entries
        .filter((entry) => entry.idx < target.idx)
        .sort((a, b) => a.idx - b.idx)) {
        await apply(entry.tag);
    }

    await db.query(
        `INSERT INTO users (id, slug, email) VALUES ($1, 'old-billing-owner', 'old-billing@example.test')`,
        [USER_ID]
    );
    const allPermissions = [...OLD_BILLING_PERMISSIONS, ...SURVIVING_PERMISSIONS];
    for (const permission of allPermissions) {
        await db.query(`INSERT INTO role_permission (role, permission) VALUES ('ADMIN', $1)`, [
            permission
        ]);
        await db.query(`INSERT INTO user_permission (user_id, permission) VALUES ($1, $2)`, [
            USER_ID,
            permission
        ]);
    }
    await db.query(
        `INSERT INTO partners
             (id, slug, name, type, tier, subscription_status, plan_id, subscription_id,
              unpaid_notice_sent_at, payment_review_state, payment_confirmed_through,
              starts_at, ends_at)
         VALUES ($1, 'old-billing-partner', 'Old Billing Partner', 'business', 'gold', 'active',
                 '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444',
                 '2026-04-01T00:00:00Z', 'pending_confirmation', '2026-05-01T00:00:00Z',
                 $2, $3)`,
        [PARTNER_ID, STARTS_AT, ENDS_AT]
    );
    await db.query(
        `INSERT INTO billing_notification_log ("type", "channel", "recipient", "subject", "status", "metadata")
         VALUES ('trial_ending', 'email', 'owner@example.test', 'Pre-rename row', 'sent', '{"idempotencyKey":"k-1"}'::jsonb)`
    );

    await apply(target.tag);
}, 300_000);

afterAll(async () => {
    if (db) await db.end();
    if (admin) {
        await admin.query(
            `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
             WHERE datname = $1 AND pid <> pg_backend_pid()`,
            [dbName]
        );
        await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
        await admin.end();
    }
});

describe('TEST:U1:14 — old billing untangled over live-style data', () => {
    it('removes every old-billing grant from roles and overrides, keeping the rest', async () => {
        for (const table of ['role_permission', 'user_permission']) {
            const rows = await db.query<{ value: string }>(
                `SELECT permission::text AS value FROM ${table} ORDER BY 1`
            );
            expect(
                rows.rows.map((row) => row.value),
                `${table} must keep only the surviving grants`
            ).toEqual([...SURVIVING_PERMISSIONS].sort());
        }
    });

    it('drops the six partner billing columns', async () => {
        const columns = await db.query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'partners'`
        );
        const names = new Set(columns.rows.map((row) => row.column_name));
        for (const column of PARTNER_BILLING_COLUMNS) {
            expect(names.has(column), `partners.${column} must be dropped`).toBe(false);
        }
    });

    it('leaves starts_at and ends_at intact', async () => {
        const rows = await db.query<{ starts_at: Date; ends_at: Date }>(
            `SELECT starts_at, ends_at FROM partners WHERE id = $1`,
            [PARTNER_ID]
        );

        expect(rows.rowCount).toBe(1);
        expect(rows.rows[0]?.starts_at.toISOString()).toBe(STARTS_AT);
        expect(rows.rows[0]?.ends_at.toISOString()).toBe(ENDS_AT);
    });

    it('drops the two partner billing enum types', async () => {
        const types = await db.query(
            `SELECT 1 FROM pg_type WHERE typname IN
                 ('partner_subscription_status_enum', 'partner_payment_review_state_enum')`
        );

        expect(types.rowCount).toBe(0);
    });

    it('carries the notification log row over to notification_log', async () => {
        const rows = await db.query<{ type: string; subject: string }>(
            `SELECT "type", "subject" FROM "notification_log"`
        );
        const legacy = await db.query<{ name: string | null }>(
            `SELECT to_regclass('public.billing_notification_log')::text AS name`
        );

        expect(rows.rows).toEqual([{ type: 'trial_ending', subject: 'Pre-rename row' }]);
        expect(legacy.rows[0]?.name).toBeNull();
    });
});
