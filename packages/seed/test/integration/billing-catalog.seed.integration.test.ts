import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    catalogId,
    PRODUCTION_PLAN_CATALOG
} from '../../../../scripts/production-catalog/catalog.js';
import {
    buildPublicationContext,
    loadEffects
} from '../../../service-core/src/services/plan-catalog/plan-publication.reader.js';
import { validatePublication } from '../../../service-core/src/services/plan-catalog/plan-publication.validation.js';
import { seedBillingCatalog } from '../../src/example/billingCatalog.seed.js';

const migratedPool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
const migratedDb = drizzle(migratedPool) as unknown as DrizzleClient;
const baseUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
if (!baseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const emptyUrl = new URL(baseUrl);
const emptyName = 'hospeda_v24b_seed_empty_test';
emptyUrl.pathname = `/${emptyName}`;
const adminPool = new Pool({ connectionString: adminUrl.toString() });
const migrationDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../db/src/migrations');
const TABLES = [
    'plan',
    'plan_version',
    'plan_version_entitlement',
    'plan_version_limit',
    'billing_option',
    'addon',
    'addon_version',
    'addon_version_entitlement',
    'addon_version_limit',
    'addon_product',
    'promo_code'
] as const;

let emptyPool: Pool;

async function counts(pool: Pool): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const table of TABLES) {
        const rows = await pool.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM "${table}"`
        );
        result[table] = rows.rows[0]?.count ?? '0';
    }
    return result;
}

beforeAll(async () => {
    await adminPool.query(`DROP DATABASE IF EXISTS ${emptyName} WITH (FORCE)`);
    await adminPool.query(`CREATE DATABASE ${emptyName}`);
    emptyPool = new Pool({ connectionString: emptyUrl.toString() });
    for (const extension of ['uuid-ossp', 'pgcrypto', 'unaccent']) {
        await emptyPool.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
    }
    const journal = JSON.parse(readFileSync(join(migrationDir, 'meta/_journal.json'), 'utf8')) as {
        entries: { idx: number; tag: string }[];
    };
    for (const entry of journal.entries
        .filter((item) => item.idx < 144)
        .sort((a, b) => a.idx - b.idx)) {
        const sql = readFileSync(join(migrationDir, `${entry.tag}.sql`), 'utf8');
        for (const chunk of sql.split('--> statement-breakpoint')) {
            if (chunk.trim()) await emptyPool.query(chunk.trim());
        }
    }
}, 300_000);

afterAll(async () => {
    await migratedPool.end();
    if (emptyPool) await emptyPool.end();
    try {
        await adminPool.query(`DROP DATABASE IF EXISTS ${emptyName} WITH (FORCE)`);
    } finally {
        await adminPool.end();
    }
});

describe('TEST:V2:11 — migrated catalog satisfies action 18 validation', () => {
    it('validates each real version using the publication reader and validator', async () => {
        for (const plan of PRODUCTION_PLAN_CATALOG) {
            const planId = catalogId(`plan:${plan.vertical}:${plan.slug}`);
            const versionId = catalogId(`plan:${plan.vertical}:${plan.slug}:version:1`);
            const effects = await loadEffects({ client: migratedDb, versionId });
            const content = {
                rank: plan.version.rank,
                sellable: plan.version.sellable,
                trialDays: plan.version.trialDays,
                graceDays: plan.version.graceDays,
                allowsPause: plan.version.allowsPause,
                inheritsTouristVip: plan.version.inheritsTouristVip,
                entitlements: [...effects.entitlements],
                limits: [...effects.limits]
            };
            const context = await buildPublicationContext({ client: migratedDb, planId, content });
            expect(() => validatePublication({ context }), plan.slug).not.toThrow();
        }
    });
});

describe('TEST:V2:13 — example seed respects a migrated catalog', () => {
    it('writes no plan, version, effects, price, addon or code on the fully migrated database', async () => {
        const before = await counts(migratedPool);
        expect(Number(before.plan)).toBe(PRODUCTION_PLAN_CATALOG.length);
        expect(await seedBillingCatalog(migratedDb)).toBe('skipped');
        expect(await counts(migratedPool)).toEqual(before);
        const demonstration = await migratedPool.query<{ count: string }>(
            "SELECT count(*)::text AS count FROM plan WHERE slug = 'example-experience'"
        );
        expect(demonstration.rows[0]?.count).toBe('0');
    });

    it('loads its own demonstration plan on a database migrated only through 0143', async () => {
        const before = await counts(emptyPool);
        expect(before.plan).toBe('0');
        const emptyDb = drizzle(emptyPool) as unknown as DrizzleClient;
        expect(await seedBillingCatalog(emptyDb)).toBe('loaded');
        const after = await counts(emptyPool);
        expect(after.plan).toBe('1');
        expect(after.plan_version).toBe('1');
        for (const table of TABLES.filter((name) => name !== 'plan' && name !== 'plan_version')) {
            expect(after[table], table).toBe(before[table]);
        }
        const demonstration = await emptyPool.query<{ slug: string }>(
            "SELECT slug FROM plan WHERE slug = 'example-experience'"
        );
        expect(demonstration.rows).toEqual([{ slug: 'example-experience' }]);
        expect(await seedBillingCatalog(emptyDb)).toBe('skipped');
        expect(await counts(emptyPool)).toEqual(after);
    });
});
