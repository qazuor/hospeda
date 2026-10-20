import { type DrizzleClient, planCatalogModel } from '@repo/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import {
    catalogId,
    PRODUCTION_PLAN_CATALOG
} from '../../../../scripts/production-catalog/catalog.js';
import type { PlanCatalogReader } from '../../src/plan-catalog/catalog-reader.js';
import { createPlanCatalogInverse } from '../../src/plan-catalog/plan-catalog-inverse.js';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 1 });
afterAll(async () => {
    await pool.end();
});

const versionId = (vertical: string, slug: string) =>
    catalogId(`plan:${vertical}:${slug}:version:1`);

describe('TEST:V2:6 — direction from real catalog loaded by the complete migration chain', () => {
    it('uses the entitlement and limit delta in both directions for each owner tier and the floor', async () => {
        const client = await pool.connect();
        try {
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
            for (const vertical of ['accommodation', 'gastronomy', 'experience'] as const) {
                const tiers = PRODUCTION_PLAN_CATALOG.filter(
                    (plan) => plan.vertical === vertical && plan.version.sellable
                ).sort((a, b) => a.version.rank - b.version.rank);
                expect(tiers).toHaveLength(3);
                for (const [lower, higher] of [
                    [tiers[0]!, tiers[1]!],
                    [tiers[1]!, tiers[2]!]
                ] as const) {
                    expect(
                        (
                            await subject.changeDirection({
                                fromPlanVersionId: versionId(vertical, lower.slug),
                                toPlanVersionId: versionId(vertical, higher.slug)
                            })
                        ).direction
                    ).toBe('UP');
                    expect(
                        (
                            await subject.changeDirection({
                                fromPlanVersionId: versionId(vertical, higher.slug),
                                toPlanVersionId: versionId(vertical, lower.slug)
                            })
                        ).direction
                    ).toBe('DOWN');
                }
                expect(
                    (
                        await subject.changeDirection({
                            fromPlanVersionId: versionId(vertical, tiers[0]!.slug),
                            toPlanVersionId: versionId(vertical, 'floor')
                        })
                    ).direction
                ).toBe('DOWN');
            }
        } finally {
            client.release();
        }
    });
});
