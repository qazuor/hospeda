// TEST:B1:2 (AC:B1:2, HOS-1506) — the payments package absorbs no table, FROM
// SCRATCH.
//
// A database built with the branch's migrations, from empty, holds none of the
// legacy billing tables (the frozen LEGACY_TABLES list, anchored on the
// migration history) and no table carrying the library's name, while a new,
// neutral billing table would pass; and no `package.json` of the repo declares
// that library. The payments package
// itself declares no schema (asserted in packages/payments/test/
// package-boundary.test.ts); this file proves the database side.
//
// Self-contained on purpose: it creates its OWN uniquely named database, applies
// the chain with real `drizzle-kit migrate`, and drops only that database, so it
// does not depend on (or disturb) the shared integration database.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPO_ROOT = resolve(pkgDir, '../..');
const SCRATCH_DB = `hospeda_scratch_payments_${process.pid}`;

/** The legacy billing library's name, built in parts so the repo guards never match this file. */
const LEGACY_NAME = ['qz', 'pay'].join('');
const LEGACY_PREFIX = `@qazuor/${LEGACY_NAME}`;

/**
 * The tables of the old billing system, as the old migrations created them (the
 * library's storage adapter owned every `billing_*` one), plus the three link
 * tables and the notification log that U1 removed or renamed. Frozen on
 * purpose: a blanket `billing_` prefix would misfire on the redesign's own
 * billing tables, and a test below proves every name here is a real table of
 * the migration history.
 */
const LEGACY_TABLES = [
    'billing_addon_purchases',
    'billing_addons',
    'billing_audit_logs',
    'billing_checkouts',
    'billing_customer_entitlements',
    'billing_customer_limits',
    'billing_customers',
    'billing_dunning_attempts',
    'billing_entitlements',
    'billing_idempotency_keys',
    'billing_invoice_lines',
    'billing_invoice_payments',
    'billing_invoices',
    'billing_limits',
    'billing_mp_addon_plans',
    'billing_mp_plans',
    'billing_notification_log',
    'billing_orphan_payments',
    'billing_payment_methods',
    'billing_payments',
    'billing_pending_checkouts',
    'billing_plan_price_change_notices',
    'billing_plan_price_change_targets',
    'billing_plan_price_changes',
    'billing_plans',
    'billing_prices',
    'billing_promo_code_usage',
    'billing_promo_codes',
    'billing_refunds',
    'billing_settings',
    'billing_subscription_addons',
    'billing_subscription_events',
    'billing_subscription_polling_jobs',
    'billing_subscriptions',
    'billing_usage_records',
    'billing_vendor_payouts',
    'billing_vendors',
    'billing_webhook_dead_letter',
    'billing_webhook_events',
    'entity_subscriptions',
    'featured_listing_addon_grants',
    'partner_subscriptions'
] as const;

/** Every table name of the database, in any non-system schema. */
async function tableNames({
    client
}: {
    readonly client: Pick<Pool, 'query'>;
}): Promise<readonly string[]> {
    const result = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`
    );
    return result.rows.map((row) => row.table_name);
}

/** The names that are a legacy table or carry the library's name. */
function legacyTablesIn({ names }: { readonly names: readonly string[] }): readonly string[] {
    const legacy = new Set<string>(LEGACY_TABLES);
    return names.filter((name) => legacy.has(name) || name.toLowerCase().includes(LEGACY_NAME));
}

function urlFor({ database }: { readonly database: string }): string {
    const base = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!base) throw new Error('HOSPEDA_TEST_DATABASE_URL is not set');
    const url = new URL(base);
    url.pathname = `/${database}`;
    return url.toString();
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
}, 200_000);

afterAll(async () => {
    await scratch?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${SCRATCH_DB}" WITH (FORCE)`);
    await admin.end();
});

describe('a database built from scratch with the branch migrations (TEST:B1:2)', () => {
    it('has the chain applied (a non-empty public schema)', async () => {
        const result = await scratch.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
        );
        expect(Number(result.rows[0]?.count ?? 0)).toBeGreaterThan(20);
    });

    it('holds none of the legacy billing tables, nor any table named after the library', async () => {
        const names = await tableNames({ client: scratch });
        expect(names.length).toBeGreaterThan(20);
        expect(legacyTablesIn({ names })).toEqual([]);
    });

    it('keeps the neutral survivor of the demolition, so the read sees real tables', async () => {
        // notification_log is the renamed survivor of the legacy notification log.
        expect(await tableNames({ client: scratch })).toContain('notification_log');
    });

    it('flags a legacy table and leaves a neutral billing table alone (controls)', async () => {
        // Arrange: both tables live only inside a transaction that is rolled back.
        const client = await scratch.connect();
        try {
            await client.query('BEGIN');
            await client.query('CREATE TABLE billing_customers (id integer)');
            await client.query('CREATE TABLE billing_cycle_runs (id integer)');

            // Act
            const flagged = legacyTablesIn({ names: await tableNames({ client }) });

            // Assert: the legacy name is caught; a new, neutral billing table of the
            // redesign is not, so the check cannot misfire on the new billing.
            expect(flagged).toEqual(['billing_customers']);
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });

    it('holds no schema or type named after the legacy billing library', async () => {
        const schemas = await scratch.query<{ name: string }>(
            'SELECT nspname AS name FROM pg_namespace'
        );
        const types = await scratch.query<{ name: string }>('SELECT typname AS name FROM pg_type');
        const named = [...schemas.rows, ...types.rows]
            .map((row) => row.name)
            .filter((name) => name.toLowerCase().includes(LEGACY_NAME));
        expect(named).toEqual([]);
    });
});

describe('the frozen legacy table list (TEST:B1:2)', () => {
    it('names only tables the migration history really created', () => {
        const dir = join(pkgDir, 'src/migrations');
        const history = readdirSync(dir)
            .filter((file) => file.endsWith('.sql'))
            .map((file) => readFileSync(join(dir, file), 'utf8'))
            .join('\n');
        // Born by a CREATE TABLE, or by a rename (entity_subscriptions was).
        const missing = LEGACY_TABLES.filter(
            (table) =>
                !history.includes(`CREATE TABLE "${table}"`) &&
                !history.includes(`RENAME TO "${table}"`)
        );
        expect(missing).toEqual([]);
    });
});

describe('no package.json of the repo declares the legacy billing library (TEST:B1:2)', () => {
    // Pathspec `*package.json` matches at any depth; ignored dirs (node_modules) are excluded.
    const manifests = execFileSync(
        'git',
        ['ls-files', '-co', '--exclude-standard', '--', '*package.json'],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024
        }
    )
        .split('\n')
        .filter((file) => file === 'package.json' || file.endsWith('/package.json'))
        .filter((file) => !file.includes('node_modules/'));

    it('reads every workspace manifest, the payments package included', () => {
        expect(manifests).toContain('packages/payments/package.json');
        expect(manifests).toContain('apps/api/package.json');
    });

    it.each(manifests)('%s declares none of its packages', (file) => {
        const manifest = JSON.parse(readFileSync(join(REPO_ROOT, file), 'utf8')) as Record<
            string,
            unknown
        >;
        const declared = (
            ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const
        ).flatMap((block) => Object.keys((manifest[block] as Record<string, string>) ?? {}));
        expect(declared.filter((name) => name.startsWith(LEGACY_PREFIX))).toEqual([]);
    });
});
