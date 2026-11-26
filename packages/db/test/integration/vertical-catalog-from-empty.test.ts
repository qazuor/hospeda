// TEST:V1:1 and TEST:V1:3 — the full migration chain on an empty disposable database.

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CATALOG_KEY_DEFINITIONS,
    VERTICAL_ACTIVATION_EVENT_BY_VERTICAL,
    VerticalEnum
} from '@repo/schemas';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool, withCleanSlate } from './helpers.ts';
import { protectScratchPool, waitForNoConnections } from './support/scratch-database.ts';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Returns the test server URL pointed at `database`. */
function urlFor({ database }: { readonly database: string }): string {
    const base = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!base) throw new Error('HOSPEDA_TEST_DATABASE_URL is not set');
    const url = new URL(base);
    url.pathname = `/${database}`;
    return url.toString();
}

afterAll(async () => {
    await closeTestPool();
});

/** Runs one statement inside a transaction that is always rolled back; returns its error, if any. */
async function rejectedBy(sqlText: string): Promise<{ code?: string; constraint?: string } | null> {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        await client.query(sqlText);
        return null;
    } catch (error) {
        return error as { code?: string; constraint?: string };
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}

describe('TEST:1819:1 AC:1:3 — TEST:V1:1 — vertical table after db:migrate from empty', () => {
    it('has one row per VerticalEnum value, with the activation event of DEC-TRIAL-006', async () => {
        const { rows } = await getTestPool().query<{ id: string; activation_event: string | null }>(
            'SELECT id, activation_event FROM vertical ORDER BY id'
        );

        const expected = Object.values(VerticalEnum)
            .map((id) => ({ id, activation_event: VERTICAL_ACTIVATION_EVENT_BY_VERTICAL[id] }))
            .sort((a, b) => a.id.localeCompare(b.id));
        expect(rows).toEqual(expected);
    });

    it('declares listing_published for the three listing verticals, the Empezar button for tourist and NULL for partner', async () => {
        const { rows } = await getTestPool().query<{ id: string; activation_event: string | null }>(
            'SELECT id, activation_event FROM vertical'
        );
        const byId = Object.fromEntries(rows.map((r) => [r.id, r.activation_event]));

        expect(byId).toEqual({
            accommodation: 'listing_published',
            venue: 'listing_published',
            experience: 'listing_published',
            tourist: 'start_button_pressed',
            partner: null
        });
    });

    it('rejects an activation event outside the closed catalog', async () => {
        const error = await rejectedBy(
            "UPDATE vertical SET activation_event = 'user_signed_up' WHERE id = 'partner'"
        );

        expect(error?.code).toBe('23514');
        expect(error?.constraint).toBe('ck_vertical_activation_event');
    });

    it('rejects a vertical the enum does not know', async () => {
        const error = await rejectedBy(
            "INSERT INTO vertical (id, activation_event) VALUES ('addon', NULL)"
        );

        expect(error?.code).toBe('23514');
        expect(error?.constraint).toBe('ck_vertical_id');
    });
});

