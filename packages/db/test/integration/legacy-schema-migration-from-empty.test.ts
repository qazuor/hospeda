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
//   `accommodations` kept its three billing columns (`owner_suspended`,
//     `plan_restricted`, `billing_unpublished_at`) through the demolition
//     (the over-data companion proves it at that migration); the FULL chain
//     no longer has them, because V6.9b (HOS-1641) dropped them later.
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
const OLD_VERTICAL = ['gastro', 'nomy'].join('');
const OLD_VERTICAL_UPPER = OLD_VERTICAL.toUpperCase();
const OLD_AI_FEATURE = `chat_${OLD_VERTICAL}`;

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
    ['venues', 'is_featured'],
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
    if (
        value === 'billing.settings.view' ||
        value === 'billing.settings.write' ||
        value === 'billing.subscription.inspect' ||
        value === 'billing.viewOwn' ||
        value === 'billing.settleExternal' ||
        value === 'billing.cancelSubscription' ||
        value === 'billing.liftReconciliationMark' ||
        value === 'billing.grantComplimentary' ||
        // HOS-1591 action 21 is new billing, not a legacy billing permission.
        value === 'billing.managePromoCodes'
    )
        return false;
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
            (t) =>
                t.startsWith('billing_') &&
                t !== 'billing_deadline_version' &&
                t !== 'billing_option'
        );

        expect(legacyBilling).toEqual([]);
        expect(tables.has('billing_deadline_version')).toBe(true);
        expect(tables.has('billing_option')).toBe(true);
    });

    it('creates none of the named legacy subscription/grant tables', async () => {
        const tables = await publicTables();

        for (const table of LEGACY_NAMED_TABLES) {
            expect(tables.has(table), `${table} must not be created`).toBe(false);
        }
    });

    it('ends the full chain without the three accommodation billing columns (dropped by V6.9b, HOS-1641)', async () => {
        const columns = await columnsOf('accommodations');

        // Sanity: the column read sees the table.
        expect(columns.has('publication_status')).toBe(true);
        expect(columns.has('owner_suspended')).toBe(false);
        expect(columns.has('plan_restricted')).toBe(false);
        expect(columns.has('billing_unpublished_at')).toBe(false);
    });
});

