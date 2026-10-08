import { type DrizzleClient, planCatalogModel } from '@repo/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { catalogId } from '../../../../scripts/production-catalog/catalog.js';
import { generatePlanCatalogSql } from '../../../../scripts/production-catalog/loads.js';
import type { PlanCatalogReader } from '../../src/plan-catalog/catalog-reader.js';
import { createPlanCatalogInverse } from '../../src/plan-catalog/plan-catalog-inverse.js';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 1 });
afterAll(async () => {
    await pool.end();
});

describe('TEST:V2:6 — change direction over generated catalog on a fresh migrated database', () => {
    it('decides by the version delta in both directions', async () => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const statement of generatePlanCatalogSql().split('--> statement-breakpoint')) {
                if (statement.trim()) await client.query(statement.trim());
            }
            const db = drizzle({ client }) as unknown as DrizzleClient;
            const reader: PlanCatalogReader = {
                findPlanVersion: ({ id }) => planCatalogModel.findPlanVersion({ id, tx: db }),
                findPlanVersionEffects: ({ id }) =>
                    planCatalogModel.findPlanVersionEffects({ id, tx: db }),
                findAddonVersion: ({ id }) => planCatalogModel.findAddonVersion({ id, tx: db }),
                findPlanVersionSummary: ({ id }) =>
                    planCatalogModel.findPlanVersionSummary({ id, tx: db }),
                findSellableCurrentVersions: ({ vertical }) =>
                    planCatalogModel.findSellableCurrentVersions({ vertical, tx: db }),
                findCurrentPlanVersion: ({ planId }) =>
                    planCatalogModel.findCurrentPlanVersion({ planId, tx: db })
            };
            const subject = createPlanCatalogInverse({ reader });
            const floor = catalogId('plan:experience:placeholder-floor:version:1');
            const sellable = catalogId('plan:experience:placeholder-sellable:version:1');
            expect(
                (
                    await subject.changeDirection({
                        fromPlanVersionId: floor,
                        toPlanVersionId: sellable
                    })
                ).direction
            ).toBe('UP');
            expect(
                (
                    await subject.changeDirection({
                        fromPlanVersionId: sellable,
                        toPlanVersionId: floor
                    })
                ).direction
            ).toBe('DOWN');
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });
});
