/**
 * SPEC-168 — `listPlans` admin-list integration test (real DB).
 *
 * Verifies against a real PostgreSQL database that:
 * - `includeDeleted: true` returns soft-deleted plans while
 *   `includeDeleted: false` / `undefined` excludes them.
 * - `activeSubscriptionCount` reflects ONLY subscriptions whose status is
 *   `active` or `trialing` and that are not soft-deleted, grouped per plan.
 *
 * Each test runs inside a rollback-isolated transaction (see
 * `withServiceTestTransaction`) so the seeded rows never persist. Rows are
 * seeded with raw SQL through the same `tx` the service uses, so the test
 * exercises the real WHERE/count query in `listPlans` — no DB mocks.
 *
 * Runs only under `pnpm test:integration` (which provisions the ephemeral DB);
 * skipped cleanly when `HOSPEDA_TEST_DATABASE_URL` is not set.
 */
import { sql } from '@repo/db';
import type { AdminBillingPlanResponse } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    listPlans,
    restorePlan,
    softDeletePlan
} from '../../../src/services/billing/plan/plan.crud';
import type { ServiceContext } from '../../../src/types';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

/**
 * Inserts a billing plan row directly. Returns the generated plan id.
 *
 * `deletedAt` is set when `deleted` is true so the soft-delete filter can be
 * exercised. The display metadata mirrors what `createPlan` would persist.
 */
async function seedPlan(
    tx: Awaited<ReturnType<typeof getServiceTestDb>>,
    options: {
        readonly slug: string;
        readonly category: string;
        readonly sortOrder: number;
        readonly deleted?: boolean;
    }
): Promise<string> {
    const rows = await tx.execute<{ id: string }>(sql`
        INSERT INTO billing_plans (name, description, active, entitlements, limits, livemode, metadata, deleted_at)
        VALUES (
            ${options.slug},
            ${`Description for ${options.slug}`},
            true,
            ARRAY[]::text[],
            '{}'::jsonb,
            false,
            ${JSON.stringify({
                slug: options.slug,
                displayName: options.slug,
                category: options.category,
                sortOrder: options.sortOrder
            })}::jsonb,
            ${options.deleted ? sql`now()` : sql`NULL`}
        )
        RETURNING id
    `);
    const id = rows.rows?.[0]?.id;
    if (!id) throw new Error('seedPlan: insert returned no id');
    return id;
}

/** Inserts a billing customer and returns its id. */
async function seedCustomer(
    tx: Awaited<ReturnType<typeof getServiceTestDb>>,
    suffix: string
): Promise<string> {
    const rows = await tx.execute<{ id: string }>(sql`
        INSERT INTO billing_customers (external_id, email, livemode)
        VALUES (${`ext-${suffix}`}, ${`customer-${suffix}@test.local`}, false)
        RETURNING id
    `);
    const id = rows.rows?.[0]?.id;
    if (!id) throw new Error('seedCustomer: insert returned no id');
    return id;
}

/** Inserts a subscription referencing `planId` with the given status. */
async function seedSubscription(
    tx: Awaited<ReturnType<typeof getServiceTestDb>>,
    options: {
        readonly customerId: string;
        readonly planId: string;
        readonly status: string;
        readonly deleted?: boolean;
    }
): Promise<void> {
    await tx.execute(sql`
        INSERT INTO billing_subscriptions (
            customer_id, plan_id, status, billing_interval,
            current_period_start, current_period_end, livemode, deleted_at
        )
        VALUES (
            ${options.customerId},
            ${options.planId},
            ${options.status},
            'month',
            now(),
            now() + interval '30 days',
            false,
            ${options.deleted ? sql`now()` : sql`NULL`}
        )
    `);
}

/** Finds an item by plan id in a listPlans result. */
function findItem(items: readonly AdminBillingPlanResponse[], id: string) {
    return items.find((item) => item.id === id);
}