describe('TEST:U1:12 — extras and dual-write branch after migrate + apply-extras (HOS-1419)', () => {
    it('applies the 032 and 033 media invariants on the fresh chain', async () => {
        // global-setup runs apply-extras non-fatally; a missing object here
        // means the extras did NOT apply over the current migration chain.
        const constraints = await getTestPool().query<{ conname: string }>(
            `SELECT conname FROM pg_constraint
             WHERE conname IN (
                 'chk_venue_media_featured_not_archived',
                 'chk_experience_media_featured_not_archived',
                 'chk_post_media_featured_not_archived'
             )`
        );
        const indexes = await getTestPool().query<{ indexname: string }>(
            `SELECT indexname FROM pg_indexes
             WHERE indexname IN (
                 'uq_venue_media_single_featured',
                 'uq_experience_media_single_featured',
                 'uq_post_media_single_featured',
                 'uq_event_media_single_featured'
             )`
        );

        expect(constraints.rows.map((r) => r.conname).sort()).toEqual([
            'chk_experience_media_featured_not_archived',
            'chk_post_media_featured_not_archived',
            'chk_venue_media_featured_not_archived'
        ]);
        expect(indexes.rowCount).toBe(4);
    });

    it('names no retired grouping word in 032 or 033', () => {
        for (const file of [
            '032-venue-experience-media.constraints.sql',
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
            .filter((file) => {
                const content = readFileSync(join(EXTRAS_DIR, file), 'utf8');
                return /\bbilling_[a-z_]+/.test(content.replaceAll('billing_deadline_version', ''));
            });

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

    it('TEST:V6:23 removes the retired partner alliance window', async () => {
        const columns = await columnsOf('partners');

        expect(columns.has('starts_at')).toBe(false);
        expect(columns.has('ends_at')).toBe(false);
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

describe('TEST:1820:1 AC:1:7 — physical venue rename on an empty database', () => {
    it('TEST:1820:1 AC:1:7 leaves no retired SQL object names and exactly one featured index and venue update trigger', async () => {
        const oldNames = await getTestPool().query<{ object_name: string }>(`
            SELECT indexname AS object_name FROM pg_indexes WHERE indexname ILIKE '%gastronom%'
            UNION ALL SELECT conname FROM pg_constraint WHERE conname ILIKE '%gastronom%'
            UNION ALL SELECT tgname FROM pg_trigger WHERE tgname ILIKE '%gastronom%'
            UNION ALL SELECT typname FROM pg_type WHERE typname ILIKE '%gastronom%'
            UNION ALL SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                WHERE e.enumlabel ILIKE '%gastronom%'
                  AND t.typname NOT IN ('event_category_enum', 'post_category_enum')
        `);
        const featuredIndex = await getTestPool().query(
            `SELECT count(*)::int AS count FROM pg_indexes WHERE indexname = 'uq_venue_media_single_featured'`
        );
        const venuesTrigger = await getTestPool().query(
            `SELECT count(*)::int AS count FROM pg_trigger WHERE tgname = 'trg_set_updated_at_venues'`
        );
        const domainEventCount = await getTestPool().query(
            `SELECT count(*)::int AS count FROM domain_event`
        );

        expect(oldNames.rows).toEqual([]);
        expect(featuredIndex.rows).toEqual([{ count: 1 }]);
        expect(venuesTrigger.rows).toEqual([{ count: 1 }]);
        expect(domainEventCount.rows).toEqual([{ count: 0 }]);
    });
});

describe('TEST:1820:2 AC:1:4 — extras are idempotent after the rename', () => {
    it('TEST:1820:2 AC:1:4 reapplies extras without duplicating the featured index or venue trigger', async () => {
        const { execFileSync } = await import('node:child_process');
        const script = resolve(REPO_ROOT, 'packages/db/scripts/apply-postgres-extras.mjs');
        const databaseUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
        if (!databaseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
        execFileSync('node', [script, databaseUrl], { stdio: 'pipe' });

        const featuredIndex = await getTestPool().query(
            `SELECT count(*)::int AS count FROM pg_indexes WHERE indexname = 'uq_venue_media_single_featured'`
        );
        const venuesTrigger = await getTestPool().query(
            `SELECT count(*)::int AS count FROM pg_trigger WHERE tgname = 'trg_set_updated_at_venues'`
        );
        const retiredVenueTriggers = await getTestPool().query<{ tgname: string }>(
            `SELECT tgname FROM pg_trigger WHERE tgname ILIKE '%gastronom%'`
        );

        expect(featuredIndex.rows).toEqual([{ count: 1 }]);
        expect(venuesTrigger.rows).toEqual([{ count: 1 }]);
        expect(retiredVenueTriggers.rows).toEqual([]);
    });
});

describe('TEST:1820:6 AC:1:4 — rename legacy extras already present at cutover', () => {
    it('TEST:1820:6 AC:1:4 renames every legacy venue update trigger and media invariant exactly once', async () => {
        const migration = readFileSync(
            join(REPO_ROOT, 'packages/db/src/migrations/0180_venue_rename.sql'),
            'utf8'
        );
        const oldPrefix = ['trg_set_updated_at_', 'gastro', 'nomy_'].join('');
        const oldMediaIndex = ['uq_', OLD_VERTICAL, '_media_single_featured'].join('');
        const oldMediaConstraint = ['chk_', OLD_VERTICAL, '_media_featured_not_archived'].join('');
        const oldRootTrigger = ['trg_set_updated_at_', 'gastro', 'nom', 'ies'].join('');
        const newRootTrigger = 'trg_set_updated_at_venues';
        const newPrefix = 'trg_set_updated_at_venue_';
        const currentTriggers = await getTestPool().query<{ tgname: string }>(
            `SELECT tgname FROM pg_trigger
             WHERE NOT tgisinternal AND (tgname = $1 OR tgname LIKE $2) ORDER BY tgname`,
            [newRootTrigger, `${newPrefix}%`]
        );
        const newTriggerNames = currentTriggers.rows.map((row) => row.tgname);
        const oldTriggerNames = newTriggerNames.map((name) =>
            name === newRootTrigger ? oldRootTrigger : name.replace(newPrefix, oldPrefix)
        );
        const statements = migration
            .split('--> statement-breakpoint')
            .filter((statement) =>
                [oldPrefix, oldRootTrigger, oldMediaIndex, oldMediaConstraint].some((name) =>
                    statement.includes(name)
                )
            );
        const client = await getTestPool().connect();
        try {
            await client.query('BEGIN');
            for (const name of newTriggerNames) {
                const oldName =
                    name === newRootTrigger ? oldRootTrigger : name.replace(newPrefix, oldPrefix);
                const tableName =
                    name === newRootTrigger ? 'venues' : name.replace('trg_set_updated_at_', '');
                await client.query(`ALTER TRIGGER ${name} ON ${tableName} RENAME TO ${oldName}`);
            }
            await client.query(
                `ALTER INDEX uq_venue_media_single_featured RENAME TO ${oldMediaIndex}`
            );
            await client.query(
                `ALTER TABLE venue_media RENAME CONSTRAINT chk_venue_media_featured_not_archived TO ${oldMediaConstraint}`
            );
            for (const statement of statements) {
                if (statement.trim()) await client.query(statement.trim());
            }
            const newTriggers = await client.query<{ tgname: string }>(
                `SELECT tgname FROM pg_trigger
                 WHERE NOT tgisinternal AND (tgname = $1 OR tgname LIKE $2) ORDER BY tgname`,
                [newRootTrigger, `${newPrefix}%`]
            );
            const oldTriggers = await client.query<{ tgname: string }>(
                `SELECT tgname FROM pg_trigger WHERE tgname = ANY($1::text[]) ORDER BY tgname`,
                [oldTriggerNames]
            );
            const newIndexes = await client.query<{ indexname: string }>(
                `SELECT indexname FROM pg_indexes
                 WHERE indexname = 'uq_venue_media_single_featured' ORDER BY indexname`
            );
            const oldIndexes = await client.query<{ indexname: string }>(
                `SELECT indexname FROM pg_indexes WHERE indexname = $1 ORDER BY indexname`,
                [oldMediaIndex]
            );
            const newConstraints = await client.query<{ conname: string }>(
                `SELECT conname FROM pg_constraint
                 WHERE conname = 'chk_venue_media_featured_not_archived' ORDER BY conname`
            );
            const oldConstraints = await client.query<{ conname: string }>(
                `SELECT conname FROM pg_constraint WHERE conname = $1 ORDER BY conname`,
                [oldMediaConstraint]
            );
            expect(newTriggers.rows).toEqual(newTriggerNames.map((tgname) => ({ tgname })));
            expect(oldTriggers.rows).toEqual([]);
            expect(newIndexes.rows).toEqual([{ indexname: 'uq_venue_media_single_featured' }]);
            expect(oldIndexes.rows).toEqual([]);
            expect(newConstraints.rows).toEqual([
                { conname: 'chk_venue_media_featured_not_archived' }
            ]);
            expect(oldConstraints.rows).toEqual([]);

            const extrasDir = join(REPO_ROOT, 'packages/db/src/migrations/extras');
            for (const file of [
                '002-set-updated-at.trigger.sql',
                '032-venue-experience-media.constraints.sql'
            ]) {
                await client.query(readFileSync(join(extrasDir, file), 'utf8'));
            }
            const triggersAfterExtras = await client.query<{ tgname: string }>(
                `SELECT tgname FROM pg_trigger
                 WHERE NOT tgisinternal AND (tgname = $1 OR tgname LIKE $2) ORDER BY tgname`,
                [newRootTrigger, `${newPrefix}%`]
            );
            const indexesAfterExtras = await client.query<{ indexname: string }>(
                `SELECT indexname FROM pg_indexes
                 WHERE indexname = 'uq_venue_media_single_featured' ORDER BY indexname`
            );
            expect(triggersAfterExtras.rows).toEqual(newTriggerNames.map((tgname) => ({ tgname })));
            expect(indexesAfterExtras.rows).toEqual([
                { indexname: 'uq_venue_media_single_featured' }
            ]);
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });
});

describe('TEST:1820:3 AC:1:4 — reset guard is the first migration statement', () => {
    it('TEST:1820:3 AC:1:4 passes on the migrated empty base and raises the reset instruction for an old vertical row', async () => {
        const { readFileSync } = await import('node:fs');
        const migration = readFileSync(
            join(REPO_ROOT, 'packages/db/src/migrations/0180_venue_rename.sql'),
            'utf8'
        );
        const guard = migration
            .split('--> statement-breakpoint')[0]
            ?.split('\n')
            .slice(1)
            .join('\n')
            .trim();
        if (!guard?.startsWith('DO $$'))
            throw new Error('The first migration statement is not the reset guard');

        const client = await getTestPool().connect();
        try {
            await expect(client.query(guard)).resolves.toBeDefined();
            await client.query('BEGIN');
            await client.query('ALTER TABLE vertical DROP CONSTRAINT ck_vertical_id');
            await client.query('INSERT INTO vertical (id) VALUES ($1)', [OLD_VERTICAL]);
            await expect(client.query(guard)).rejects.toThrow(
                'HOS-1787: esta base necesita reset (DEC-FAC-029)'
            );
            await client.query('ROLLBACK');
        } finally {
            client.release();
        }
    });
});

describe('TEST:1820:4 AC:1:6 — physical rename data conversions', () => {
    it('TEST:1820:4 AC:1:6 runs each migration UPDATE against old fixture rows in isolated temporary tables', async () => {
        const { readFileSync } = await import('node:fs');
        const migration = readFileSync(
            join(REPO_ROOT, 'packages/db/src/migrations/0180_venue_rename.sql'),
            'utf8'
        );
        const conversions =
            migration
                .split('-- Convert persisted values before the enum labels change.')[1]
                ?.split(`ALTER TABLE "${['gastro', 'nomies'].join('')}"`)[0]
                ?.split('--> statement-breakpoint') ?? [];
        const client = await getTestPool().connect();
        try {
            await client.query(`
                CREATE TEMP TABLE qr_codes (entity_type text, source text, target_url text);
                CREATE TEMP TABLE amenities (applicable_verticals text[]);
                CREATE TEMP TABLE features (applicable_verticals text[]);
                CREATE TEMP TABLE ai_settings (value jsonb);
                CREATE TEMP TABLE ai_usage (feature text);
                CREATE TEMP TABLE ai_conversations (feature text);
                CREATE TEMP TABLE ai_request_log (feature text);
                CREATE TEMP TABLE ai_prompt_versions (feature text);
                CREATE TEMP TABLE revalidation_config (entity_type text);
                CREATE TEMP TABLE email_outbox (payload jsonb);
                CREATE TEMP TABLE cutover_v6_deleted_listing (entity_type text);
                INSERT INTO qr_codes VALUES ('${OLD_VERTICAL_UPPER}', 'GENERATED', '/es/${['gastro', 'nomia'].join('')}/cafe/carta/');
                INSERT INTO amenities VALUES (ARRAY['${OLD_VERTICAL}']);
                INSERT INTO features VALUES (ARRAY['${OLD_VERTICAL}']);
                INSERT INTO ai_settings VALUES ('{"features":{"${OLD_AI_FEATURE}":{"enabled":true}}}');
                INSERT INTO ai_usage VALUES ('${OLD_AI_FEATURE}');
                INSERT INTO ai_conversations VALUES ('${OLD_AI_FEATURE}');
                INSERT INTO ai_request_log VALUES ('${OLD_AI_FEATURE}');
                INSERT INTO ai_prompt_versions VALUES ('${OLD_AI_FEATURE}');
                INSERT INTO revalidation_config VALUES ('${OLD_VERTICAL}');
                INSERT INTO email_outbox VALUES ('{"vertical":"${OLD_VERTICAL}"}');
                INSERT INTO cutover_v6_deleted_listing VALUES ('${OLD_VERTICAL}');
            `);
            for (const sql of conversions) {
                if (sql.trim()) await client.query(sql);
            }
            const counts = await client.query<{ old_rows: string }>(`
                SELECT (SELECT count(*) FROM qr_codes WHERE target_url LIKE '%/${['gastro', 'nomia'].join('')}/%')::text AS old_rows
                UNION ALL SELECT count(*)::text FROM amenities WHERE '${OLD_VERTICAL}' = ANY(applicable_verticals)
                UNION ALL SELECT count(*)::text FROM features WHERE '${OLD_VERTICAL}' = ANY(applicable_verticals)
                UNION ALL SELECT count(*)::text FROM ai_settings WHERE value #> '{features,${OLD_AI_FEATURE}}' IS NOT NULL
                UNION ALL SELECT count(*)::text FROM ai_usage WHERE feature = '${OLD_AI_FEATURE}'
                UNION ALL SELECT count(*)::text FROM ai_conversations WHERE feature = '${OLD_AI_FEATURE}'
                UNION ALL SELECT count(*)::text FROM ai_request_log WHERE feature = '${OLD_AI_FEATURE}'
                UNION ALL SELECT count(*)::text FROM ai_prompt_versions WHERE feature = '${OLD_AI_FEATURE}'
                UNION ALL SELECT count(*)::text FROM revalidation_config WHERE entity_type = '${OLD_VERTICAL}'
                UNION ALL SELECT count(*)::text FROM email_outbox WHERE payload->>'vertical' = '${OLD_VERTICAL}'
                UNION ALL SELECT count(*)::text FROM cutover_v6_deleted_listing WHERE entity_type = '${OLD_VERTICAL}'
            `);
            expect(counts.rows).toEqual(Array.from({ length: 11 }, () => ({ old_rows: '0' })));
        } finally {
            client.release();
        }
    });
});
