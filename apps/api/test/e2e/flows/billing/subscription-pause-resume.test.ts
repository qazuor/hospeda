/**
 * Subscription pause / resume (SPEC-143 T-143-28 + T-143-29).
 *
 * Pins the qzpay-core pause and resume contracts end-to-end against a
 * real Postgres and the real qzpay-billing instance. T-143-28 covers
 * the pause case; T-143-29 covers the resume case.
 *
 * Discovery context. The spec note for T-143-28 described:
 *
 *   "Active → pause → entitlements revoked + MP preapproval paused +
 *    paused_at set."
 *
 * Of the three claims, only the first is implemented today:
 *
 *   1. ✓ Entitlements revoked. qzpay-core's pause flips the
 *      subscription row to status='paused'. The entitlement
 *      middleware's active-sub filter (entitlement.ts:167-169) only
 *      accepts 'active' or 'trialing', so a paused sub stops loading
 *      its plan entitlements on the next request.
 *   2. ✗ MP preapproval paused. qzpay-core's pause does NOT call the
 *      payment adapter (qzpay-core/billing.ts:1389-1393); it only
 *      flips the local status. MercadoPago keeps charging the
 *      preapproval until the next charge fails and the failed-payment
 *      webhook handler downgrades the sub.
 *   3. ✗ paused_at set. The qzpay-drizzle subscriptions schema does
 *      NOT have a `pausedAt` column. There is nowhere to set the
 *      timestamp.
 *
 * On top of that, hospeda has no production caller of
 * `billing.subscriptions.pause` (grep across `apps/api/src/`,
 * `packages/billing/src/`, `packages/service-core/src/` returns no
 * hits). The qzpay-hono `/subscriptions/:id/pause` endpoint exists
 * but is blocked by `billingAdminGuardMiddleware` for non-admin
 * actors (same rule that blocks cancel — pause is not in
 * `allowedSubPaths`).
 *
 * SCOPE NOTE: This file therefore tests the qzpay-core pause contract
 * directly via `billing.subscriptions.pause(id)`, the entry point the
 * SPEC-147 follow-up will eventually wire to a user-facing route. The
 * tests pin what exists; the gaps are tracked under SPEC-147 (or a
 * sibling pause/resume spec when product prioritises that flow).
 *
 * @module test/e2e/flows/billing/subscription-pause-resume
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
                    'mp-stub adapter not initialized — subscription-pause-resume.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { billingSubscriptionEvents, billingSubscriptions, eq, users } from '@repo/db';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { getQZPayBilling, resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    clearEntitlementCache,
    entitlementMiddleware
} from '../../../../src/middlewares/entitlement.js';
import {
    handleSelfServePause,
    handleSelfServeResume
} from '../../../../src/routes/billing/subscription-pause.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('SPEC-143 trial pause/resume e2e', () => {
    // Shared lifecycle — same parent-describe pattern documented in
    // trial-lifecycle.test.ts (initializeDb is idempotent, so multiple
    // setup/teardown calls in nested describes inherit a torn-down
    // pool). Variables shared across nested describes live here.
    let customerId: string;
    let cheapPlanId: string;
    let subscriptionId: string;
    let ownerUserId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        const seed = await seedBillingTestPlans();
        cheapPlanId = seed.cheap.planId;

        const user = await createTestUser({
            email: `subscription-pause-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
        });
        ownerUserId = user.id;
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
    });

    afterEach(async () => {
        clearEntitlementCache(customerId);
        await testDb.clean();
    });

    /**
     * Build a probe app that runs the REAL entitlement middleware for
     * the seeded customer. Returns the JSON entitlement view.
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

    /**
     * Seed a paused subscription by creating an active one and then
     * invoking the real qzpay-core pause path. Returns the
     * subscription id. Used by the T-143-29 resume tests below; the
     * pause tests above exercise the pause leg directly.
     */
    async function seedPausedSubscription(): Promise<string> {
        const billing = getQZPayBilling();
        if (!billing) {
            throw new Error('Billing instance not initialized — check the @repo/billing mock');
        }
        await billing.subscriptions.pause(subscriptionId);
        return subscriptionId;
    }

    describe('SPEC-143 T-143-28 — subscription pause', () => {
        it('flips status from active to paused and returns the helper-wrapped subscription', async () => {
            // Pre-cancel sanity: the sub is active and the entitlement
            // middleware loads the plan's declared entitlements.
            const billing = getQZPayBilling();
            if (!billing) {
                throw new Error('Billing instance not initialized — check the @repo/billing mock');
            }

            clearEntitlementCache(customerId);
            const preBody = (await (await buildProbeApp().request('/probe')).json()) as {
                readonly entitlements: readonly string[];
            };
            expect(preBody.entitlements).toContain('public:read');

            // ACT
            const result = await billing.subscriptions.pause(subscriptionId);

            // ASSERT: qzpay-core returns the helper-wrapped subscription
            // with status='paused' (qzpay-core/billing.ts:1390 sets
            // status to 'paused' via storage.subscriptions.update).
            expect(result.id).toBe(subscriptionId);
            expect(result.status).toBe('paused');

            // ASSERT: DB row matches the helper view. The qzpay-core
            // pause implementation does NOT set a pausedAt timestamp —
            // the qzpay-drizzle schema has no such column. Only the
            // status flip is persisted.
            const row = (
                await testDb
                    .getDb()
                    .select()
                    .from(billingSubscriptions)
                    .where(eq(billingSubscriptions.id, subscriptionId))
            )[0];
            expect(row?.status).toBe('paused');
            // No pausedAt column exists. Document by checking the live
            // subscription does NOT carry the field — guards against a
            // future schema add that goes unrelated to product wiring.
            expect((row as Record<string, unknown>)?.pausedAt).toBeUndefined();
        });

        it('paused subscription is excluded from entitlement loading on the next request', async () => {
            // ARRANGE: prime the entitlement cache so we can prove the
            // post-pause re-load returns an empty set. Without priming,
            // the assertion is ambiguous (cache size could be 0
            // because there was nothing to evict).
            const billing = getQZPayBilling();
            if (!billing) {
                throw new Error('Billing instance not initialized — check the @repo/billing mock');
            }

            clearEntitlementCache(customerId);
            const preBody = (await (await buildProbeApp().request('/probe')).json()) as {
                readonly entitlements: readonly string[];
                readonly limits: Readonly<Record<string, number>>;
            };
            expect(preBody.entitlements).toContain('public:read');
            expect(preBody.limits.ads_per_month).toBe(5);

            // ACT
            await billing.subscriptions.pause(subscriptionId);

            // Force a fresh load (qzpay-core's pause does NOT clear the
            // entitlement cache — the in-memory cache is owned by
            // hospeda, not qzpay. SPEC-147 should wire a cache clear
            // into any user-facing pause route; today we evict
            // manually to prove the post-pause state).
            clearEntitlementCache(customerId);

            // ASSERT: the next probe drops the active-sub entitlements
            // (paused sub fails the middleware's active-sub filter at
            // entitlement.ts:167-169) and falls back to the tourist-free
            // baseline per SPEC-143 T-143-58.
            const postBody = (await (await buildProbeApp().request('/probe')).json()) as {
                readonly entitlements: readonly string[];
                readonly limits: Readonly<Record<string, number>>;
                readonly billingLoadFailed: boolean;
            };
            expect(new Set(postBody.entitlements)).toEqual(
                new Set([
                    'save_favorites',
                    'write_reviews',
                    'read_reviews',
                    'can_view_recommendations'
                ])
            );
            expect(postBody.limits).toEqual({ max_favorites: 3 });
            expect(postBody.billingLoadFailed).toBe(false);
        });
    });

    describe('SPEC-143 T-143-29 — subscription resume', () => {
        it('flips status from paused to active and returns the helper-wrapped subscription', async () => {
            const pausedId = await seedPausedSubscription();
            const billing = getQZPayBilling();
            if (!billing) {
                throw new Error('Billing instance not initialized — check the @repo/billing mock');
            }

            // Sanity pre-resume: DB shows status='paused' from the
            // seeded pause leg.
            const preRow = (
                await testDb
                    .getDb()
                    .select({ status: billingSubscriptions.status })
                    .from(billingSubscriptions)
                    .where(eq(billingSubscriptions.id, pausedId))
            )[0];
            expect(preRow?.status).toBe('paused');

            // ACT
            const result = await billing.subscriptions.resume(pausedId);

            // ASSERT: qzpay-core returns the helper-wrapped subscription
            // with status='active' (qzpay-core/billing.ts:1395 sets
            // status to 'active' via storage.subscriptions.update). No
            // payment adapter call, no schedule reset — see the
            // module-level scope note for the gaps.
            expect(result.id).toBe(pausedId);
            expect(result.status).toBe('active');

            // ASSERT: DB row mirrors the helper view. qzpay-core's
            // resume does NOT clear the `canceledAt` column if it was
            // previously stamped by a soft cancel — pause-then-resume
            // is a distinct flow from cancel-then-uncancel. (No test
            // for that interaction here; cancel-then-resume is out of
            // scope and would need a SPEC-147 design call.)
            const postRow = (
                await testDb
                    .getDb()
                    .select()
                    .from(billingSubscriptions)
                    .where(eq(billingSubscriptions.id, pausedId))
            )[0];
            expect(postRow?.status).toBe('active');
        });

        it('resumed subscription is loaded by the entitlement middleware on the next request', async () => {
            const pausedId = await seedPausedSubscription();
            const billing = getQZPayBilling();
            if (!billing) {
                throw new Error('Billing instance not initialized — check the @repo/billing mock');
            }

            // Sanity pre-resume: paused sub yields the tourist-free
            // fallback (SPEC-143 T-143-58) — the no-active-sub branch of
            // the loader. Asserting against `save_favorites` (a free-tier
            // entitlement) instead of `expensive:feature` (the paid plan's
            // entitlement) is the unambiguous anchor for the post-resume
            // assertion below.
            clearEntitlementCache(customerId);
            const preBody = (await (await buildProbeApp().request('/probe')).json()) as {
                readonly entitlements: readonly string[];
            };
            expect(preBody.entitlements).toContain('save_favorites');
            expect(preBody.entitlements).not.toContain('expensive:feature');

            // ACT
            await billing.subscriptions.resume(pausedId);

            // qzpay-core's resume does NOT clear the entitlement
            // cache (same gap as pause). Evict manually so the next
            // probe re-loads from storage and observes the now-active
            // sub. SPEC-147 should wire a cache clear into the
            // user-facing resume route alongside the MP preapproval
            // reactivation.
            clearEntitlementCache(customerId);

            // ASSERT: probe surfaces the plan's entitlements + limits.
            // The middleware's active-sub filter
            // (entitlement.ts:167-169) now matches status='active',
            // so the loader takes the happy path and returns the
            // cheap plan's declared entitlements.
            const postBody = (await (await buildProbeApp().request('/probe')).json()) as {
                readonly entitlements: readonly string[];
                readonly limits: Readonly<Record<string, number>>;
                readonly billingLoadFailed: boolean;
            };
            expect(postBody.entitlements).toContain('public:read');
            expect(postBody.limits.ads_per_month).toBe(5);
            expect(postBody.billingLoadFailed).toBe(false);
        });
    });
    describe('SPEC-143 #29 — self-serve route handlers', () => {
        /**
         * Minimal Hono context stub carrying the three values the self-serve
         * handlers read: billingEnabled, billingCustomerId, and the actor
         * (getActorFromContext reads `c.get('actor')`). No HTTP layer needed —
         * the handlers are plain async functions.
         */
        function makeSelfServeCtx() {
            const store: Record<string, unknown> = {
                billingEnabled: true,
                billingCustomerId: customerId,
                actor: { id: ownerUserId }
            };
            return {
                get: (key: string) => store[key],
                req: { json: async () => ({}) }
            } as unknown as Parameters<typeof handleSelfServePause>[0];
        }

        it('self-serve pause flips status to paused, suspends the owner, and audits host-pause', async () => {
            const result = await handleSelfServePause(makeSelfServeCtx());

            expect(result).toMatchObject({
                success: true,
                subscriptionId,
                status: 'paused'
            });

            const subRow = (
                await testDb
                    .getDb()
                    .select({ status: billingSubscriptions.status })
                    .from(billingSubscriptions)
                    .where(eq(billingSubscriptions.id, subscriptionId))
            )[0];
            expect(subRow?.status).toBe('paused');

            const userRow = (
                await testDb
                    .getDb()
                    .select({ serviceSuspended: users.serviceSuspended })
                    .from(users)
                    .where(eq(users.id, ownerUserId))
            )[0];
            expect(userRow?.serviceSuspended).toBe(true);

            const events = await testDb
                .getDb()
                .select({ triggerSource: billingSubscriptionEvents.triggerSource })
                .from(billingSubscriptionEvents)
                .where(eq(billingSubscriptionEvents.subscriptionId, subscriptionId));
            expect(events.some((e) => e.triggerSource === 'host-pause')).toBe(true);
        });

        it('self-serve resume flips status to active and clears the owner suspension', async () => {
            await handleSelfServePause(makeSelfServeCtx());

            const result = await handleSelfServeResume(makeSelfServeCtx());

            expect(result).toMatchObject({
                success: true,
                subscriptionId,
                status: 'active'
            });

            const subRow = (
                await testDb
                    .getDb()
                    .select({ status: billingSubscriptions.status })
                    .from(billingSubscriptions)
                    .where(eq(billingSubscriptions.id, subscriptionId))
            )[0];
            expect(subRow?.status).toBe('active');

            const userRow = (
                await testDb
                    .getDb()
                    .select({ serviceSuspended: users.serviceSuspended })
                    .from(users)
                    .where(eq(users.id, ownerUserId))
            )[0];
            expect(userRow?.serviceSuspended).toBe(false);

            const events = await testDb
                .getDb()
                .select({ triggerSource: billingSubscriptionEvents.triggerSource })
                .from(billingSubscriptionEvents)
                .where(eq(billingSubscriptionEvents.subscriptionId, subscriptionId));
            expect(events.some((e) => e.triggerSource === 'host-resume')).toBe(true);
        });
    });
}); // close parent describe('SPEC-143 trial pause/resume e2e')