describe('TEST:V1:3 — catalog_key table after db:migrate from empty', () => {
    it('holds exactly the catalog keys, each with its four attributes and its class', async () => {
        const { rows } = await getTestPool().query<{
            key: string;
            kind: string;
            scope: string;
            aggregation_strategy: string;
            enforcement_strategy: string;
            key_class: string;
        }>('SELECT * FROM catalog_key ORDER BY key');

        const expected = CATALOG_KEY_DEFINITIONS.map((d) => ({
            key: d.key,
            kind: d.kind,
            scope: d.scope,
            aggregation_strategy: d.aggregationStrategy,
            enforcement_strategy: d.enforcementStrategy,
            key_class: d.keyClass
        })).sort((a, b) => (a.key < b.key ? -1 : 1));
        expect(rows).toEqual(expected);
    });

    it('contains the carousel presence key, COMMERCIAL', async () => {
        const { rows } = await getTestPool().query<{ key_class: string; scope: string }>(
            "SELECT key_class, scope FROM catalog_key WHERE key = 'partner_carousel_presence'"
        );

        expect(rows).toEqual([{ key_class: 'COMMERCIAL', scope: 'vertical' }]);
    });

    it('classifies the two floor keys and the activation capability as BASE, nothing else', async () => {
        const { rows } = await getTestPool().query<{ key: string }>(
            "SELECT key FROM catalog_key WHERE key_class = 'BASE' ORDER BY key"
        );

        expect(rows.map((r) => r.key)).toEqual([
            'activate_trial',
            'recover_own_listing',
            'subscribe_to_plan'
        ]);
    });

    it.each([
        ['kind', "'switch'", 'ck_catalog_key_kind'],
        ['scope', "'tenant'", 'ck_catalog_key_scope'],
        ['aggregation_strategy', "'AVERAGE'", 'ck_catalog_key_aggregation_strategy'],
        ['enforcement_strategy', "'DELETE'", 'ck_catalog_key_enforcement_strategy'],
        ['key_class', "'GRATIS'", 'ck_catalog_key_class']
    ])('rejects an out-of-list %s', async (column, value, constraint) => {
        const error = await rejectedBy(
            `UPDATE catalog_key SET ${column} = ${value} WHERE key = 'max_accommodations'`
        );

        expect(error?.code).toBe('23514');
        expect(error?.constraint).toBe(constraint);
    });
});

// The shared integration database is migrated once by the global setup, but every
// earlier file that calls withCleanSlate TRUNCATEs the migration-written addon catalog
// (MIGRATION_CATALOG_TABLES). Whether these rows survive depends on file order, so
// this describe runs `db:migrate` on its own scratch database instead.
describe('listing photo packs after db:migrate from empty', () => {
    const scratchDb = `hospeda_scratch_photo_packs_${process.pid}`;
    let admin: Pool;
    let scratch: Pool;

    beforeAll(async () => {
        admin = new Pool({ connectionString: urlFor({ database: 'postgres' }) });
        await admin.query(`DROP DATABASE IF EXISTS "${scratchDb}" WITH (FORCE)`);
        await admin.query(`CREATE DATABASE "${scratchDb}"`);
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
                env: { ...process.env, HOSPEDA_DATABASE_URL: urlFor({ database: scratchDb }) },
                stdio: 'pipe',
                timeout: 180_000
            }
        );
        scratch = new Pool({ connectionString: urlFor({ database: scratchDb }) });
        protectScratchPool({ pool: scratch });
    }, 200_000);

    afterAll(async () => {
        await scratch?.end();
        await waitForNoConnections({ admin, database: scratchDb });
        await admin.query(`DROP DATABASE IF EXISTS "${scratchDb}" WITH (FORCE)`);
        await admin.end();
    });

    it('joins each pack to exactly one recurring product and one matching limit', async () => {
        const { rows } = await scratch.query(`
            SELECT a.slug, v.validity, v.validity_days, v.scope_type, l.key, l.value,
                   p.price, p.currency, p.charge_kind, p.cycle, p.compatible_verticals
            FROM addon a
            JOIN addon_version v ON v.addon_id = a.id
            JOIN addon_product p ON p.addon_id = a.id AND p.version_id = v.id
            JOIN addon_version_limit l ON l.addon_version_id = v.id
            WHERE a.slug IN ('extra-photos-experience-20', 'extra-photos-venue-20')
            ORDER BY a.slug
        `);

        expect(rows).toEqual(
            ['experience', 'venue'].map((vertical) => ({
                slug: `extra-photos-${vertical}-20`,
                validity: 'WHILE_SUBSCRIPTION_ALIVE',
                validity_days: null,
                scope_type: 'VERTICAL_SUBSCRIPTION',
                key: `max_photos_per_${vertical}`,
                value: 20,
                price: 500_000,
                currency: 'ARS',
                charge_kind: 'PERIODICO',
                cycle: 'monthly',
                compatible_verticals: [vertical]
            }))
        );
    });
});

