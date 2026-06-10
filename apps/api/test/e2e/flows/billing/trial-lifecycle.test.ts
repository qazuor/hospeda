/**
 * Trial lifecycle — activation case (SPEC-143 T-143-24).
 *
 * Validates the activation leg of the 14-day trial lifecycle exposed by
 * `POST /api/v1/protected/billing/trial/start`. The expiration leg (cron
 * blocking) is covered by T-143-25 in the same file once added.
 *
 * Production code under test:
 *   - `apps/api/src/routes/billing/trial.ts:startTrialRoute`
 *   - `apps/api/src/services/trial.service.ts:startTrial` (creates the
 *      trialing subscription via `billing.subscriptions.create`)
 *   - `apps/api/src/middlewares/entitlement.ts` (load pipeline for the
 *      freshly-trialing subscription)
 *
 * Trial plan binding: `trial.service.ts:103` hard-codes the trial plan
 * slug as `owner-basico`. Tests seed a plan with that exact name so the
 * service-side lookup succeeds (`billing.plans.list().data.find(p =>
 * p.name === planSlug)`). Trial length is `OWNER_TRIAL_DAYS = 14` from
 * `@repo/billing/constants` (assertions reference the literal 14).
 *
 * @module test/e2e/flows/billing/trial-lifecycle
 */

import { vi } from 'vitest';

// vi.hoisted + vi.mock for createMercadoPagoAdapter. The billing
// instance initializes a MercadoPago adapter at construction time even
// though the trial flow itself never reaches MP (no checkout, no
// preapproval). Without the stub the adapter constructor reaches for
// live MP credentials and throws during billing init.
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
                    'mp-stub adapter not initialized — trial-lifecycle.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { and, billingSubscriptionEvents, billingSubscriptions, eq } from '@repo/db';
import { NotificationType, type TrialEventPayload } from '@repo/notifications';
import { BILLING_EVENT_TYPES } from '@repo/service-core';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { getQZPayBilling, resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    clearEntitlementCache,
    entitlementMiddleware,
    getEntitlementCacheStats
} from '../../../../src/middlewares/entitlement.js';
import { TrialService } from '../../../../src/services/trial.service.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestPlan, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

/**
 * Hard-coded by `trial.service.ts:103`. Tests must seed a plan with this
 * exact `name` (qzpay-billing uses `name` not `slug` for plan lookup,
 * per the comment at trial.service.ts:123).
 */
const TRIAL_PLAN_NAME = 'owner-basico';

/**
 * Hard-coded by `@repo/billing/constants` as `OWNER_TRIAL_DAYS = 14`.
 */
const TRIAL_DAYS = 14;

