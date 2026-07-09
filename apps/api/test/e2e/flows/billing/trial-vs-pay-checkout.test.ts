/**
 * HOS-110 — trial-vs-pay branch of the paid monthly checkout.
 *
 * `initiatePaidMonthlySubscription` (subscription-checkout.service.ts) now
 * checks, BEFORE any promo/MP work, whether the resolved plan declares a
 * trial (`hasTrial`/`trialDays` in `billing_plans.metadata`) and the customer
 * has never had a subscription before. When both hold, the customer is
 * granted the no-card trial directly (`trialing`, NO MercadoPago preapproval)
 * instead of being redirected to MercadoPago — unifying the trial across
 * every entry surface that hits `POST /start-paid` (the public pricing page,
 * the testing daily-plan button), not just the accommodation-publish flow.
 *
 * Two scenarios:
 *  - Eligible customer (no prior subscription) + trial-declaring plan →
 *    `appliedEffect: 'trial'`, local sub status `trialing`, in-app success
 *    sentinel `checkoutUrl` (NOT an MP URL), zero calls to the MP adapter.
 *  - Ineligible customer (already has a — even cancelled — prior
 *    subscription) + the SAME trial-declaring plan → falls through to the
 *    unchanged paid MercadoPago path (preapproval created, MP checkoutUrl).
 *
 * Mirrors the mp-stub / testDb / seedBillingTestPlans harness established by
 * `monthly-checkout.test.ts` and `subscription-activation.test.ts`.
 *
 * @module test/e2e/flows/billing/trial-vs-pay-checkout
 */

import { vi } from 'vitest';

// vi.hoisted runs BEFORE every import. The ref object is shared between the
// vi.mock factory (which captures it at hoist time) and the top-level code
// below (which fills `current` once the stub is constructed).
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
                    'mp-stub adapter not initialized — trial-vs-pay-checkout.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { billingSubscriptions, eq } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestPromoCode,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { providerResponseFixtures } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('HOS-110 — trial-vs-pay branch (POST /start-paid, monthly)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(() => {
        mpStub.config.reset();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    it('grants a no-card trial for a trial-eligible customer on a trial-declaring plan', async () => {
        // ARRANGE — seedBillingTestPlans' `expensive` plan (owner-pro) declares
        // a 14-day trial (metadata.hasTrial:true, metadata.trialDays:14). No
        // MP stub response is configured for subscriptions.create: if the
        // trial branch ever fell through to the paid MP path, the stub would
        // throw "unconfigured operation" and fail this test loudly.
        const seed = await seedBillingTestPlans();

        const user = await createTestUser({
            email: `trial-eligible-${Date.now()}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });

        const actor = createMockUserActor({ id: user.id });
        const client = new E2EApiClient(app, actor);

        // ACT
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: seed.expensive.name,
            billingInterval: 'monthly'
        });

        // ASSERT — response contract: appliedEffect:'trial', in-app success
        // sentinel URL (NOT an MP hosted-page URL).
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: {
                readonly checkoutUrl: string;
                readonly localSubscriptionId: string;
                readonly expiresAt: string;
                readonly appliedEffect?: string;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.appliedEffect).toBe('trial');
        expect(body.data.checkoutUrl).toContain('/suscriptores/checkout/success/');
        expect(body.data.checkoutUrl).not.toMatch(/mercadopago|mp\.test|stub\.example/i);
        expect(body.data.localSubscriptionId).toMatch(/^[0-9a-f-]{36}$/);

        // ASSERT — local subscription row is `trialing`, tied to the resolved
        // plan and customer, with NO providerSubscriptionId (no MP preapproval
        // was ever created for a trial-only create).
        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toBeDefined();
        expect(row?.status).toBe('trialing');
        expect(row?.customerId).toBe(customer.customerId);
        expect(row?.planId).toBe(seed.expensive.planId);
        expect(row?.mpSubscriptionId ?? null).toBeNull();

        // ASSERT — the MP payment adapter was NEVER invoked. A trial-only
        // `billing.subscriptions.create` call (no `mode: 'paid'`) never
        // reaches the payment adapter at the qzpay-core level.
        expect(mpStub.config.getCalls('subscriptions.create')).toHaveLength(0);
    });

    it('falls through to the unchanged paid MercadoPago path for an ineligible (already-subscribed) customer', async () => {
        // ARRANGE — same trial-declaring plan, but this customer already has a
        // prior subscription (even a CANCELLED one disqualifies a trial per
        // HOS-110 decision #1: "one trial per customer, for life"). Status
        // 'cancelled' is deliberately used (not 'active'/'trialing'/'comp')
        // so the route-level ALREADY_SUBSCRIBED / SUBSCRIPTION_CANCEL_PENDING
        // guards in start-paid.ts do NOT reject the request before it even
        // reaches initiatePaidMonthlySubscription — this test must exercise
        // the SERVICE-level trial-eligibility fallthrough, not an earlier
        // route-level short-circuit.
        const seed = await seedBillingTestPlans();

        const user = await createTestUser({
            email: `trial-ineligible-${Date.now()}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });
        await createTestSubscription({
            customerId: customer.customerId,
            planId: seed.cheap.planId,
            status: 'cancelled'
        });

        const expectedCheckoutUrl = 'https://stub.example/preapproval/sub_trial_ineligible';
        mpStub.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({
                id: 'sub_trial_ineligible',
                status: 'pending',
                initPoint: expectedCheckoutUrl
            })
        );

        const actor = createMockUserActor({ id: user.id });
        const client = new E2EApiClient(app, actor);

        // ACT — checkout against the SAME trial-declaring plan as the eligible test.
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: seed.expensive.name,
            billingInterval: 'monthly'
        });

        // ASSERT — normal paid MP path: no appliedEffect:'trial', MP checkoutUrl,
        // status 'incomplete' (qzpay-core's mode:'paid' create state, not yet
        // authorized by the user).
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: {
                readonly checkoutUrl: string;
                readonly localSubscriptionId: string;
                readonly appliedEffect?: string;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.appliedEffect).not.toBe('trial');
        expect(body.data.checkoutUrl).toBe(expectedCheckoutUrl);

        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('incomplete');
        expect(rows[0]?.mpSubscriptionId).toBe('sub_trial_ineligible');

        // ASSERT — the MP adapter WAS invoked exactly once for the new (paid) sub.
        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
    });
});

