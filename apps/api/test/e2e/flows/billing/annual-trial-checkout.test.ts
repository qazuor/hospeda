/**
 * HOS-115 / HOS-171 T-011 — annual trial-vs-pay branch, route-level integration test.
 *
 * HOS-110 unified the no-card trial for the MONTHLY entry path; HOS-115
 * extended the same decision to ANNUAL. HOS-171 (card-first) then removed the
 * no-card trial entirely: `initiatePaidAnnualSubscription`
 * (subscription-checkout.service.ts) no longer branches into a separate
 * MP-less trial object. Instead it is now ALWAYS a real MercadoPago
 * preapproval — `billingInterval: 'annual'` maps to
 * `frequency: 12, frequency_type: 'months'` — and a trial-eligible customer
 * simply gets that SAME preapproval with `freeTrialDays` forwarded, deferring
 * the first (annual) charge instead of skipping MercadoPago altogether.
 * `create-annual-subscription.ts` (the old one-time-charge insert path) no
 * longer exists; annual is not a "different kind of thing" any more — it is
 * the same preapproval flow as monthly at a different cadence.
 *
 * This mirrors the harness `trial-vs-pay-checkout.test.ts` established for
 * the monthly branch, but drives `billingInterval: 'annual'` and asserts the
 * create call carries `billingInterval: 'annual'` (mapped by qzpay to MP's
 * 12-month cadence) alongside `freeTrialDays`.
 *
 * AC-1 (spec.md, HOS-171 §11): trial-eligible + annual toggle -> a real
 * preapproval carrying `freeTrialDays`, no `appliedEffect` marker (the
 * `'trial'` variant was deleted from `CheckoutAppliedEffect`), an MP
 * checkoutUrl (redirect required — the card IS collected).
 *
 * AC-3 (expiry cancel-only for an annual-originated trial) is intentionally
 * NOT re-tested here — it is a webhook/cron-timing concern covered at the
 * service-unit level elsewhere, orthogonal to this route-level branch test.
 *
 * @module test/e2e/flows/billing/annual-trial-checkout
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
                    'mp-stub adapter not initialized — annual-trial-checkout.test.ts must wire stubRef before the first request'
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
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { providerResponseFixtures } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter, type MpStubCall } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

/**
 * Narrow a recorded `subscriptions.create` call down to the qzpay-core
 * `CreateSubscriptionAdapterInput` (the `input` sub-object of the stub's
 * first arg — verified empirically against `trial-vs-pay-checkout.test.ts`,
 * the monthly counterpart of this same harness: the top-level arg also
 * carries `providerCustomerId`, `customer`, `price`, `plan`,
 * `externalReference`, etc., but `freeTrialDays`/`billingInterval` live on
 * `input`).
 */
function firstCreateInput(call: MpStubCall | undefined): Record<string, unknown> {
    const arg = (call?.args[0] ?? {}) as { input?: Record<string, unknown> };
    return arg.input ?? {};
}

