/**
 * Addon cancel + limit recalculation — SPEC-143 T-143-32.
 *
 * Validates the user-facing individual-addon cancel flow end-to-end:
 *
 * ```
 * POST /api/v1/protected/billing/addons/{purchaseId}/cancel
 *      { reason?: string }
 *
 * → cancelAddonRoute (apps/api/src/routes/billing/addons.ts:290)
 *   ─ ownership check inside withServiceTransaction
 *   ─ AddonService.cancelAddon → cancelUserAddon
 *     ─ phase 1 (tx): UPDATE billing_addon_purchases status='canceled'
 *     ─ phase 2 (post-commit): recalculateAddonLimitsForCustomer
 *       ─ SELECT FOR UPDATE active purchases
 *       ─ filter by affectsLimitKey
 *       ─ resolve subscription + base plan limit from canonical config
 *       ─ sum remaining addon increments
 *       ─ billing.limits.set(...)         when totalIncrement > 0
 *       ─ billing.limits.removeBySource() when totalIncrement === 0
 *   ─ clearEntitlementCache (route side)
 *   ─ audit log
 * → 200 { success: true, data: null }
 * ```
 *
 * IMPORTANT contracts pinned by this suite:
 *
 *   1. The "subscription price recalc" language in the task notes is a
 *      misnomer for this codebase. Each addon is an independent charge
 *      (one-time or recurring); the subscription's preapproval amount is
 *      NOT modified on cancel. What IS recalculated is the customer-level
 *      LIMIT (`billing_customer_limits.max_value` for the affected
 *      `limitKey`). This file pins the limit-recalc contract.
 *
 *   2. The aggregated addon limit is always stored with
 *      {@link ADDON_RECALC_SOURCE_ID} as `source_id` so cleanup via
 *      `removeBySource` does not affect limits owned by other sources
 *      (e.g. manual admin overrides).
 *
 *   3. The route is gated by ownership (`customer_id` + `status='active'`).
 *      Cancelling an already-canceled addon returns 404, not 409 or 422 —
 *      the route surfaces NOT_FOUND because the WHERE clause filters out
 *      non-active rows before the service even runs.
 *
 *   4. The subscription used by these tests carries `planId: 'owner-basico'`
 *      (a canonical slug from `packages/billing/src/config/plans.config.ts`),
 *      NOT the UUID of a billing_plans DB row. recalculateAddonLimitsForCustomer
 *      resolves the base plan via `getPlanBySlug(activeSubscription.planId)`
 *      against the canonical config, so the field must contain the slug.
 *      `billing_subscriptions.plan_id` is varchar and has no FK constraint
 *      against `billing_plans.id`, so passing the slug is safe.
 *
 * @module test/e2e/flows/billing/addon-cancel-recalc
 */

import { vi } from 'vitest';

const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — addon-cancel-recalc.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { billingCustomerEntitlements, eq, sql } from '@repo/db';
import { ADDON_RECALC_SOURCE_ID } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

/**
 * Canonical plan slug whose `MAX_ACCOMMODATIONS` limit is 1. The test
 * subscriptions are pinned to this slug so `getPlanBySlug` resolves it
 * inside `recalculateAddonLimitsForCustomer` and the base limit math is
 * deterministic (1 + addon increments).
 */
const PLAN_SLUG = 'owner-basico';
const PLAN_MAX_ACCOMMODATIONS = 1;

