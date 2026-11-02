import {
    billingOptions,
    catalogKeys,
    eq,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    sql
} from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { readAdminPlanCatalog } from '../../../src/services/plan-catalog/plan-catalog.admin-reader.js';
import { ServiceError } from '../../../src/types/index.js';
import { closeServiceTestPool, withServiceTestTransaction } from './helpers.js';

afterAll(closeServiceTestPool);

const actor = {
    id: crypto.randomUUID(),
    roles: [],
    permissions: [PermissionEnum.MAINTENANCE_MODE_WRITE]
} as const;

describe('TEST:1704:3 admin plan catalog reader', () => {
    it('returns only the vertical plans and current version effects without writing', async () => {
        await withServiceTestTransaction(async (tx) => {
            const suffix = crypto.randomUUID();
            const entitlementKeys = await tx
                .select({ key: catalogKeys.key })
                .from(catalogKeys)
                .where(eq(catalogKeys.kind, 'entitlement'))
                .limit(2);
            const limitKeys = await tx
                .select({ key: catalogKeys.key })
                .from(catalogKeys)
                .where(eq(catalogKeys.kind, 'limit'))
                .limit(1);
            if (entitlementKeys.length < 2 || limitKeys.length < 1)
                throw new Error('Catalog key fixtures are unavailable');
            const [withVersion] = await tx
                .insert(plans)
                .values({
                    vertical: 'accommodation',
                    slug: `hos1704-${suffix}`,
                    name: 'Admin read plan',
                    pricingOrder: 900
                })
                .returning();
            const [withoutVersion] = await tx
                .insert(plans)
                .values({
                    vertical: 'accommodation',
                    slug: `hos1704-empty-${suffix}`,
                    name: 'No current version',
                    pricingOrder: 901
                })
                .returning();
            const [otherVertical] = await tx
                .insert(plans)
                .values({
                    vertical: 'venue',
                    slug: `hos1704-venue-${suffix}`,
                    name: 'Other vertical',
                    pricingOrder: 902
                })
                .returning();
            if (!withVersion || !withoutVersion || !otherVertical)
                throw new Error('Plan rows were not created');
            const [oldVersion] = await tx
                .insert(planVersions)
                .values({
                    planId: withVersion.id,
                    vertical: 'accommodation',
                    rank: 1900000000,
                    current: false,
                    sellable: false,
                    trialDays: 0,
                    graceDays: 0,
                    allowsPause: false
                })
                .returning();
            const [currentVersion] = await tx
                .insert(planVersions)
                .values({
                    planId: withVersion.id,
                    vertical: 'accommodation',
                    rank: 1900000001,
                    current: true,
                    sellable: true,
                    trialDays: 7,
                    graceDays: 14,
                    allowsPause: true,
                    inheritsTouristVip: false
                })
                .returning();
            if (!oldVersion || !currentVersion) throw new Error('Plan versions were not created');
            await tx.insert(planVersionEntitlements).values([
                {
                    planVersionId: currentVersion.id,
                    key: entitlementKeys[1]!.key,
                    planQuota: 20,
                    trialQuota: 5
                },
                { planVersionId: currentVersion.id, key: entitlementKeys[0]!.key }
            ]);
            await tx
                .insert(planVersionLimits)
                .values({ planVersionId: currentVersion.id, key: limitKeys[0]!.key, value: 3 });
            await tx.insert(billingOptions).values([
                {
                    planVersionId: currentVersion.id,
                    cycle: 'monthly',
                    amount: 1000,
                    currency: 'ARS'
                },
                { planVersionId: currentVersion.id, cycle: 'annual', amount: 9000, currency: 'ARS' }
            ]);
            const before = await tx.execute(sql`SELECT
                (SELECT count(*) FROM plan) AS plans,
                (SELECT count(*) FROM plan_version) AS versions,
                (SELECT count(*) FROM plan_version_entitlement) AS entitlements,
                (SELECT count(*) FROM plan_version_limit) AS limits,
                (SELECT count(*) FROM billing_option) AS options`);
            const response = await readAdminPlanCatalog({
                actor,
                vertical: 'accommodation',
                client: tx
            });
            const after = await tx.execute(sql`SELECT
                (SELECT count(*) FROM plan) AS plans,
                (SELECT count(*) FROM plan_version) AS versions,
                (SELECT count(*) FROM plan_version_entitlement) AS entitlements,
                (SELECT count(*) FROM plan_version_limit) AS limits,
                (SELECT count(*) FROM billing_option) AS options`);
            const actual = response.plans.filter((plan) =>
                [withVersion.id, withoutVersion.id].includes(plan.planId)
            );
            expect(actual).toEqual([
                {
                    planId: withVersion.id,
                    slug: withVersion.slug,
                    name: withVersion.name,
                    description: null,
                    pricingOrder: 900,
                    role: null,
                    currentVersion: {
                        versionId: currentVersion.id,
                        rank: currentVersion.rank,
                        sellable: true,
                        trialDays: 7,
                        graceDays: 14,
                        allowsPause: true,
                        inheritsTouristVip: false,
                        entitlements: [
                            { key: entitlementKeys[0]!.key, planQuota: null, trialQuota: null },
                            { key: entitlementKeys[1]!.key, planQuota: 20, trialQuota: 5 }
                        ].sort((a, b) => a.key.localeCompare(b.key)),
                        limits: [{ key: limitKeys[0]!.key, value: 3 }],
                        cycles: ['annual', 'monthly']
                    }
                },
                {
                    planId: withoutVersion.id,
                    slug: withoutVersion.slug,
                    name: withoutVersion.name,
                    description: null,
                    pricingOrder: 901,
                    role: null,
                    currentVersion: null
                }
            ]);
            expect(response.plans.some((plan) => plan.planId === otherVertical.id)).toBe(false);
            expect(after.rows).toEqual(before.rows);
        });
    });

    it('rejects a publisher without permission before database access', async () => {
        const noRead = {
            select: () => {
                throw new Error('database was read');
            }
        } as never;
        await expect(
            readAdminPlanCatalog({
                actor: { ...actor, permissions: [] },
                vertical: 'venue',
                client: noRead
            })
        ).rejects.toBeInstanceOf(ServiceError);
    });
});
