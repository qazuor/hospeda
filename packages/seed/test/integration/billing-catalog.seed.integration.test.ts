import type { DrizzleClient } from '@repo/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { catalogId, PLACEHOLDER_CATALOG } from '../../../../scripts/production-catalog/catalog.js';
import { generatePlanCatalogSql } from '../../../../scripts/production-catalog/loads.js';
import {
    buildPublicationContext,
    loadEffects
} from '../../../service-core/src/services/plan-catalog/plan-publication.reader.js';
import { validatePublication } from '../../../service-core/src/services/plan-catalog/plan-publication.validation.js';
import { seedBillingCatalog } from '../../src/example/billingCatalog.seed.js';

const pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
const db = drizzle(pool) as unknown as DrizzleClient;
const TABLES = [
    'plan',
    'plan_version',
    'plan_version_entitlement',
    'plan_version_limit',
    'billing_option',
    'addon',
    'addon_version',
    'promo_code'
] as const;

async function counts(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const table of TABLES) {
        const rows = await pool.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM "${table}"`
        );
        result[table] = rows.rows[0]?.count ?? '0';
    }
    return result;
}

afterAll(async () => {
    await pool.query('TRUNCATE TABLE plan_version, plan CASCADE');
    await pool.end();
});

describe('TEST:V2:11 — loaded placeholder satisfies action 18 validation', () => {
    it('validates each version using the same reader and validator as publication', async () => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const statement of generatePlanCatalogSql().split('--> statement-breakpoint')) {
                if (statement.trim()) await client.query(statement.trim());
            }
            const tx = drizzle({ client }) as unknown as DrizzleClient;
            for (const plan of PLACEHOLDER_CATALOG) {
                const planId = catalogId(`plan:${plan.vertical}:${plan.slug}`);
                const versionId = catalogId(`plan:${plan.vertical}:${plan.slug}:version:1`);
                const effects = await loadEffects({ client: tx, versionId });
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
                const context = await buildPublicationContext({ client: tx, planId, content });
                expect(() => validatePublication({ context })).not.toThrow();
            }
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });
});

describe('TEST:V2:13 — example seed respects an existing catalog', () => {
    it('writes no catalog, price, addon or code when any plan exists', async () => {
        await pool.query(
            "INSERT INTO plan (vertical, slug, name) VALUES ('experience', 'existing-v24a', 'Migrated catalog marker')"
        );
        const before = await counts();
        expect(await seedBillingCatalog(db)).toBe('skipped');
        expect(await counts()).toEqual(before);
        await pool.query("DELETE FROM plan WHERE slug = 'existing-v24a'");
    });

    it('loads its own minimal demonstration plan when the catalog is empty', async () => {
        expect((await counts()).plan).toBe('0');
        expect(await seedBillingCatalog(db)).toBe('loaded');
        const after = await counts();
        expect(after.plan).toBe('1');
        expect(after.plan_version).toBe('1');
        expect(after.billing_option).toBe('0');
        expect(after.addon).toBe('0');
        expect(after.promo_code).toBe('0');
        expect(await seedBillingCatalog(db)).toBe('skipped');
        expect(await counts()).toEqual(after);
    });
});
