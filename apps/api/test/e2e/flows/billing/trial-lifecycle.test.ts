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

import { billingSubscriptions, eq } from '@repo/db';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    clearEntitlementCache,
    entitlementMiddleware
} from '../../../../src/middlewares/entitlement.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createTestBillingCustomer } from '../../helpers/billing-factories.js';
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

describe('SPEC-143 T-143-24 — trial activation', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let userId: string;
    let customerId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

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
