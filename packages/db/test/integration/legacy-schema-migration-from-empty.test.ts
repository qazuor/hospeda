// TEST:U1:2 / TEST:U1:12 / TEST:U1:13 — legacy schema migration FROM EMPTY
// (HOS-1416, HOS-1419).
//
// Migrating a blank database with the FULL migration chain (0000 → current,
// applied by `test/integration/global-setup.ts` via real `drizzle-kit migrate`
// before any worker starts — SPEC-178 carril 1), followed by `apply-extras`
// (carril 2, same global setup), must produce the post-demolition world:
//
//   TEST:U1:2 (AC:U1:1, AC:U1:2) — NO legacy billing table is created:
//     - no legacy `billing_*` table (the notification log was renamed to the
//       neutral `notification_log` by HOS-1419; B2 adds `billing_option`);
//     - no `entity_subscriptions`, no `partner_subscriptions`, no
//       `featured_listing_addon_grants`.
//   And `accommodations` carries its three billing columns
//     (`owner_suspended`, `plan_restricted`, `billing_unpublished_at`),
//     which survive the demolition with their readers.
//
//   TEST:U1:12 (AC:U1:7) — the extras `032` and `033` apply on the fresh chain
//     and carry no trace of the retired grouping word; the seed dual-write
//     guard has no plans-file branch, and the dual-write rule of the root
//     `CLAUDE.md` no longer names billing plans.
//
//   TEST:U1:13 (AC:U1:8) — none of the columns, enum types or enum values the
//     old billing left tangled in the surviving tables exist, and the
//     notification log exists under its neutral name with its own idempotency
//     index (which left `extras/004` for the structural carril).
//
// The companion file `legacy-schema-migration-over-data.test.ts` proves the
// same migration chain applied OVER pre-0125 data. This one proves the chain
// is coherent from scratch — a fresh environment never sees a legacy object.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const EXTRAS_DIR = join(REPO_ROOT, 'packages/db/src/migrations/extras');

/** The retired grouping word, built in parts so the repo-wide guard does not match this file. */
const OLD = ['comm', 'erce'].join('');

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

/** Labels of one Postgres enum type (empty when the type does not exist). */
async function enumLabels(typeName: string): Promise<string[]> {
    const result = await getTestPool().query<{ enumlabel: string }>(
        `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = $1`,
        [typeName]
    );
    return result.rows.map((r) => r.enumlabel);
}

const NOTIFICATION_LOG_TABLE = 'notification_log';
const LEGACY_NAMED_TABLES = [
    'entity_subscriptions',
    'partner_subscriptions',
    'featured_listing_addon_grants',
    'billing_notification_log'
];

/**
 * `table.column` pairs the old billing left in surviving tables (AC:U1:8).
 * `featured_by_entitlement` is deliberately absent: the owner kept it on the
 * three verticals (premium plans and the new add-on will write it).
 */
const DROPPED_COLUMNS: ReadonlyArray<readonly [string, string]> = [
    ['partners', 'subscription_status'],
    ['partners', 'plan_id'],
    ['partners', 'subscription_id'],
    ['partners', 'unpaid_notice_sent_at'],
    ['partners', 'payment_review_state'],
    ['partners', 'payment_confirmed_through'],
    ['users', 'service_suspended'],
    ['owner_promotions', 'plan_restricted'],
    ['experiences', 'has_active_subscription'],
    ['accommodations', 'is_featured'],
    ['gastronomies', 'is_featured'],
    ['experiences', 'is_featured']
];

/** Permission categories retired with the old billing (decision 3). */
const DROPPED_PERMISSION_CATEGORIES = [
    'ACCOMMODATION_LISTING_PLAN',
    'SUBSCRIPTION',
    'SUBSCRIPTION_ITEM',
    'BENEFIT_LISTING_PLAN',
    'SERVICE_LISTING_PLAN'
];

/** True for a permission value of the old billing family (decision 3). */
function isOldBillingPermission(value: string): boolean {
    if (value === 'billing.settings.view' || value === 'billing.settings.write') return false;
    return (
        value.startsWith('billing.') ||
        value.startsWith('subscription.') ||
        value.startsWith('subscriptionItem.') ||
        value.startsWith('pricingPlan.') ||
        /^[a-zA-Z]+ListingPlan\./.test(value)
    );
}

afterAll(async () => {
    await closeTestPool();
});