/**
 * Canonical recurring addons from `packages/billing/src/config/addons.config.ts`.
 * Both have a real `affectsLimitKey` (entitlement-only addons like
 * `visibility-boost-7d` skip the recalc path entirely, see
 * addon.user-addons branch at line 274). They target DIFFERENT limitKeys
 * so the multi-addon scoping test can verify a cancel on one does not
 * touch the other's aggregated limit row.
 *
 * - `extra-accommodations-5`: +5 to `MAX_ACCOMMODATIONS`
 * - `extra-photos-20`: +20 to `MAX_PHOTOS_PER_ACCOMMODATION`
 *
 * Both targetCategories include 'owner', so they coexist on the
 * `owner-basico` test subscription. The partial unique index
 * `idx_addon_purchases_active_unique` on `(customer_id, addon_slug)
 * WHERE status='active' AND deleted_at IS NULL` rules out two active
 * purchases of the SAME slug for one customer, which is why this file
 * pins the scoping invariant across DIFFERENT slugs rather than the
 * "remaining increment for same limitKey" case (a synthetic scenario
 * not reachable through the production catalog).
 */
const ADDON_SLUG = 'extra-accommodations-5';
const ADDON_LIMIT_KEY = 'max_accommodations';
const ADDON_INCREMENT = 5;

const OTHER_ADDON_SLUG = 'extra-photos-20';
const OTHER_ADDON_LIMIT_KEY = 'max_photos_per_accommodation';
const OTHER_ADDON_INCREMENT = 20;
const PLAN_MAX_PHOTOS = 5;

