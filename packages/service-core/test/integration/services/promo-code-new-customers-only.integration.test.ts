/**
 * HOS-450 (smoke finding H-74) — `newCustomersOnly` promo restriction (real DB).
 *
 * Regression coverage for a restriction that was implemented but wired to the
 * WRONG identifier: `checkUserHasExistingPlanSubscription` compared
 * `billing_subscriptions.customer_id` (a `billing_customers.id`) against the
 * Better Auth **user** id supplied as `context.userId`. Those are two different
 * identifiers, so the guard never matched a single row and every existing
 * customer could redeem a `new_customers_only` code.
 *
 * These tests MUST run against a real PostgreSQL database. A mocked repository
 * cannot detect this class of bug: the defect is WHICH COLUMN is compared, not
 * the surrounding control flow, and any mock that answers the query as the code
 * asks it will happily agree with the wrong column.
 *
 * Each test runs inside a rollback-isolated transaction (`withServiceTestTransaction`)
 * and seeds its rows with raw SQL through the same `tx` the service uses, so the
 * real WHERE clause is exercised end to end.
 *
 * Runs only under `pnpm test:integration` (which provisions the ephemeral DB);
 * skipped cleanly when `HOSPEDA_TEST_DATABASE_URL` is not set.
 */
import { randomUUID } from 'node:crypto';
import type { QueryContext } from '@repo/db';
import { sql } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validatePromoCode } from '../../../src/services/billing/promo-code/promo-code.validation';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

type TestDb = Awaited<ReturnType<typeof getServiceTestDb>>;

/** Builds a unique uppercase promo code so parallel workers cannot collide. */
function uniqueCode(prefix: string): string {
    return `${prefix}${randomUUID().replace(/-/g, '').slice(0, 12)}`.toUpperCase();
}

/** Inserts a billing plan row and returns its generated UUID. */
async function seedPlan(tx: TestDb, slug: string): Promise<string> {
    const rows = await tx.execute<{ id: string }>(sql`
        INSERT INTO billing_plans (name, description, active, entitlements, limits, livemode, metadata)
        VALUES (
            ${slug},
            ${`Description for ${slug}`},
            true,
            ARRAY[]::text[],
            '{}'::jsonb,
            false,
            ${JSON.stringify({ slug, displayName: slug, category: 'owner', sortOrder: 1 })}::jsonb
        )
        RETURNING id
    `);
    const id = rows.rows?.[0]?.id;
    if (!id) throw new Error('seedPlan: insert returned no id');
    return id;
}

/**
 * Inserts a billing customer whose `external_id` is the Better Auth user id —
 * the canonical user <-> customer link used across the codebase (see
 * `apps/api/src/middlewares/billing-customer.ts`).
 */
async function seedCustomer(tx: TestDb, userId: string): Promise<string> {
    const rows = await tx.execute<{ id: string }>(sql`
        INSERT INTO billing_customers (external_id, email, livemode)
        VALUES (${userId}, ${`hos450-${userId}@test.local`}, false)
        RETURNING id
    `);
    const id = rows.rows?.[0]?.id;
    if (!id) throw new Error('seedCustomer: insert returned no id');
    return id;
}

/** Inserts a subscription linking a billing customer to a plan. */
async function seedSubscription(
    tx: TestDb,
    options: { readonly customerId: string; readonly planId: string; readonly status?: string }
): Promise<void> {
    await tx.execute(sql`
        INSERT INTO billing_subscriptions (
            customer_id, plan_id, status, billing_interval,
            current_period_start, current_period_end, livemode
        )
        VALUES (
            ${options.customerId},
            ${options.planId},
            ${options.status ?? 'active'},
            'month',
            now(),
            now() + interval '30 days',
            false
        )
    `);
}

/**
 * Inserts a `new_customers_only` percentage promo code and returns its code
 * string. Shaped to satisfy the extras/020 CHECK constraints
 * (`effect_kind = 'discount'` requires a value and a valid `value_kind`).
 */