describe('TEST:U1:2 — full migration chain over an empty database (HOS-1416)', () => {
    it('creates no legacy billing_* table', async () => {
        const tables = await publicTables();

        const legacyBilling = [...tables].filter(
            (t) => t.startsWith('billing_') && t !== 'billing_option'
        );

        expect(legacyBilling).toEqual([]);
        expect(tables.has('billing_option')).toBe(true);
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
});

describe('TEST:U1:12 — extras and dual-write branch after migrate + apply-extras (HOS-1419)', () => {
    it('applies the 032 and 033 media invariants on the fresh chain', async () => {
        // global-setup runs apply-extras non-fatally; a missing object here
        // means the extras did NOT apply over the current migration chain.
        const constraints = await getTestPool().query<{ conname: string }>(
            `SELECT conname FROM pg_constraint
             WHERE conname IN (
                 'chk_gastronomy_media_featured_not_archived',
                 'chk_experience_media_featured_not_archived',
                 'chk_post_media_featured_not_archived'
             )`
        );
        const indexes = await getTestPool().query<{ indexname: string }>(
            `SELECT indexname FROM pg_indexes
             WHERE indexname IN (
                 'uq_gastronomy_media_single_featured',
                 'uq_experience_media_single_featured',
                 'uq_post_media_single_featured',
                 'uq_event_media_single_featured'
             )`
        );

        expect(constraints.rows.map((r) => r.conname).sort()).toEqual([
            'chk_experience_media_featured_not_archived',
            'chk_gastronomy_media_featured_not_archived',
            'chk_post_media_featured_not_archived'
        ]);
        expect(indexes.rowCount).toBe(4);
    });

    it('names no retired grouping word in 032 or 033', () => {
        for (const file of [
            '032-gastronomy-experience-media.constraints.sql',
            '033-content-media.constraints.sql'
        ]) {
            const content = readFileSync(join(EXTRAS_DIR, file), 'utf8').toLowerCase();
            expect(content.includes(OLD), `${file} names the retired word`).toBe(false);
        }
    });

    it('keeps no extras file that targets a table of the old billing', () => {
        // The 16 dead old-billing extras were deleted (decision 2); a survivor
        // that still targets a `billing_*` table would be dead code again.
        const offenders = readdirSync(EXTRAS_DIR)
            .filter((file) => file.endsWith('.sql'))
            .filter((file) =>
                /\bbilling_[a-z_]+/.test(readFileSync(join(EXTRAS_DIR, file), 'utf8'))
            );

        expect(offenders).toEqual([]);
    });

    it('has no plans-file branch in the seed dual-write guard', () => {
        const script = readFileSync(join(REPO_ROOT, 'scripts/check-seed-dual-write.sh'), 'utf8');

        expect(script).not.toMatch(/BILLING_CONFIG_FILES/);
        expect(script).not.toMatch(/plans\.config\.ts/);
    });

    it('keeps billing plans out of the dual-write rule of the root CLAUDE.md', () => {
        const claude = readFileSync(join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
        const rule = claude.split('\n').find((line) => line.includes('**Seed dual-write rule'));

        expect(rule, 'the dual-write rule line must exist').toBeDefined();
        expect(rule).not.toMatch(/billing plan/i);
        expect(rule).not.toMatch(/\.plan\.sql/);
    });
});

describe('TEST:U1:13 — old billing untangled from the surviving schema (HOS-1419)', () => {
    it('drops every column the old billing left in surviving tables', async () => {
        for (const [table, column] of DROPPED_COLUMNS) {
            const columns = await columnsOf(table);
            expect(columns.size, `${table} must exist`).toBeGreaterThan(0);
            expect(columns.has(column), `${table}.${column} must not exist`).toBe(false);
        }
    });

    it('keeps the partner alliance window intact', async () => {
        const columns = await columnsOf('partners');

        expect(columns.has('starts_at')).toBe(true);
        expect(columns.has('ends_at')).toBe(true);
    });

    it('drops the two partner billing enum types', async () => {
        expect(await enumLabels('partner_subscription_status_enum')).toEqual([]);
        expect(await enumLabels('partner_payment_review_state_enum')).toEqual([]);
    });

    it('carries no old-billing permission value, but keeps BILLING_SETTINGS_*', async () => {
        const labels = await enumLabels('permission_enum');

        expect(labels.length).toBeGreaterThan(0);
        expect(labels.filter(isOldBillingPermission)).toEqual([]);
        expect(labels).toContain('billing.settings.view');
        expect(labels).toContain('billing.settings.write');
    });

    it('carries none of the retired permission categories', async () => {
        const labels = await enumLabels('permission_category_enum');

        expect(labels.length).toBeGreaterThan(0);
        expect(labels.filter((l) => DROPPED_PERMISSION_CATEGORIES.includes(l))).toEqual([]);
        expect(labels).toContain('BILLING');
    });

    it('creates the notification log under its neutral name, without customer_id', async () => {
        const tables = await publicTables();
        const columns = await columnsOf(NOTIFICATION_LOG_TABLE);

        expect(tables.has(NOTIFICATION_LOG_TABLE)).toBe(true);
        expect(columns.has('customer_id')).toBe(false);
        expect(columns.has('metadata')).toBe(true);
    });

    it('gives the notification log its own UNIQUE partial idempotency index', async () => {
        const result = await getTestPool().query<{ indexdef: string }>(
            `SELECT indexdef FROM pg_indexes
             WHERE schemaname = 'public' AND tablename = $1
               AND indexname = 'idx_notification_log_idempotency_key'`,
            [NOTIFICATION_LOG_TABLE]
        );

        expect(result.rowCount).toBe(1);
        const def = result.rows[0]?.indexdef ?? '';
        expect(def).toMatch(/CREATE UNIQUE INDEX/);
        expect(def).toMatch(/idempotencyKey/);
        expect(def).toMatch(/WHERE/);
    });

    it('enforces idempotency only on rows that carry a key', async () => {
        const client = await getTestPool().connect();
        const insert = (metadata: string) =>
            client.query(
                `INSERT INTO "notification_log" ("type", "channel", "recipient", "subject", "metadata")
                 VALUES ('t', 'email', 'a@example.test', 's', $1::jsonb)`,
                [metadata]
            );
        try {
            await client.query('BEGIN');
            // Rows without a key are unconstrained.
            await insert('{}');
            await insert('{}');
            await insert('{"idempotencyKey":"k-1"}');
            await client.query('SAVEPOINT dup');
            await expect(insert('{"idempotencyKey":"k-1"}')).rejects.toThrow(/duplicate key/);
            await client.query('ROLLBACK TO SAVEPOINT dup');
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });
});