describe('HOS-115/HOS-171 T-011 — annual trial-vs-pay branch (POST /start-paid, annual)', () => {
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

    it('AC-1: a trial-eligible customer on the ANNUAL toggle gets a real 12-month preapproval carrying a 14-day free_trial', async () => {
        // ARRANGE — seedBillingTestPlans' `expensive` plan declares a 14-day
        // trial (metadata.hasTrial:true, metadata.trialDays:14). Card-first
        // (HOS-171): annual is a preapproval now, same as monthly, so the
        // stub MUST be configured for `subscriptions.create` — if it were
        // still unconfigured, the request would fail loudly with
        // MpStubUnconfiguredError instead of silently taking a dead branch.
        const seed = await seedBillingTestPlans();
        const expectedCheckoutUrl = 'https://stub.example/preapproval/sub_annual_trial_eligible';
        mpStub.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({
                id: 'sub_annual_trial_eligible',
                status: 'pending',
                initPoint: expectedCheckoutUrl
            })
        );

        const user = await createTestUser({
            email: `annual-trial-eligible-${Date.now()}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });

        const actor = createMockUserActor({ id: user.id });
        const client = new E2EApiClient(app, actor);

        // ACT — the ANNUAL toggle, not monthly.
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: seed.expensive.name,
            billingInterval: 'annual'
        });

        // ASSERT — response contract: NO `appliedEffect` marker, a REAL MP
        // checkoutUrl (the card is collected even though the first annual
        // charge is deferred by the free_trial — this is the whole point of
        // card-first).
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
        expect(body.data.appliedEffect).toBeUndefined();
        expect(body.data.checkoutUrl).toBe(expectedCheckoutUrl);
        expect(body.data.localSubscriptionId).toMatch(/^[0-9a-f-]{36}$/);

        // ASSERT — local subscription row is tied to the resolved plan and
        // customer, WITH a providerSubscriptionId (a real preapproval was
        // created — card-first has no MP-less trial object on either
        // interval). `create-annual-subscription.ts`'s direct-insert
        // `pending_provider` shape is gone; this row comes from the same
        // qzpay-core create path monthly uses.
        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toBeDefined();
        expect(row?.customerId).toBe(customer.customerId);
        expect(row?.planId).toBe(seed.expensive.planId);
        expect(row?.mpSubscriptionId).toBe('sub_annual_trial_eligible');

        // ASSERT — AC-8/AC-9 core contract, on the ANNUAL entry point too: the
        // preapproval create call carries `billingInterval: 'annual'` (qzpay
        // maps this to MP's `frequency: 12, frequency_type: 'months'`) AND
        // the resolved `freeTrialDays` (plan base, no promo here) — ONE
        // preapproval, ONE free_trial, not a separate no-card trial plus a
        // later upfront annual charge.
        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
        const createInput = firstCreateInput(calls[0]);
        expect(createInput.billingInterval).toBe('annual');
        expect(createInput.freeTrialDays).toBe(14);

        // ASSERT — the one-time `checkout.create` provider call (the OLD
        // annual mechanism) was never invoked — annual no longer goes through
        // `billing.checkout.create({ mode: 'payment' })` at all.
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(0);
    });

    it('AC-2/AC-7: an already-subscribed customer selecting ANNUAL is NOT granted a trial — the preapproval create call carries no freeTrialDays', async () => {
        // ARRANGE — same trial-declaring plan, but this customer already has a
        // prior subscription (even a CANCELLED one disqualifies a trial per
        // the cross-interval "one trial per customer, for life" rule — AC-7).
        // Status 'cancelled' is deliberately used (not 'active'/'trialing'/
        // 'comp') so the route-level ALREADY_SUBSCRIBED guard in
        // start-paid.ts does NOT reject the request before it reaches
        // `initiatePaidAnnualSubscription` — this test exercises the
        // SERVICE-level trial-eligibility fallthrough, not an earlier
        // route-level short-circuit.
        const seed = await seedBillingTestPlans();

        const user = await createTestUser({
            email: `annual-trial-ineligible-${Date.now()}@example.com`
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

        const expectedCheckoutUrl = 'https://stub.example/preapproval/sub_annual_trial_ineligible';
        mpStub.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({
                id: 'sub_annual_trial_ineligible',
                status: 'pending',
                initPoint: expectedCheckoutUrl
            })
        );

        const actor = createMockUserActor({ id: user.id });
        const client = new E2EApiClient(app, actor);

        // ACT — checkout against the SAME trial-declaring plan as the eligible test.
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: seed.expensive.name,
            billingInterval: 'annual'
        });

        // ASSERT — normal paid annual path: no appliedEffect marker, MP
        // checkoutUrl, local row `incomplete` (qzpay's pre-webhook state for a
        // `mode: 'paid'` create — annual shares the SAME local status space as
        // monthly now, not the old direct-insert `pending_provider`).
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
        expect(body.data.appliedEffect).toBeUndefined();
        expect(body.data.checkoutUrl).toBe(expectedCheckoutUrl);

        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('incomplete');
        expect(rows[0]?.mpSubscriptionId).toBe('sub_annual_trial_ineligible');

        // ASSERT — the MP adapter WAS invoked exactly once for the new (paid)
        // sub, carrying `billingInterval: 'annual'` but NO freeTrialDays — the
        // "one trial per customer, for life" gate suppressed it even though
        // the plan declares one.
        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
        const createInput = firstCreateInput(calls[0]);
        expect(createInput.billingInterval).toBe('annual');
        expect(createInput.freeTrialDays).toBeUndefined();
    });
});