async function seedNewCustomersOnlyCode(tx: TestDb, code: string): Promise<void> {
    await tx.execute(sql`
        INSERT INTO billing_promo_codes (
            code, type, value, active, livemode, new_customers_only,
            effect_kind, value_kind, duration_cycles
        )
        VALUES (
            ${code}, 'percentage', 50, true, false, true,
            'discount', 'percentage', 1
        )
    `);
}

describe('HOS-450 — newCustomersOnly promo restriction (real DB)', () => {
    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'REGRESSION H-74: rejects an existing customer of the SAME plan',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange — a user who is already subscribed to the plan being purchased.
                const userId = randomUUID();
                const planId = await seedPlan(tx, `hos450-same-plan-${randomUUID().slice(0, 8)}`);
                const customerId = await seedCustomer(tx, userId);
                await seedSubscription(tx, { customerId, planId });

                const code = uniqueCode('HOS450SAME');
                await seedNewCustomersOnlyCode(tx, code);

                // Act — validate exactly as the checkout does: `userId` is the
                // Better Auth actor id, NOT the billing customer id.
                const ctx: QueryContext = { tx };
                const result = await validatePromoCode(code, { userId, planId }, ctx);

                // Assert — the restriction must block this redemption.
                expect(result.valid).toBe(false);
                expect(result.errorCode).toBe('PROMO_CODE_NEW_USERS_ONLY');
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'REGRESSION H-74: rejects an existing customer when no planId is supplied (any-plan fallback)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const userId = randomUUID();
                const planId = await seedPlan(tx, `hos450-any-plan-${randomUUID().slice(0, 8)}`);
                const customerId = await seedCustomer(tx, userId);
                await seedSubscription(tx, { customerId, planId });

                const code = uniqueCode('HOS450ANY');
                await seedNewCustomersOnlyCode(tx, code);

                const ctx: QueryContext = { tx };
                const result = await validatePromoCode(code, { userId }, ctx);

                expect(result.valid).toBe(false);
                expect(result.errorCode).toBe('PROMO_CODE_NEW_USERS_ONLY');
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'accepts a customer that exists in billing but has never subscribed',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const userId = randomUUID();
                const planId = await seedPlan(tx, `hos450-no-subs-${randomUUID().slice(0, 8)}`);
                await seedCustomer(tx, userId);

                const code = uniqueCode('HOS450NEW');
                await seedNewCustomersOnlyCode(tx, code);

                const ctx: QueryContext = { tx };
                const result = await validatePromoCode(code, { userId, planId }, ctx);

                expect(result.valid).toBe(true);
            });
        }
    );

    it.skipIf(!dbAvailable)('accepts a user with no billing customer row at all', async () => {
        await withServiceTestTransaction(async (tx) => {
            const userId = randomUUID();
            const planId = await seedPlan(tx, `hos450-no-customer-${randomUUID().slice(0, 8)}`);

            const code = uniqueCode('HOS450NOCUST');
            await seedNewCustomersOnlyCode(tx, code);

            const ctx: QueryContext = { tx };
            const result = await validatePromoCode(code, { userId, planId }, ctx);

            expect(result.valid).toBe(true);
        });
    });

    it.skipIf(!dbAvailable)(
        'accepts a customer subscribed to a DIFFERENT plan (still new to this one)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const userId = randomUUID();
                const suffix = randomUUID().slice(0, 8);
                const subscribedPlanId = await seedPlan(tx, `hos450-plan-a-${suffix}`);
                const targetPlanId = await seedPlan(tx, `hos450-plan-b-${suffix}`);
                const customerId = await seedCustomer(tx, userId);
                await seedSubscription(tx, { customerId, planId: subscribedPlanId });

                const code = uniqueCode('HOS450OTHER');
                await seedNewCustomersOnlyCode(tx, code);

                const ctx: QueryContext = { tx };
                const result = await validatePromoCode(code, { userId, planId: targetPlanId }, ctx);

                expect(result.valid).toBe(true);
            });
        }
    );
});