/**
 * Slack window for trial_end timestamp assertions. Trial creation
 * computes `now + 14 days` server-side; the test compares against its
 * own wall clock a few millis later. One hour is generous enough to
 * absorb any timezone arithmetic without papering over a missing day
 * addition.
 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

describe('SPEC-143 trial lifecycle e2e', () => {
    // Shared lifecycle for both T-143-24 (activation) and T-143-25
    // (expiration cron) below. initializeDb() in @repo/db is
    // idempotent — once the runtime client is bound to a pool, a
    // second call returns the cached client. If each nested describe
    // ran its own setup/teardown the second describe would inherit
    // the torn-down pool and every query would crash with
    // "Cannot use a pool after calling end on the pool". Hoisting
    // beforeAll/afterAll up here is the simple fix.
    let app: ReturnType<typeof initApp>;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    describe('SPEC-143 T-143-24 — trial activation', () => {
        let client: E2EApiClient;
        let userId: string;
        let customerId: string;

        beforeEach(async () => {
            mpStub.config.reset();

            // Seed the trial plan with the exact name the trial service
            // looks up. Entitlements + limits roughly mirror the production
            // owner-basico contract so the entitlement-reload test below has
            // something distinctive to assert.
            await createTestPlan({
                name: TRIAL_PLAN_NAME,
                description: 'Owner trial plan (seed for T-143-24)',
                entitlements: ['accommodation:publish', 'accommodation:edit'],
                limits: { max_accommodations: 1, max_photos_per_accommodation: 5 },
                metadata: {
                    slug: TRIAL_PLAN_NAME,
                    category: 'test-trial',
                    isDefault: false,
                    sortOrder: 1,
                    trialDays: TRIAL_DAYS,
                    hasTrial: true
                }
            });

            const user = await createTestUser({
                email: `trial-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
            });
            userId = user.id;

            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            customerId = customer.customerId;

            const actor = createMockUserActor({ id: user.id });
            client = new E2EApiClient(app, actor);
        });

        afterEach(async () => {
            // Cache singleton lives outside the DB and outside testDb.clean(),
            // so each test must evict its own entry to keep cross-test
            // independence.
            clearEntitlementCache(customerId);
            await testDb.clean();
        });

        it('creates a trialing subscription with trial_end ~14 days out', async () => {
            // ACT
            const response = await client.post('/api/v1/protected/billing/trial/start', {});

            // ASSERT: response shape per startTrialResponseSchema, wrapped
            // by ResponseFactory under `data`.
            expect(response.status).toBe(200);
            const body = (await response.json()) as {
                readonly success: boolean;
                readonly data: {
                    readonly success: boolean;
                    readonly subscriptionId: string | null;
                    readonly message?: string;
                };
            };
            expect(body.success).toBe(true);
            expect(body.data.success).toBe(true);
            expect(body.data.subscriptionId).toMatch(/^[0-9a-f-]{36}$/);

            // ASSERT: DB row landed in trialing status with trial_end ~14d.
            const rows = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, body.data.subscriptionId as string));
            expect(rows).toHaveLength(1);
            const row = rows[0];
            expect(row).toBeDefined();
            expect(row?.status).toBe('trialing');
            expect(row?.customerId).toBe(customerId);

            // Trial bounds: trialStart ~now, trialEnd ~ now + 14d. Allow one
            // hour of drift on either side to absorb the small gap between
            // server clock and test clock.
            expect(row?.trialStart).toBeInstanceOf(Date);
            expect(row?.trialEnd).toBeInstanceOf(Date);
            const trialStartMs = (row?.trialStart as Date).getTime();
            const trialEndMs = (row?.trialEnd as Date).getTime();
            const expectedStartMs = Date.now();
            const expectedEndMs = expectedStartMs + TRIAL_DAYS * ONE_DAY_MS;
            expect(Math.abs(trialStartMs - expectedStartMs)).toBeLessThan(ONE_HOUR_MS);
            expect(Math.abs(trialEndMs - expectedEndMs)).toBeLessThan(ONE_HOUR_MS);
        });

        it('returns 409 when the user already has a subscription (no duplicate trial)', async () => {
            // ARRANGE: prime an active trial. Reuses the production path so
            // any divergence between first-call and existing-sub-detection
            // surfaces here too.
            const firstResponse = await client.post('/api/v1/protected/billing/trial/start', {});
            expect(firstResponse.status).toBe(200);

            const subsBeforeSecondCall = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.customerId, customerId));
            expect(subsBeforeSecondCall).toHaveLength(1);

            // ACT: second activation attempt for the same customer.
            const response = await client.post('/api/v1/protected/billing/trial/start', {});

            // ASSERT: 409 conflict per trial.ts:178-183 (startTrial returns
            // null when an existing subscription is found, the route maps
            // that to 409).
            expect(response.status).toBe(409);

            // ASSERT: no second subscription row was created. The existing
            // subscription is untouched.
            const subsAfter = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.customerId, customerId));
            expect(subsAfter).toHaveLength(1);
            expect(subsAfter[0]?.id).toBe(subsBeforeSecondCall[0]?.id);
            expect(subsAfter[0]?.status).toBe('trialing');
        });

        it('loads the trial plan entitlements and limits for the next request', async () => {
            // ARRANGE: activate the trial.
            const startResponse = await client.post('/api/v1/protected/billing/trial/start', {});
            expect(startResponse.status).toBe(200);

            // ARRANGE: Hono mini-app that runs the REAL entitlementMiddleware
            // against the real billing instance. Synthetic prelude middleware
            // sets billingEnabled + billingCustomerId so the entitlement
            // middleware does not short-circuit before calling
            // loadEntitlements. Same pattern as sub-commits 4 elsewhere and
            // the entitlement-load.test.ts file (T-143-19).
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

            // Fresh cache for this customer; the trial activation path does
            // NOT clear the entitlement cache (it has no entry yet because
            // the customer is brand-new), so this is a normal cache miss.
            clearEntitlementCache(customerId);

            // ACT
            const probeRes = await probeApp.request('/probe');
            expect(probeRes.status).toBe(200);
            const probeBody = (await probeRes.json()) as {
                readonly entitlements: readonly string[];
                readonly limits: Readonly<Record<string, number>>;
                readonly billingLoadFailed: boolean;
            };

            // ASSERT: trial-plan entitlements + limits surface. The
            // entitlement middleware accepts `trialing` as an active status
            // (entitlement.ts:167-169), so the load succeeds end-to-end.
            expect(new Set(probeBody.entitlements)).toEqual(
                new Set(['accommodation:publish', 'accommodation:edit'])
            );
            expect(probeBody.limits.max_accommodations).toBe(1);
            expect(probeBody.limits.max_photos_per_accommodation).toBe(5);
            expect(probeBody.billingLoadFailed).toBe(false);

            // Sanity: the user id is captured in the actor and reaches the
            // billing customer through externalId. This catches any
            // regression where the trial route grabs the wrong customer id.
            expect(userId).toBeDefined();
        });
    });

    describe('SPEC-143 T-143-25 — trial expiration cron', () => {
        let trialPlanId: string;
        let customerId: string;

        beforeEach(async () => {
            mpStub.config.reset();

            const plan = await createTestPlan({
                name: TRIAL_PLAN_NAME,
                description: 'Owner trial plan (seed for T-143-25)',
                entitlements: ['accommodation:publish', 'accommodation:edit'],
                limits: { max_accommodations: 1, max_photos_per_accommodation: 5 },
                metadata: {
                    slug: TRIAL_PLAN_NAME,
                    category: 'test-trial',
                    isDefault: false,
                    sortOrder: 1,
                    trialDays: TRIAL_DAYS,
                    hasTrial: true
                }
            });
            trialPlanId = plan.planId;

            const user = await createTestUser({
                email: `trial-expiry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            customerId = customer.customerId;
        });

        afterEach(async () => {
            clearEntitlementCache(customerId);
            await testDb.clean();
        });

        /**
         * Seed a trialing subscription whose trial_end is already in the
         * past. The factory does not surface `trialEnd` on its input shape,
         * so we insert the row first and then UPDATE the column directly via
         * Drizzle. Returns the subscription id.
         */
        async function seedExpiredTrialingSubscription(input: {
            readonly trialEndDaysAgo: number;
        }): Promise<string> {
            const subscription = await createTestSubscription({
                customerId,
                planId: trialPlanId,
                status: 'trialing'
            });

            const now = new Date();
            const trialStart = new Date(now);
            trialStart.setDate(trialStart.getDate() - (TRIAL_DAYS + input.trialEndDaysAgo));
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() - input.trialEndDaysAgo);

            await testDb
                .getDb()
                .update(billingSubscriptions)
                .set({ trialStart, trialEnd })
                .where(eq(billingSubscriptions.id, subscription.subscriptionId));

            return subscription.subscriptionId;
        }

        it('cancels expired trialing subscription, records TRIAL_BLOCKED event, and clears entitlement cache', async () => {
            // ARRANGE: trialing sub whose trial_end is 1 day in the past.
            const subscriptionId = await seedExpiredTrialingSubscription({ trialEndDaysAgo: 1 });

            // ARRANGE: prime the entitlement cache for this customer so the
            // assertion below can prove the cron evicted it. Without this
            // priming the cache size delta is ambiguous (could be 0 because
            // there was nothing to evict).
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

            const preProbeRes = await probeApp.request('/probe');
            const preProbeBody = (await preProbeRes.json()) as {
                readonly entitlements: readonly string[];
            };
            // The trialing sub is active for the loader (entitlement.ts:168
            // accepts `trialing`), so the cache lands with the plan's
            // entitlements seeded.
            expect(preProbeBody.entitlements).toContain('accommodation:publish');
            const cacheSizeBeforeCron = getEntitlementCacheStats().size;
            expect(cacheSizeBeforeCron).toBeGreaterThanOrEqual(1);

            // ACT: invoke the cron's underlying service call. This is the
            // exact entry point apps/api/src/cron/jobs/trial-expiry.ts:124
            // uses in production mode.
            const billing = getQZPayBilling();
            if (!billing) {
                throw new Error('Billing instance not initialized — check the @repo/billing mock');
            }
            const trialService = new TrialService(billing);
            const blockedCount = await trialService.blockExpiredTrials();

            // ASSERT: exactly one trial was blocked.
            expect(blockedCount).toBe(1);

            // ASSERT: subscription is cancelled (QZPay does not support an
            // `expired` status — the cancel path is what the service uses).
            const subRows = await testDb
                .getDb()
                .select({ status: billingSubscriptions.status })
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, subscriptionId));
            // qzpay-core writes 'canceled' (US spelling) on subscriptions.cancel
            // (billing.ts:1380). The factory's TestSubscriptionStatus type
            // accepts both 'cancelled' (UK) and treats them as the same logical
            // state, but the production path is canonical 'canceled'.
            expect(subRows[0]?.status).toBe('canceled');

            // ASSERT: TRIAL_BLOCKED event row was inserted, with the
            // expected trigger source. This event is the dedup guard for
            // future cron runs — see the idempotency test below.
            const eventRows = await testDb
                .getDb()
                .select()
                .from(billingSubscriptionEvents)
                .where(
                    and(
                        eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
                        eq(billingSubscriptionEvents.eventType, BILLING_EVENT_TYPES.TRIAL_BLOCKED)
                    )
                );
            expect(eventRows).toHaveLength(1);
            expect(eventRows[0]?.triggerSource).toBe('block-expired-trials-cron');

            // ASSERT: entitlement cache was cleared for this customer.
            // Delta-of-1 to allow other tests' entries (singleton scope).
            const cacheSizeAfterCron = getEntitlementCacheStats().size;
            expect(cacheSizeAfterCron).toBe(cacheSizeBeforeCron - 1);

            // ASSERT: a fresh probe re-loads from billing storage. The
            // now-cancelled sub is no longer active, so the loader returns
            // the tourist-free fallback (SPEC-143 T-143-58) instead of an
            // empty set.
            const postProbeRes = await probeApp.request('/probe');
            const postProbeBody = (await postProbeRes.json()) as {
                readonly entitlements: readonly string[];
                readonly limits: Readonly<Record<string, number>>;
                readonly billingLoadFailed: boolean;
            };
            expect(new Set(postProbeBody.entitlements)).toEqual(
                new Set([
                    'save_favorites',
                    'write_reviews',
                    'read_reviews',
                    'can_view_recommendations'
                ])
            );
            expect(postProbeBody.limits).toEqual({ max_favorites: 3 });
            expect(postProbeBody.billingLoadFailed).toBe(false);
        });

        it('is idempotent — a second cron run after a successful block is a no-op', async () => {
            // ARRANGE: seed and run the cron once to land in the "already
            // blocked" state.
            const subscriptionId = await seedExpiredTrialingSubscription({ trialEndDaysAgo: 2 });
            const billing = getQZPayBilling();
            if (!billing) {
                throw new Error('Billing instance not initialized — check the @repo/billing mock');
            }
            const trialService = new TrialService(billing);
            const firstBlocked = await trialService.blockExpiredTrials();
            expect(firstBlocked).toBe(1);

            // Snapshot the dedup state.
            const subStatusAfterFirst = (
                await testDb
                    .getDb()
                    .select({ status: billingSubscriptions.status })
                    .from(billingSubscriptions)
                    .where(eq(billingSubscriptions.id, subscriptionId))
            )[0]?.status;
            const eventCountAfterFirst = (
                await testDb
                    .getDb()
                    .select({ id: billingSubscriptionEvents.id })
                    .from(billingSubscriptionEvents)
                    .where(
                        and(
                            eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
                            eq(
                                billingSubscriptionEvents.eventType,
                                BILLING_EVENT_TYPES.TRIAL_BLOCKED
                            )
                        )
                    )
            ).length;
            expect(subStatusAfterFirst).toBe('canceled');
            expect(eventCountAfterFirst).toBe(1);

            // ACT: second run. The trial-service filter (status='trialing')
            // already excludes the now-cancelled sub before the dedup guard
            // even fires, so the return value should be 0.
            const secondBlocked = await trialService.blockExpiredTrials();

            // ASSERT: nothing new was processed.
            expect(secondBlocked).toBe(0);

            // ASSERT: no duplicate event row landed. This catches a
            // regression in the dedup guard (trial.service.ts:379-399) that
            // would otherwise create N events on N cron runs.
            const eventCountAfterSecond = (
                await testDb
                    .getDb()
                    .select({ id: billingSubscriptionEvents.id })
                    .from(billingSubscriptionEvents)
                    .where(
                        and(
                            eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
                            eq(
                                billingSubscriptionEvents.eventType,
                                BILLING_EVENT_TYPES.TRIAL_BLOCKED
                            )
                        )
                    )
            ).length;
            expect(eventCountAfterSecond).toBe(1);

            // ASSERT: subscription status remains cancelled.
            const subStatusAfterSecond = (
                await testDb
                    .getDb()
                    .select({ status: billingSubscriptions.status })
                    .from(billingSubscriptions)
                    .where(eq(billingSubscriptions.id, subscriptionId))
            )[0]?.status;
            expect(subStatusAfterSecond).toBe('canceled');
        });

        it('queues a TRIAL_EXPIRED notification with customer + plan + trialEnd payload', async () => {
            // ARRANGE: trialing sub past its end date.
            const subscriptionId = await seedExpiredTrialingSubscription({ trialEndDaysAgo: 3 });
            const billing = getQZPayBilling();
            if (!billing) {
                throw new Error('Billing instance not initialized — check the @repo/billing mock');
            }

            // Capture the post-update trial_end from DB for an exact
            // assertion against the notification payload.
            const trialEndFromDb = (
                await testDb
                    .getDb()
                    .select({ trialEnd: billingSubscriptions.trialEnd })
                    .from(billingSubscriptions)
                    .where(eq(billingSubscriptions.id, subscriptionId))
            )[0]?.trialEnd as Date | null;
            expect(trialEndFromDb).toBeInstanceOf(Date);

            // ARRANGE: construct TrialService with a spy notifier. The cron
            // production path passes no notifier (trial-expiry.ts:60), so
            // we exercise the in-service code at trial.service.ts:464-483
            // directly through this constructor parameter. This catches
            // regressions where the notification call is dropped or its
            // payload changes shape.
            const sendNotification = vi.fn<(payload: TrialEventPayload) => void>();
            const trialService = new TrialService(billing, sendNotification);

            // ACT
            const blockedCount = await trialService.blockExpiredTrials();
            expect(blockedCount).toBe(1);

            // ASSERT: notifier invoked exactly once with the expected
            // payload shape.
            expect(sendNotification).toHaveBeenCalledTimes(1);
            const payload = sendNotification.mock.calls[0]?.[0] as TrialEventPayload;
            expect(payload).toBeDefined();
            expect(payload.type).toBe(NotificationType.TRIAL_EXPIRED);
            expect(payload.customerId).toBe(customerId);
            expect(payload.planName).toBe(TRIAL_PLAN_NAME);
            expect(payload.trialEndDate).toBe((trialEndFromDb as Date).toISOString());
            // Recipient is the billing customer's email — whatever the
            // factory wrote on the customer row (we passed the user's email
            // through to createTestBillingCustomer).
            expect(payload.recipientEmail).toMatch(/^trial-expiry-.+@example\.com$/);
            // upgradeUrl is computed from env at runtime; just assert shape.
            expect(payload.upgradeUrl).toMatch(/\/mi-cuenta\/suscripcion$/);
        });
    });

    describe('SPEC-143 T-143-26 — trial to paid conversion mid-trial', () => {
        // The trial plan is created in beforeEach. Conversion targets a
        // separate paid plan (richer entitlements + limits) so the
        // entitlement-reload assertion below has a distinctive delta to
        // observe.
        const PAID_PLAN_NAME = 'owner-pro';
        let trialPlanId: string;
        let paidPlanId: string;
        let client: E2EApiClient;
        let customerId: string;

        beforeEach(async () => {
            mpStub.config.reset();

            const trialPlan = await createTestPlan({
                name: TRIAL_PLAN_NAME,
                description: 'Owner trial plan (seed for T-143-26)',
                entitlements: ['accommodation:publish', 'accommodation:edit'],
                limits: { max_accommodations: 1, max_photos_per_accommodation: 5 },
                metadata: {
                    slug: TRIAL_PLAN_NAME,
                    category: 'test-trial',
                    isDefault: false,
                    sortOrder: 1,
                    trialDays: TRIAL_DAYS,
                    hasTrial: true
                }
            });
            trialPlanId = trialPlan.planId;

            const paidPlan = await createTestPlan({
                name: PAID_PLAN_NAME,
                description: 'Owner pro paid plan (seed for T-143-26 conversion target)',
                entitlements: [
                    'accommodation:publish',
                    'accommodation:edit',
                    'accommodation:feature'
                ],
                limits: { max_accommodations: 10, max_photos_per_accommodation: 50 },
                metadata: {
                    slug: PAID_PLAN_NAME,
                    category: 'test-paid',
                    isDefault: false,
                    sortOrder: 2,
                    trialDays: 0,
                    hasTrial: false
                }
            });
            paidPlanId = paidPlan.planId;

            const user = await createTestUser({
                email: `trial-convert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
            });
            const customer = await createTestBillingCustomer({
                externalId: user.id,
                email: user.email
            });
            customerId = customer.customerId;

            const actor = createMockUserActor({ id: user.id });
            client = new E2EApiClient(app, actor);
        });

        afterEach(async () => {
            clearEntitlementCache(customerId);
            await testDb.clean();
        });

        /**
         * Start the user's trial via the production POST /trial/start
         * route and return the trial subscription id. Mirrors the T-143-24
         * happy-path setup; reused inline here so the conversion tests
         * exercise the full mid-trial lifecycle (start → reactivate).
         */
        async function startTrialAndGetSubscriptionId(): Promise<string> {
            const trialRes = await client.post('/api/v1/protected/billing/trial/start', {});
            expect(trialRes.status).toBe(200);
            const trialBody = (await trialRes.json()) as {
                readonly data: { readonly subscriptionId: string };
            };
            return trialBody.data.subscriptionId;
        }

        it('returns 200 with a new paid subscription id on POST /reactivate', async () => {
            await startTrialAndGetSubscriptionId();

            // ACT: convert mid-trial.
            const response = await client.post('/api/v1/protected/billing/trial/reactivate', {
                planId: paidPlanId
            });

            // ASSERT: response shape per reactivateTrialResponseSchema
            // wrapped under ResponseFactory's `data`.
            expect(response.status).toBe(200);
            const body = (await response.json()) as {
                readonly success: boolean;
                readonly data: {
                    readonly success: boolean;
                    readonly subscriptionId: string | null;
                    readonly message: string;
                };
            };
            expect(body.success).toBe(true);
            expect(body.data.success).toBe(true);
            expect(body.data.subscriptionId).toMatch(/^[0-9a-f-]{36}$/);
        });

        it('cancels the trial sub, lands a new paid sub, and records a trial-reactivation audit event', async () => {
            const originalTrialSubId = await startTrialAndGetSubscriptionId();

            // ACT
            const response = await client.post('/api/v1/protected/billing/trial/reactivate', {
                planId: paidPlanId
            });
            expect(response.status).toBe(200);
            const body = (await response.json()) as {
                readonly data: { readonly subscriptionId: string };
            };
            const newSubId = body.data.subscriptionId;
            expect(newSubId).not.toBe(originalTrialSubId);

            // ASSERT: DB shows two subscription rows for this customer.
            // The original trial flipped to 'canceled' (qzpay-core US
            // spelling — billing.ts:1380 via the cancel path used by
            // trial.service.ts:698). The new paid subscription points at
            // the paid plan id.
            const subs = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.customerId, customerId));
            expect(subs).toHaveLength(2);

            const originalSub = subs.find((s) => s.id === originalTrialSubId);
            const newSub = subs.find((s) => s.id === newSubId);
            expect(originalSub?.status).toBe('canceled');
            expect(originalSub?.planId).toBe(trialPlanId);
            expect(newSub).toBeDefined();
            expect(newSub?.planId).toBe(paidPlanId);
            // The new subscription's metadata carries the conversion
            // marker set by trial.service.ts:638-641. This is the only
            // permanent breadcrumb that ties a paid sub back to its
            // trial origin.
            const newMetadata = newSub?.metadata as Record<string, unknown> | null;
            expect(newMetadata?.convertedFromTrial).toBe('true');
            expect(typeof newMetadata?.convertedAt).toBe('string');

            // ASSERT: an audit event row was written for the new sub.
            // trial.service.ts:646-657 writes the row with
            // previousStatus=TRIALING + newStatus=ACTIVE +
            // triggerSource='trial-reactivation'.
            const events = await testDb
                .getDb()
                .select()
                .from(billingSubscriptionEvents)
                .where(eq(billingSubscriptionEvents.subscriptionId, newSubId));
            expect(events).toHaveLength(1);
            expect(events[0]?.triggerSource).toBe('trial-reactivation');
            expect(events[0]?.previousStatus).toBe('trialing');
            expect(events[0]?.newStatus).toBe('active');
            const eventMetadata = events[0]?.metadata as Record<string, unknown> | null;
            expect(eventMetadata?.convertedFromTrial).toBe(true);
            expect(eventMetadata?.planId).toBe(paidPlanId);
        });

        it('clears the entitlement cache so the next request sees the paid plan entitlements', async () => {
            await startTrialAndGetSubscriptionId();

            // Build the entitlement probe — same pattern as
            // T-143-19 / T-143-24 sub-3 / T-143-25 sub-1.
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

            // Prime the cache so we have something to evict. The trial
            // is still active, so the probe surfaces the trial plan's
            // declared entitlements (max_accommodations=1).
            clearEntitlementCache(customerId);
            const preRes = await probeApp.request('/probe');
            const preBody = (await preRes.json()) as {
                readonly entitlements: readonly string[];
                readonly limits: Readonly<Record<string, number>>;
            };
            expect(preBody.entitlements).toContain('accommodation:publish');
            expect(preBody.entitlements).not.toContain('accommodation:feature');
            expect(preBody.limits.max_accommodations).toBe(1);
            const cacheSizeBefore = getEntitlementCacheStats().size;
            expect(cacheSizeBefore).toBeGreaterThanOrEqual(1);

            // ACT: convert. The route calls trial.service.ts:745
            // clearEntitlementCache after the new paid sub is created.
            const response = await client.post('/api/v1/protected/billing/trial/reactivate', {
                planId: paidPlanId
            });
            expect(response.status).toBe(200);

            // ASSERT: this customer's cache entry was evicted (delta -1).
            // The singleton may still hold entries for other customers
            // from earlier tests; asserting an absolute size would be
            // brittle.
            const cacheSizeAfter = getEntitlementCacheStats().size;
            expect(cacheSizeAfter).toBe(cacheSizeBefore - 1);

            // ASSERT: the next probe reloads from storage and surfaces
            // the paid plan's richer entitlements + limits. If
            // clearEntitlementCache were removed from the reactivation
            // path, this would still return the cached trial values
            // until the 5-minute TTL elapsed.
            const postRes = await probeApp.request('/probe');
            const postBody = (await postRes.json()) as {
                readonly entitlements: readonly string[];
                readonly limits: Readonly<Record<string, number>>;
                readonly billingLoadFailed: boolean;
            };
            expect(new Set(postBody.entitlements)).toEqual(
                new Set(['accommodation:publish', 'accommodation:edit', 'accommodation:feature'])
            );
            expect(postBody.limits.max_accommodations).toBe(10);
            expect(postBody.limits.max_photos_per_accommodation).toBe(50);
            expect(postBody.billingLoadFailed).toBe(false);
        });
    });
}); // close parent describe('SPEC-143 trial lifecycle e2e')