describe('HOS-110 W1 — promo effect_kind branching within the trial-eligible checkout', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(() => {
        mpStub.config.reset();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    it('comp code wins over an eligible trial: appliedEffect=comp, no trial ever created', async () => {
        // ARRANGE — a comp (free-forever) code + the same trial-declaring plan
        // used by the eligible-trial test above. A comp code must ALWAYS win
        // over a trial: no reason to burn the customer's one-per-lifetime
        // trial only to immediately shadow it with a free-forever sub.
        const seed = await seedBillingTestPlans();
        const promo = await createTestPromoCode({
            code: `COMPWINS-${Date.now()}`,
            effectKind: 'comp'
        });

        const user = await createTestUser({ email: `w1-comp-wins-${Date.now()}@example.com` });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });

        const actor = createMockUserActor({ id: user.id });
        const client = new E2EApiClient(app, actor);

        // ACT
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: seed.expensive.name,
            billingInterval: 'monthly',
            promoCode: promo.code
        });

        // ASSERT — comp wins, not a trial.
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly data: {
                readonly appliedEffect?: string;
                readonly localSubscriptionId: string;
            };
        };
        expect(body.data.appliedEffect).toBe('comp');

        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('comp');
        expect(rows[0]?.customerId).toBe(customer.customerId);

        // Exactly ONE subscription row exists for the customer — no separate
        // trial row was ever created before/alongside the comp one.
        const allSubs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.customerId, customer.customerId));
        expect(allSubs).toHaveLength(1);

        expect(mpStub.config.getCalls('subscriptions.create')).toHaveLength(0);
    });

    it('trial_extension code lengthens the granted trial beyond the plan base length', async () => {
        // ARRANGE — a trial_extension code (+7 days) on top of the expensive
        // plan's 14-day base trial. Expected effective length: 21 days.
        const seed = await seedBillingTestPlans();
        const promo = await createTestPromoCode({
            code: `EXTEND7-${Date.now()}`,
            effectKind: 'trial_extension',
            extraDays: 7
        });

        const user = await createTestUser({ email: `w1-extend-${Date.now()}@example.com` });
        await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });

        const actor = createMockUserActor({ id: user.id });
        const client = new E2EApiClient(app, actor);

        // ACT
        const before = Date.now();
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: seed.expensive.name,
            billingInterval: 'monthly',
            promoCode: promo.code
        });
        const after = Date.now();

        // ASSERT — trial granted, no promoCodeIgnored flag, expiresAt reflects
        // base (14d) + extension (7d) = 21 days from "now" (with a 60s window
        // to absorb request latency).
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly data: {
                readonly appliedEffect?: string;
                readonly promoCodeIgnored?: boolean;
                readonly expiresAt: string;
            };
        };
        expect(body.data.appliedEffect).toBe('trial');
        expect(body.data.promoCodeIgnored).toBeUndefined();

        const expiresAtMs = new Date(body.data.expiresAt).getTime();
        const expectedMinMs = before + 21 * 24 * 60 * 60 * 1000 - 60_000;
        const expectedMaxMs = after + 21 * 24 * 60 * 60 * 1000 + 60_000;
        expect(expiresAtMs).toBeGreaterThanOrEqual(expectedMinMs);
        expect(expiresAtMs).toBeLessThanOrEqual(expectedMaxMs);
    });

    it('discount code is discarded for a trial-eligible customer: trial wins, promoCodeIgnored=true', async () => {
        // ARRANGE — a 50%-off discount code on the trial-declaring plan.
        const seed = await seedBillingTestPlans();
        const promo = await createTestPromoCode({
            code: `DROPPED-${Date.now()}`,
            effectKind: 'discount',
            valueKind: 'percentage',
            value: 50,
            durationCycles: 3
        });

        const user = await createTestUser({ email: `w1-dropped-${Date.now()}@example.com` });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });

        const actor = createMockUserActor({ id: user.id });
        const client = new E2EApiClient(app, actor);

        // ACT
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: seed.expensive.name,
            billingInterval: 'monthly',
            promoCode: promo.code
        });

        // ASSERT — the trial wins outright; the discount is flagged as
        // ignored, never applied, never persisted anywhere on the sub row.
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly data: {
                readonly appliedEffect?: string;
                readonly promoCodeIgnored?: boolean;
                readonly localSubscriptionId: string;
            };
        };
        expect(body.data.appliedEffect).toBe('trial');
        expect(body.data.promoCodeIgnored).toBe(true);

        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('trialing');
        expect(rows[0]?.customerId).toBe(customer.customerId);
        expect(rows[0]?.promoCodeId ?? null).toBeNull();

        // No MP call — the discount was never mutated onto a preapproval,
        // because no preapproval was ever created (trial path, not paid).
        expect(mpStub.config.getCalls('subscriptions.create')).toHaveLength(0);
    });
});