describe('SPEC-168 — listPlans admin list (real DB)', () => {
    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'excludes soft-deleted plans by default and includes them with includeDeleted',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const livePlanId = await seedPlan(tx, {
                    slug: 'spec168-live',
                    category: 'owner',
                    sortOrder: 1
                });
                const deletedPlanId = await seedPlan(tx, {
                    slug: 'spec168-deleted',
                    category: 'owner',
                    sortOrder: 2,
                    deleted: true
                });

                const ctx: ServiceContext = { tx };

                // Default: soft-deleted plan must be absent.
                const defaultResult = await listPlans({ pageSize: 100 }, ctx);
                expect(defaultResult.success).toBe(true);
                if (!defaultResult.success) throw new Error('expected success');
                const defaultIds = defaultResult.data.items.map((i) => i.id);
                expect(defaultIds).toContain(livePlanId);
                expect(defaultIds).not.toContain(deletedPlanId);
                // The live plan is flagged not-deleted.
                expect(findItem(defaultResult.data.items, livePlanId)?.isDeleted).toBe(false);

                // includeDeleted=true: the soft-deleted plan reappears, flagged.
                const inclResult = await listPlans({ pageSize: 100, includeDeleted: true }, ctx);
                expect(inclResult.success).toBe(true);
                if (!inclResult.success) throw new Error('expected success');
                const inclIds = inclResult.data.items.map((i) => i.id);
                expect(inclIds).toContain(livePlanId);
                expect(inclIds).toContain(deletedPlanId);
                expect(findItem(inclResult.data.items, deletedPlanId)?.isDeleted).toBe(true);
            });
        }
    );

    // -------------------------------------------------------------------------
    // SPEC-168 bug regression — restore MUST clear deletedAt (not just toggle active)
    // -------------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'restore: after soft-delete + restore, DB row has deletedAt=null and active=true',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const planId = await seedPlan(tx, {
                    slug: 'spec168-restore-bug',
                    category: 'owner',
                    sortOrder: 1
                });

                const ctx: ServiceContext = { tx };

                // Step 1: soft-delete the plan — sets deletedAt + active=false
                const deleteResult = await softDeletePlan(planId, {}, ctx);
                expect(deleteResult.success).toBe(true);

                // Verify it is soft-deleted in DB
                const afterDeleteRows = await tx.execute<{
                    deleted_at: string | null;
                    active: boolean;
                }>(sql`SELECT deleted_at, active FROM billing_plans WHERE id = ${planId}`);
                const afterDeleteRow = afterDeleteRows.rows?.[0];
                expect(afterDeleteRow?.deleted_at).not.toBeNull();
                expect(afterDeleteRow?.active).toBe(false);

                // Step 2: restore — must clear deletedAt AND set active=true
                const restoreResult = await restorePlan(planId, {}, ctx);
                expect(restoreResult.success).toBe(true);
                if (!restoreResult.success) throw new Error('expected success');

                // Critical assertion: deletedAt must be NULL after restore (the actual bug)
                const afterRestoreRows = await tx.execute<{
                    deleted_at: string | null;
                    active: boolean;
                }>(sql`SELECT deleted_at, active FROM billing_plans WHERE id = ${planId}`);
                const afterRestoreRow = afterRestoreRows.rows?.[0];
                expect(afterRestoreRow?.deleted_at).toBeNull();
                expect(afterRestoreRow?.active).toBe(true);

                // The returned DTO must reflect the restored state
                expect(restoreResult.data.isActive).toBe(true);

                // The plan must now appear in the default list (deletedAt IS NULL)
                const listResult = await listPlans({ pageSize: 100 }, ctx);
                expect(listResult.success).toBe(true);
                if (!listResult.success) throw new Error('expected success');
                const ids = listResult.data.items.map((i) => i.id);
                expect(ids).toContain(planId);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'restore: returns VALIDATION_ERROR when plan is not soft-deleted',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const planId = await seedPlan(tx, {
                    slug: 'spec168-restore-guard',
                    category: 'owner',
                    sortOrder: 1
                });

                // Plan exists and is NOT soft-deleted — restore must be rejected
                const ctx: ServiceContext = { tx };
                const result = await restorePlan(planId, {}, ctx);
                expect(result.success).toBe(false);
                if (result.success) throw new Error('expected failure');
                expect(result.error.code).toBe('VALIDATION_ERROR');
            });
        }
    );

    it.skipIf(!dbAvailable)('restore: returns NOT_FOUND for a non-existent plan UUID', async () => {
        await withServiceTestTransaction(async (tx) => {
            const ctx: ServiceContext = { tx };
            const result = await restorePlan('00000000-dead-4000-8000-000000000000', {}, ctx);
            expect(result.success).toBe(false);
            if (result.success) throw new Error('expected failure');
            expect(result.error.code).toBe('NOT_FOUND');
        });
    });

    it.skipIf(!dbAvailable)(
        'activeSubscriptionCount counts only active/trialing non-deleted subscriptions',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const planWithSubsId = await seedPlan(tx, {
                    slug: 'spec168-subs',
                    category: 'owner',
                    sortOrder: 1
                });
                const planNoSubsId = await seedPlan(tx, {
                    slug: 'spec168-nosubs',
                    category: 'owner',
                    sortOrder: 2
                });

                const customerId = await seedCustomer(tx, 'spec168');

                // 2 live subscribers: active + trialing.
                await seedSubscription(tx, {
                    customerId,
                    planId: planWithSubsId,
                    status: 'active'
                });
                await seedSubscription(tx, {
                    customerId,
                    planId: planWithSubsId,
                    status: 'trialing'
                });
                // Must NOT be counted: canceled status.
                await seedSubscription(tx, {
                    customerId,
                    planId: planWithSubsId,
                    status: 'canceled'
                });
                // Must NOT be counted: soft-deleted (even though status=active).
                await seedSubscription(tx, {
                    customerId,
                    planId: planWithSubsId,
                    status: 'active',
                    deleted: true
                });

                const ctx: ServiceContext = { tx };
                const result = await listPlans({ pageSize: 100 }, ctx);
                expect(result.success).toBe(true);
                if (!result.success) throw new Error('expected success');

                // Plan with 2 live subs (active + trialing); canceled + deleted ignored.
                expect(findItem(result.data.items, planWithSubsId)?.activeSubscriptionCount).toBe(
                    2
                );
                // Plan with no subs at all.
                expect(findItem(result.data.items, planNoSubsId)?.activeSubscriptionCount).toBe(0);
            });
        }
    );
});
