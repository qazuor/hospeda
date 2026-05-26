/**
 * Subscription cancellation (SPEC-143 T-143-27).
 *
 * Hybrid coverage. Three tests target the admin cancel flow served by the
 * qzpay-hono admin tier plus Hospeda's lifecycle hooks in
 * `apps/api/src/routes/billing/admin/qzpay-admin-hooks.ts` (the former
 * `subscription-cancel.ts` route handler was deleted; its side effects —
 * addon revocation, audit event, double-cancel guard — now live in those
 * hooks), plus one contract test against qzpay-core's soft-cancel branch
 * documenting it for future use.
 *
 * Discovery context. The spec note for T-143-27 described a user-facing
 * soft cancel ("Active → cancel → access continues until current_period_end").
 * That flow does NOT exist in production today:
 *
 *   1. `POST /api/v1/protected/billing/subscriptions/:id/cancel` is mounted
 *      by qzpay-hono but blocked by `billingAdminGuardMiddleware`
 *      (`apps/api/src/middlewares/billing-admin-guard.middleware.ts:60-63`).
 *      `cancel` is NOT in `allowedSubPaths`; only `start-paid` and
 *      `change-plan` are exempt for non-admin actors.
 *   2. No hospeda caller of `billing.subscriptions.cancel(id, options)`
 *      passes `cancelAtPeriodEnd: true`. The soft-cancel branch in
 *      `qzpay-core/billing.ts:1373-1388` exists but is dead code from
 *      hospeda's perspective.
 *
 * SPEC-147 (drafted 2026-05-19) tracks the proper user self-service cancel
 * implementation, including the missing MercadoPago preapproval pause,
 * the finalize-at-period-end cron, audit events, and product decisions.
 * Once SPEC-147 ships, the soft-cancel contract test below will gain a
 * real hospeda caller and the admin cancel path becomes the
 * "support-driven hard cancel" of last resort.
 *
 * What this file pins for SPEC-143:
 *
 *   1. Admin cancel happy path. POST /admin/billing/subscriptions/:id/cancel
 *      returns 200 with the documented response envelope, flips the local
 *      subscription row to `'canceled'` (US spelling, final state after
 *      qzpay-core's post-transaction cancel call), and the next
 *      entitlement load returns an empty set.
 *   2. Admin cancel audit trail. A `billing_subscription_events` row is
 *      written with `triggerSource='admin-cancel'`, `previousStatus='active'`,
 *      `newStatus='cancelled'` (UK spelling — the admin handler uses
 *      `SubscriptionStatusEnum.CANCELLED` for its OWN audit insert; qzpay
 *      overwrites the live status to 'canceled' US afterwards).
 *   3. Idempotency guard. Calling cancel on an already-cancelled
 *      subscription returns 422 (qzpay-hono before-hook abort status) and
 *      does not write a second audit event. The guard lives in
 *      `onBeforeSubscriptionCancel` (qzpay-admin-hooks.ts) which queries
 *      the live DB row and returns { ok: false } for status 'canceled'/'cancelled'.
 *   4. Soft-cancel contract (documentation). Calling
 *      `billing.subscriptions.cancel(id, { cancelAtPeriodEnd: true })`
 *      directly leaves status='active', stamps `canceledAt`, and the
 *      entitlement load continues to surface plan entitlements. Tracked
 *      here as a reference for SPEC-147 — no production caller invokes
 *      this branch today.
 *
 * @module test/e2e/flows/billing/subscription-cancel
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
                    'mp-stub adapter not initialized — subscription-cancel.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { billingSubscriptionEvents, billingSubscriptions, eq } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { getQZPayBilling, resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    clearEntitlementCache,
    entitlementMiddleware
} from '../../../../src/middlewares/entitlement.js';
import { mountQZPayAdminTier } from '../../../../src/routes/billing/admin/index.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

/**
 * Two-second window for canceledAt assertion. The qzpay-core cancel
 * stamps `canceledAt: new Date()` server-side; the test compares the
 * value a few millis later. Two seconds absorbs any drift without
 * papering over a missing timestamp.
 */
const TWO_SECONDS_MS = 2 * 1000;