// withCleanSlate discards the commercial catalog, so inspect reference offers first.
describe('reference rows survive the integration clean slate', () => {
    it('keeps the 5 verticals and the 87 keys after withCleanSlate', async () => {
        await withCleanSlate(async () => {
            const verticals = await getTestPool().query('SELECT 1 FROM vertical');
            const keys = await getTestPool().query('SELECT 1 FROM catalog_key');

            expect(verticals.rowCount).toBe(Object.values(VerticalEnum).length);
            expect(keys.rowCount).toBe(CATALOG_KEY_DEFINITIONS.length);
            // 82 + vip_only_promotions + max_free_visible_promotions (HOS-2589 D-4, M-4)
            // + ai_assistant_access (HOS-2184 G-6)
            // + max_photos_per_venue + max_photos_per_experience (HOS-2495).
            expect(keys.rowCount).toBe(87);
        });
    });
});

describe('load-bearing catalog_key rows are pinned independently of the code catalog', () => {
    it('stores exactly the BASE and the global keys the spec names', async () => {
        const base = await getTestPool().query<{ key: string }>(
            "SELECT key FROM catalog_key WHERE key_class = 'BASE' ORDER BY key"
        );
        const global = await getTestPool().query<{ key: string }>(
            "SELECT key FROM catalog_key WHERE scope = 'global' ORDER BY key"
        );

        expect(base.rows.map((r) => r.key)).toEqual([
            'activate_trial',
            'recover_own_listing',
            'subscribe_to_plan'
        ]);
        expect(global.rows.map((r) => r.key)).toEqual([
            'ai_assistant_access',
            'has_verification_badge',
            'priority_support',
            'vip_support'
        ]);
    });
});

describe('TEST:1819:1 AC:1:3 — the migration CHECK admits the venue domain', () => {
    it('pins the fix request CHECK to the final domain value', async () => {
        const retiredName = ['gastro', 'nomy'].join('');
        const { rows } = await getTestPool().query<{ conname: string }>(
            `SELECT conname
             FROM pg_constraint
             WHERE conname = $1
               AND pg_get_constraintdef(oid) LIKE '%venue%'
               AND pg_get_constraintdef(oid) NOT LIKE $2`,
            ['fix_request_entity_type_check', `%${retiredName}%`]
        );

        expect(rows).toEqual([{ conname: 'fix_request_entity_type_check' }]);
    });
});

describe('TEST:1819:4 AC:1:3 — the born catalog has no retired vertical identifiers', () => {
    it('has no retired name in vertical, plans, catalog keys or addons', async () => {
        const retiredName = ['gastro', 'nomy'].join('');
        const { rows } = await getTestPool().query<{ count: string }>(`
            SELECT count(*)::text AS count
            FROM (
                SELECT id::text AS value FROM vertical WHERE id::text ILIKE '%${retiredName}%'
                UNION ALL SELECT id::text FROM plan WHERE id::text ILIKE '%${retiredName}%'
                UNION ALL SELECT slug::text FROM plan WHERE slug ILIKE '%${retiredName}%'
                UNION ALL SELECT key::text FROM catalog_key WHERE key ILIKE '%${retiredName}%'
                UNION ALL SELECT id::text FROM addon WHERE id::text ILIKE '%${retiredName}%'
                UNION ALL SELECT slug::text FROM addon WHERE slug ILIKE '%${retiredName}%'
                UNION ALL SELECT id::text FROM addon_version WHERE id::text ILIKE '%${retiredName}%'
                UNION ALL SELECT key::text FROM addon_version_entitlement WHERE key ILIKE '%${retiredName}%'
                UNION ALL SELECT key::text FROM addon_version_limit WHERE key ILIKE '%${retiredName}%'
                UNION ALL SELECT id::text FROM addon_product WHERE id::text ILIKE '%${retiredName}%'
            ) AS born_catalog
        `);

        expect(rows).toEqual([{ count: '0' }]);
    });
});
