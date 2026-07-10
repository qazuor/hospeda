/**
 * HOS-115 T-011 — annual trial-vs-pay branch, route-level integration test.
 *
 * HOS-110 unified the no-card trial for the MONTHLY entry path only.
 * HOS-115 closes that follow-up: `initiatePaidAnnualSubscription`
 * (subscription-checkout.service.ts) now inserts the SAME trial branch
 * (after the COMP early-return, before the discount/upfront-charge path) so
 * a first-time, trial-eligible customer who selects the ANNUAL toggle is
 * granted the interval-agnostic no-card trial instead of being routed to an
 * upfront MercadoPago Checkout.
 *
 * This mirrors the harness `trial-vs-pay-checkout.test.ts` established for
 * the monthly branch (HOS-110) — full app + real test DB + MP adapter stub —
 * but drives `billingInterval: 'annual'` and asserts against the ANNUAL
 * paid-path provider call (`checkout.create`, not `subscriptions.create`).
 *
 * AC-1 (spec.md): trial-eligible + annual toggle -> `trialing` subscription
 * via `TrialService.startTrial()`, NO MercadoPago object created, response
 * carries `appliedEffect: 'trial'` with an in-app success URL.
 *
 * AC-3 (expiry cancel-only for an annual-originated trial) is intentionally
 * NOT re-tested here — it is already covered at the service-unit level by
 * `apps/api/test/services/trial.service.test.ts`'s `blockExpiredTrials`
 * suite, which lists/cancels ALL `trialing` subscriptions regardless of
 * origin (interval-agnostic by construction) and additionally has a
 * dedicated "TRIAL_EXPIRED notification upgradeUrl nudge (HOS-115 T-004)"
 * block that exercises an annual-intent (`metadata.intendedInterval:
 * 'annual'`) trial through `blockExpiredTrials()` end-to-end. Duplicating
 * that here would add DB/cron-timing complexity without new coverage.
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
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('HOS-115 T-011 — annual trial-vs-pay branch (POST /start-paid, annual)', () => {
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

    it('AC-1: grants a no-card trial for a trial-eligible customer on the ANNUAL toggle — no MP checkout object, trialing local sub', async () => {
        // ARRANGE — seedBillingTestPlans' `expensive` plan declares a 14-day
        // trial (metadata.hasTrial:true, metadata.trialDays:14). No MP stub
        // response is configured for `checkout.create` (the annual paid-path
        // provider call): if the trial branch ever fell through to the
        // upfront-charge path, the stub would throw "unconfigured operation"
        // and fail this test loudly instead of silently passing.
        const seed = await seedBillingTestPlans();

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

        // ASSERT — response contract: appliedEffect:'trial', in-app success
        // sentinel URL (NOT an MP-hosted checkout URL).
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
        // plan and customer, with NO providerSubscriptionId (no MP checkout
        // object was ever created for an annual entry that resolved to the
        // trial branch). Also sanity-checks AC-8 (intendedInterval='annual'
        // stamped on the trial metadata) as a byproduct of this same flow.
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
        const metadata = row?.metadata as Record<string, unknown> | null;
        expect(metadata?.intendedInterval).toBe('annual');

        // ASSERT — the MP payment adapter's annual checkout-create call was
        // NEVER invoked. A trial-only `billing.subscriptions.create` call
        // (no `mode: 'paid'` / no `checkout.create`) never reaches the
        // payment adapter at the qzpay-core level.
        expect(mpStub.config.getCalls('checkout.create')).toHaveLength(0);
        expect(mpStub.config.getCalls('subscriptions.create')).toHaveLength(0);
    });

    it('AC-2/AC-7: an already-subscribed customer selecting ANNUAL is NOT granted a second trial — falls through to the unchanged upfront MP Checkout', async () => {
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

        const expectedCheckoutUrl = 'https://stub.example/checkout/chk_annual_trial_ineligible';
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_annual_trial_ineligible',
                url: expectedCheckoutUrl,
                status: 'pending'
            })
        );

        const actor = createMockUserActor({ id: user.id });
        const client = new E2EApiClient(app, actor);

        // ACT — checkout against the SAME trial-declaring plan as the eligible test.
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: seed.expensive.name,
            billingInterval: 'annual'
        });

        // ASSERT — normal paid annual path: no appliedEffect:'trial', MP
        // checkoutUrl, local row `pending_provider` (annual's pre-webhook state).
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
        expect(rows[0]?.status).toBe('pending_provider');

        // ASSERT — the MP checkout adapter WAS invoked exactly once for the
        // new (paid) sub; the trial branch was never reached.
        const calls = mpStub.config.getCalls('checkout.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
    });
});