describe('SPEC-143 T-143-32 — addon cancel + limit recalc', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let userId: string;
    let customerId: string;
    let subscriptionId: string;

    beforeAll(async () => {
        await testDb.setup();
        // Drop any cached real adapter another test file may have built.
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        const user = await createTestUser({
            email: `addon-cancel-recalc-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}@example.com`
        });
        userId = user.id;
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        customerId = customer.customerId;

        // Subscription planId = canonical slug (not UUID). See the file-level
        // note 4 — recalculateAddonLimitsForCustomer resolves the plan via
        // getPlanBySlug against canonical config, so the slug is what matters.
        const sub = await createTestSubscription({
            customerId,
            planId: PLAN_SLUG,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            metadata: { source: 'test-factory-addon-cancel-recalc' }
        });
        subscriptionId = sub.subscriptionId;

        const actor = createMockUserActor({ id: userId });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Insert an active `billing_addon_purchases` row for a given addon
     * slug + limitKey + increment. The factory bug captured in
     * addon-expiration-cron.test.ts (`createTestAddon` does not set
     * NOT NULL `billing_interval`) means we cannot use the typed factory;
     * raw SQL is the workaround. `limit_adjustments` is shaped as a JSONB
     * array per the production schema's CHECK constraint
     * (`chk_limit_adjustments_type`).
     */
    async function seedActiveAddonPurchase(input: {
        readonly addonSlug: string;
        readonly limitKey: string;
        readonly increment: number;
    }): Promise<string> {
        const purchaseId = randomUUID();
        const limitAdjustments = [{ limitKey: input.limitKey, increase: input.increment }];

        await testDb.getDb().execute(sql`
            INSERT INTO billing_addon_purchases (
                id, customer_id, subscription_id, addon_slug,
                status, purchased_at,
                limit_adjustments, entitlement_adjustments, metadata
            ) VALUES (
                ${purchaseId}, ${customerId}, ${subscriptionId}, ${input.addonSlug},
                'active', NOW(),
                ${JSON.stringify(limitAdjustments)}::jsonb, ${'[]'}::jsonb, ${'{}'}::jsonb
            )
        `);

        return purchaseId;
    }

    /**
     * Seed the aggregated `billing_customer_limits` row that production
     * would have written when the addon was activated via webhook (the
     * `confirmAddonPurchase` → `billing.limits.set` step). We insert this
     * directly to avoid replaying the full webhook flow — the cancel-recalc
     * path only depends on this row being present at cancel-time so the
     * subsequent `removeBySource` / `set` has a target.
     *
     * Mirrors the shape `recalculateAddonLimitsForCustomer` would have
     * written: source='addon', sourceId=ADDON_RECALC_SOURCE_ID, the
     * aggregated maxValue across the active addons of that limitKey.
     */
    async function seedAggregatedCustomerLimit(input: {
        readonly limitKey: string;
        readonly maxValue: number;
    }): Promise<void> {
        await testDb.getDb().execute(sql`
            INSERT INTO billing_customer_limits (
                customer_id, limit_key, max_value, current_value,
                source, source_id, livemode
            ) VALUES (
                ${customerId}, ${input.limitKey}, ${input.maxValue}, 0,
                'addon', ${ADDON_RECALC_SOURCE_ID}, false
            )
        `);
    }

    /**
     * Fetch the aggregated addon-source limit row for this customer + the
     * given limit key. Returns null when no row exists (which is the
     * post-cancel state when the last addon for that limitKey has been
     * removed).
     */
    async function fetchAggregatedLimit(
        limitKey: string
    ): Promise<{ max_value: number; source: string } | null> {
        const rows = (
            await testDb.getDb().execute(sql`
                SELECT max_value, source
                FROM billing_customer_limits
                WHERE customer_id = ${customerId}
                  AND limit_key = ${limitKey}
                  AND source = 'addon'
                  AND source_id = ${ADDON_RECALC_SOURCE_ID}
            `)
        ).rows as Array<{ max_value: number; source: string }>;

        return rows[0] ?? null;
    }

    // ─── Tests ────────────────────────────────────────────────────────────────

    it('cancels a single active addon, flips status=canceled, and removes the aggregated limit row when no addons remain for the limitKey', async () => {
        // ARRANGE — one active limit addon with the matching aggregated
        // customer limit row (basePlan 1 + addon 5 = 6).
        const purchaseId = await seedActiveAddonPurchase({
            addonSlug: ADDON_SLUG,
            limitKey: ADDON_LIMIT_KEY,
            increment: ADDON_INCREMENT
        });
        await seedAggregatedCustomerLimit({
            limitKey: ADDON_LIMIT_KEY,
            maxValue: PLAN_MAX_ACCOMMODATIONS + ADDON_INCREMENT
        });

        // Sanity — the aggregated row exists pre-cancel.
        const preLimit = await fetchAggregatedLimit(ADDON_LIMIT_KEY);
        expect(preLimit?.max_value).toBe(PLAN_MAX_ACCOMMODATIONS + ADDON_INCREMENT);

        // ACT — cancel via the user-facing route.
        const response = await client.post(
            `/api/v1/protected/billing/addons/${purchaseId}/cancel`,
            { reason: 'user-requested' }
        );

        // ASSERT — 201 success envelope (POST default in the route
        // factory). The cancelAddonRoute returns `null` as data — the
        // route's contract is "fire-and-forget cancel; the cache clear and
        // audit log run as side effects and there is no resource payload
        // to surface".
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: null;
        };
        expect(body.success).toBe(true);
        expect(body.data).toBeNull();

        // ASSERT — purchase row flipped to status='canceled' with
        // canceledAt populated. The route runs the UPDATE inside a tx
        // gated on status='active', so a single canceled row is the
        // committed end-state.
        const purchaseRow = (
            await testDb.getDb().execute(sql`
                SELECT status, canceled_at, updated_at
                FROM billing_addon_purchases
                WHERE id = ${purchaseId}
            `)
        ).rows[0] as { status: string; canceled_at: string | null; updated_at: string } | undefined;
        expect(purchaseRow?.status).toBe('canceled');
        expect(purchaseRow?.canceled_at).not.toBeNull();

        // ASSERT — the aggregated addon limit row was REMOVED by
        // `billing.limits.removeBySource('addon', ADDON_RECALC_SOURCE_ID)`.
        // This is the totalAddonIncrement === 0 branch
        // (addon-limit-recalculation.service.ts line 302). With no addons
        // contributing to MAX_ACCOMMODATIONS anymore, QZPay falls back to
        // the base plan limit (1) for that key.
        const postLimit = await fetchAggregatedLimit(ADDON_LIMIT_KEY);
        expect(postLimit).toBeNull();
    });

    it('PINS BUG: canceling one addon also wipes the aggregated limit row of an unrelated limitKey (removeBySource is not scoped by customer or limitKey)', async () => {
        // BUG REGISTRY ENTRY (engram topic: `bug/addon-limit-recalc-removebysource-global`):
        //
        // `recalculateAddonLimitsForCustomer` calls
        // `billing.limits.removeBySource('addon', ADDON_RECALC_SOURCE_ID)` when the
        // totalAddonIncrement for the canceled addon's limitKey drops to 0
        // (addon-limit-recalculation.service.ts:305). The qzpay-drizzle
        // implementation of `deleteBySource`
        // (qzpay/packages/drizzle/src/repositories/limits.repository.ts:269) runs:
        //
        //     DELETE FROM billing_customer_limits
        //     WHERE source = $1 AND source_id = $2
        //
        // It does NOT filter by `customer_id` NOR by `limit_key`. Since
        // `ADDON_RECALC_SOURCE_ID` is a GLOBAL UUID constant
        // (`a0d0e1c2-0000-5000-8000-000000000001`,
        // addon-lifecycle.constants.ts:14) shared by every customer's aggregated
        // addon row, canceling one addon silently nukes the aggregated row of
        // every OTHER limitKey for the same customer (and across customers).
        //
        // This test PINS the current (buggy) behavior so a future fix surfaces
        // here as an INVERTED assertion failure: when the bug is fixed, the
        // OTHER_ADDON_LIMIT_KEY row must persist with its original max_value
        // (PLAN_MAX_PHOTOS + OTHER_ADDON_INCREMENT) and this `toBeNull()`
        // assertion must be flipped to `.not.toBeNull()`.
        //
        // Out of scope for SPEC-143 T-143-32; a follow-up spec must:
        //   1. Extend `deleteBySource` in qzpay-drizzle to accept customerId
        //      (and ideally limitKey).
        //   2. Pipe the customerId through qzpay-core's `removeBySource`
        //      signature.
        //   3. Update `recalculateAddonLimitsForCustomer` to pass it.
        //   4. (Alternative) Derive ADDON_RECALC_SOURCE_ID per customer+limitKey
        //      (e.g. deterministic hash) so the existing API surface still
        //      isolates the delete to the intended row.

        // ARRANGE — two addons of different slugs (the partial unique index
        // `idx_addon_purchases_active_unique` rules out two of the same slug)
        // each contributing to a different limitKey, plus two pre-existing
        // aggregated limit rows that mimic what production would have written
        // at addon activation time.
        const cancelTargetId = await seedActiveAddonPurchase({
            addonSlug: ADDON_SLUG,
            limitKey: ADDON_LIMIT_KEY,
            increment: ADDON_INCREMENT
        });
        const survivorId = await seedActiveAddonPurchase({
            addonSlug: OTHER_ADDON_SLUG,
            limitKey: OTHER_ADDON_LIMIT_KEY,
            increment: OTHER_ADDON_INCREMENT
        });
        await seedAggregatedCustomerLimit({
            limitKey: ADDON_LIMIT_KEY,
            maxValue: PLAN_MAX_ACCOMMODATIONS + ADDON_INCREMENT
        });
        await seedAggregatedCustomerLimit({
            limitKey: OTHER_ADDON_LIMIT_KEY,
            maxValue: PLAN_MAX_PHOTOS + OTHER_ADDON_INCREMENT
        });

        // Sanity — both aggregated rows exist pre-cancel.
        expect((await fetchAggregatedLimit(ADDON_LIMIT_KEY))?.max_value).toBe(
            PLAN_MAX_ACCOMMODATIONS + ADDON_INCREMENT
        );
        expect((await fetchAggregatedLimit(OTHER_ADDON_LIMIT_KEY))?.max_value).toBe(
            PLAN_MAX_PHOTOS + OTHER_ADDON_INCREMENT
        );

        // ACT — cancel the MAX_ACCOMMODATIONS addon only. The recalc for
        // that limitKey lands at totalAddonIncrement === 0 (only addon for
        // that key just got canceled) and fires the global removeBySource.
        const response = await client.post(
            `/api/v1/protected/billing/addons/${cancelTargetId}/cancel`,
            {}
        );
        expect(response.status).toBe(201);

        // ASSERT — purchase rows in the expected end state. Only the
        // targeted purchase flipped to canceled; the survivor purchase
        // row itself is intact (the bug affects aggregated limit rows,
        // not purchase rows).
        const cancelTargetRow = (
            await testDb.getDb().execute(sql`
                SELECT status FROM billing_addon_purchases WHERE id = ${cancelTargetId}
            `)
        ).rows[0] as { status: string } | undefined;
        expect(cancelTargetRow?.status).toBe('canceled');

        const survivorRow = (
            await testDb.getDb().execute(sql`
                SELECT status FROM billing_addon_purchases WHERE id = ${survivorId}
            `)
        ).rows[0] as { status: string } | undefined;
        expect(survivorRow?.status).toBe('active');

        // ASSERT — the aggregated limit row for the CANCELED addon's
        // limitKey was removed (this is the intended part of the flow).
        const postCanceledLimit = await fetchAggregatedLimit(ADDON_LIMIT_KEY);
        expect(postCanceledLimit).toBeNull();

        // ASSERT (BUG PIN) — the aggregated limit row for the UNRELATED
        // limitKey was ALSO removed even though the survivor purchase
        // (extra-photos-20) is still active. The user effectively loses
        // their +20 photos increment until the next webhook reconciles
        // the customer's limits. When the bug is fixed, flip this to
        // `.not.toBeNull()` and add `expect(postOtherLimit?.max_value).toBe(PLAN_MAX_PHOTOS + OTHER_ADDON_INCREMENT)`.
        const postOtherLimit = await fetchAggregatedLimit(OTHER_ADDON_LIMIT_KEY);
        expect(postOtherLimit).toBeNull();
    });

    it('returns 404 when the targeted addon purchase is already canceled (route ownership filter rejects non-active rows)', async () => {
        // ARRANGE — seed a purchase, then flip it to canceled directly.
        // This simulates the idempotency scenario where the same cancel
        // request is replayed (e.g. by a flaky client retry).
        const purchaseId = await seedActiveAddonPurchase({
            addonSlug: ADDON_SLUG,
            limitKey: ADDON_LIMIT_KEY,
            increment: ADDON_INCREMENT
        });
        await testDb.getDb().execute(sql`
            UPDATE billing_addon_purchases
            SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
            WHERE id = ${purchaseId}
        `);

        // Sanity — the row is canceled before the request lands.
        const preRow = (
            await testDb.getDb().execute(sql`
                SELECT status FROM billing_addon_purchases WHERE id = ${purchaseId}
            `)
        ).rows[0] as { status: string } | undefined;
        expect(preRow?.status).toBe('canceled');

        // ACT — attempt to cancel again.
        const response = await client.post(
            `/api/v1/protected/billing/addons/${purchaseId}/cancel`,
            {}
        );

        // ASSERT — 404 NOT_FOUND. The route's ownership SELECT inside
        // withServiceTransaction filters on status='active' AND
        // deleted_at IS NULL (apps/api/src/routes/billing/addons.ts:333),
        // so the second-cancel attempt hits the "Add-on not found or does
        // not belong to your account" branch BEFORE the service even
        // runs. This is the documented idempotency contract for retries.
        expect(response.status).toBe(404);

        // ASSERT — no entitlement grant rows materialized as a side
        // effect (defense-in-depth: the cancel-already-canceled path
        // should be inert).
        const grants = await testDb
            .getDb()
            .select()
            .from(billingCustomerEntitlements)
            .where(eq(billingCustomerEntitlements.customerId, customerId));
        expect(grants).toHaveLength(0);
    });
});