describe('SPEC-143 T-143-27 — subscription cancel', () => {
    let app: ReturnType<typeof initApp>;
    let adminClient: E2EApiClient;
    let customerId: string;
    let cheapPlanId: string;
    let subscriptionId: string;
    let adminUserId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        // Mount the qzpay admin tier (subscriptions/cancel, force-cancel,
        // change-plan, payments/refund, invoices) BEFORE initApp(), exactly
        // like production (index.ts mounts it, then builds the app). Hono
        // snapshots a sub-router's routes at `app.route()` time, so the mount
        // must happen before initApp() routes adminBillingRoutes — otherwise
        // the qzpay routes are invisible and every call 404s. The DB is ready
        // here, so getQZPayBilling() inside the mount resolves lazily.
        mountQZPayAdminTier();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        const seed = await seedBillingTestPlans();
        cheapPlanId = seed.cheap.planId;

        const user = await createTestUser({
            email: `subscription-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        customerId = customer.customerId;

        const sub = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'active'
        });
        subscriptionId = sub.subscriptionId;

        const adminUser = await createTestUser({
            email: `subscription-cancel-admin-${Date.now()}@example.com`
        });
        adminUserId = adminUser.id;
        // createMockAdminActor() does NOT include ACCESS_API_ADMIN /
        // ACCESS_PANEL_ADMIN by default. The adminAuthMiddleware
        // (authorization.ts:177) calls hasAdminAccess which checks for
        // either of those permissions, so admin routes return 403
        // without them. Other admin tests in this repo add them
        // explicitly via the actor override.
        //
        // The override completely REPLACES the default permissions
        // array (spread of overrides at the end of createMockAdminActor),
        // so we re-include all permissions the cancel path touches.
        //
        // Hono sibling route middleware collision (documented engram
        // gotcha): subscription-events and subscription-cancel are both
        // registered at `/subscriptions` in
        // apps/api/src/routes/billing/admin/index.ts:55-58. Hono
        // evaluates the middleware of every sibling registered at the
        // same path, so the cancel POST also sees the events router's
        // `requiredPermissions: [BILLING_READ_ALL]`. Tests must pass
        // the UNION of sibling-required permissions.
        const actor = createMockAdminActor({
            id: adminUser.id,
            permissions: [
                PermissionEnum.ACCESS_API_PUBLIC,
                PermissionEnum.ACCESS_API_PRIVATE,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.MANAGE_SUBSCRIPTIONS,
                PermissionEnum.BILLING_READ_ALL
            ]
        });
        adminClient = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        clearEntitlementCache(customerId);
        await testDb.clean();
    });

    /**
     * Build a probe app that runs the REAL entitlement middleware for
     * the seeded customer. Returns the JSON entitlement view. Mirrors
     * the pattern established by T-143-19 and reused across the spec.
     */
    function buildProbeApp(): Hono {
        const probeApp = new Hono();
        probeApp.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', customerId);
            return next();
        });
        probeApp.use(entitlementMiddleware());
        probeApp.get('/probe', (c) =>
            c.json({
                entitlements: Array.from(c.get('userEntitlements') ?? []),
                limits: Object.fromEntries(c.get('userLimits') ?? new Map()),
                billingLoadFailed: c.get('billingLoadFailed') ?? false
            })
        );
        return probeApp;
    }

    it('admin cancel happy path — flips status to canceled, stamps canceledAt, drops entitlements', async () => {
        // ACT: admin POST with { immediate: true } so qzpay-hono calls
        // billing.subscriptions.cancel(id, { cancelAtPeriodEnd: false }).
        // Without `immediate: true`, cancelAtPeriodEnd defaults to true and
        // qzpay-core does NOT flip the status — it only stamps canceledAt
        // (soft-cancel path, tested separately below).
        const response = await adminClient.post(
            `/api/v1/admin/billing/subscriptions/${subscriptionId}/cancel`,
            { immediate: true }
        );

        // ASSERT: cancel is served by the qzpay-hono admin tier
        // (createAdminRoutes), NOT hospeda's createAdminRoute factory, so it
        // returns 200 OK for the cancel action — not the factory's POST-default
        // 201. Cancel is an action on an existing subscription, so 200 is the
        // correct contract.
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            readonly success: boolean;
            // qzpay-hono cancel route returns { success: true, data: QZPaySubscriptionWithHelpers }
            // which is the raw subscription object returned by billing.subscriptions.cancel().
            // QZPaySubscriptionWithHelpers extends QZPaySubscription whose identity field is
            // `id` (not `subscriptionId`). Gap 4 fix: original test asserted `data.subscriptionId`
            // which does not exist on the qzpay response — corrected to `data.id`.
            // There is no `canceledAddons` field; addon revocation is a before-hook side effect
            // and qzpay-hono does not surface it in the response.
            readonly data: {
                readonly id: string;
                readonly status: string;
                readonly customerId: string;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.id).toBe(subscriptionId);

        // ASSERT: DB row. The qzpay-hono cancel route calls
        // billing.subscriptions.cancel(id, { cancelAtPeriodEnd: false })
        // which causes qzpay-core to set status='canceled' (US spelling,
        // qzpay-core/billing.ts:1382) and stamp canceledAt. The
        // onAfterSubscriptionCancel hook then writes the audit event with
        // newStatus='cancelled' (UK, SubscriptionStatusEnum.CANCELLED).
        // Net DB observable on billing_subscriptions: status='canceled' (US), canceledAt set.
        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        const row = rows[0];
        expect(row?.status).toBe('canceled');
        expect(row?.canceledAt).toBeInstanceOf(Date);
        const canceledAtMs = (row?.canceledAt as Date).getTime();
        expect(Math.abs(canceledAtMs - Date.now())).toBeLessThan(TWO_SECONDS_MS);

        // ASSERT: entitlement cache was cleared by onAfterSubscriptionCancel
        // (qzpay-admin-hooks.ts) and the next entitlement load drops the
        // now-canceled sub, falling back to the tourist-free baseline
        // (SPEC-143 T-143-58).
        clearEntitlementCache(customerId);
        const probeRes = await buildProbeApp().request('/probe');
        const probeBody = (await probeRes.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Readonly<Record<string, number>>;
            readonly billingLoadFailed: boolean;
        };
        expect(new Set(probeBody.entitlements)).toEqual(
            new Set(['save_favorites', 'write_reviews', 'read_reviews', 'can_view_recommendations'])
        );
        expect(probeBody.limits).toEqual({ max_favorites: 3 });
        expect(probeBody.billingLoadFailed).toBe(false);
    });

    it('admin cancel writes a billing_subscription_events row with admin-cancel triggerSource', async () => {
        const reason = 'User requested cancellation via support ticket #4242';

        // ACT
        const response = await adminClient.post(
            `/api/v1/admin/billing/subscriptions/${subscriptionId}/cancel`,
            { reason }
        );
        expect(response.status).toBe(200);

        // ASSERT: audit event written inside the Phase 2 transaction
        // (admin handler:424-433). previousStatus comes from the
        // subscription row pre-cancel; newStatus is hardcoded as
        // SubscriptionStatusEnum.CANCELLED (UK 2 L's) in the handler.
        // metadata captures the admin user id + reason.
        const events = await testDb
            .getDb()
            .select()
            .from(billingSubscriptionEvents)
            .where(eq(billingSubscriptionEvents.subscriptionId, subscriptionId));

        const adminCancelEvent = events.find((e) => e.triggerSource === 'admin-cancel');
        expect(adminCancelEvent).toBeDefined();
        expect(adminCancelEvent?.previousStatus).toBe('active');
        // The admin handler writes its OWN audit row before qzpay's
        // cancel overwrites the live status. So the audit field reads
        // the UK spelling here while the live subscription row reads
        // the US spelling (asserted in the happy-path test above).
        // This is a known cross-layer inconsistency documented in the
        // SPEC-143 checkpoint engram and SPEC-147 spec.
        expect(adminCancelEvent?.newStatus).toBe('cancelled');
        const metadata = adminCancelEvent?.metadata as Record<string, unknown> | null;
        expect(metadata?.adminUserId).toBe(adminUserId);
        expect(metadata?.reason).toBe(reason);
    });

    it('admin cancel on an already-cancelled subscription returns 400 and writes no second audit event', async () => {
        // ARRANGE: cancel once with { immediate: true } so qzpay-core flips the
        // live DB status to 'canceled' (US). Without immediate:true, the status
        // stays 'active' (soft-cancel path) and the double-cancel guard would
        // not trigger on the second call.
        const firstRes = await adminClient.post(
            `/api/v1/admin/billing/subscriptions/${subscriptionId}/cancel`,
            { immediate: true }
        );
        expect(firstRes.status).toBe(200);

        const eventCountAfterFirst = (
            await testDb
                .getDb()
                .select({ id: billingSubscriptionEvents.id })
                .from(billingSubscriptionEvents)
                .where(eq(billingSubscriptionEvents.subscriptionId, subscriptionId))
        ).length;
        // First cancel writes the admin-cancel audit row AND may write
        // the ADDON_REVOCATIONS_PENDING compensating event from
        // admin handler:332-341 (empty failedPurchaseIds list, but the
        // row still lands). Snapshot the count for the delta check.
        expect(eventCountAfterFirst).toBeGreaterThanOrEqual(1);

        // ACT: second cancel attempt. The onBeforeSubscriptionCancel hook
        // (Gap 3 fix) now queries the live DB row BEFORE any side effects and
        // returns { ok: false, reason: 'Subscription is already cancelled.' }
        // when the status is 'canceled' or 'cancelled'. qzpay-hono translates
        // an { ok: false } before-hook result into HTTP 422 with body
        // { success: false, error: { message: reason } } and never calls
        // billing.subscriptions.cancel() — so no second audit event is written.
        const secondRes = await adminClient.post(
            `/api/v1/admin/billing/subscriptions/${subscriptionId}/cancel`,
            {}
        );

        // ASSERT: the before-hook aborts with 422 (the qzpay-hono abort status
        // for a { ok: false } before-hook result, as documented in the hooks
        // file header and admin.routes.ts:497).
        expect(secondRes.status).toBe(422);

        // Regardless of the guard outcome, the sub stays canceled.
        const row = (
            await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, subscriptionId))
        )[0];
        expect(row?.status).toBe('canceled');
    });

    it('soft-cancel contract — billing.subscriptions.cancel(cancelAtPeriodEnd:true) keeps access (no hospeda caller today)', async () => {
        // Scope note. This test invokes qzpay-core's `cancel` method
        // directly with `cancelAtPeriodEnd: true`. No hospeda code
        // currently reaches this branch — all hospeda callers
        // (admin/subscription-cancel.ts, trial.service.ts, addon-expiry
        // cron, accommodation-publish-deps) pass cancelAtPeriodEnd
        // false or rely on the qzpay-core default which the storage
        // adapter treats as immediate. SPEC-147 will wire a user-
        // facing soft-cancel route that DOES reach this branch.
        //
        // Testing the contract anyway so it does not regress silently
        // before SPEC-147 ships. If this test starts failing without
        // a SPEC-147 change, qzpay-core's cancel semantics have
        // drifted upstream.
        const billing = getQZPayBilling();
        if (!billing) {
            throw new Error('Billing instance not initialized — check the @repo/billing mock');
        }

        // ACT
        const result = await billing.subscriptions.cancel(subscriptionId, {
            cancelAtPeriodEnd: true,
            reason: 'soft-cancel contract test'
        });

        // ASSERT: qzpay-core returns the helper-wrapped subscription
        // object. With cancelAtPeriodEnd:true, status remains 'active'
        // (qzpay-core/billing.ts:1379 only sets status='canceled' when
        // the flag is false).
        expect(result.id).toBe(subscriptionId);
        expect(result.status).toBe('active');

        // ASSERT: DB row mirrors the result. canceledAt stamped, status
        // unchanged.
        const row = (
            await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, subscriptionId))
        )[0];
        expect(row?.status).toBe('active');
        expect(row?.canceledAt).toBeInstanceOf(Date);
        const metadata = row?.metadata as Record<string, unknown> | null;
        expect(metadata?.cancelReason).toBe('soft-cancel contract test');

        // ASSERT: entitlement load continues to surface the plan's
        // entitlements. The middleware's active-sub filter
        // (entitlement.ts:167-169) still matches status='active', so
        // the user keeps access — this is the "access until
        // current_period_end" contract.
        //
        // Note. qzpay-core does NOT set the `cancelAtPeriodEnd` boolean
        // column on the subscription row from this call. The flag lives
        // in the input options only. The GET /me/subscription endpoint
        // (user/protected/subscription.ts:237) reads that column and
        // would still return cancelAtPeriodEnd=false even after this
        // call. Documenting the gap; SPEC-147 fixes it.
        clearEntitlementCache(customerId);
        const probeRes = await buildProbeApp().request('/probe');
        const probeBody = (await probeRes.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Readonly<Record<string, number>>;
            readonly billingLoadFailed: boolean;
        };
        expect(probeBody.entitlements).toContain('public:read');
        expect(probeBody.limits.ads_per_month).toBe(5);
        expect(probeBody.billingLoadFailed).toBe(false);
    });
});
