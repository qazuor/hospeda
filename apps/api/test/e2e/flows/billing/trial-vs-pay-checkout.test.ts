/**
 * HOS-110 / HOS-171 — trial-vs-pay branch of the paid monthly checkout.
 *
 * `initiatePaidMonthlySubscription` (subscription-checkout.service.ts) checks,
 * BEFORE creating the MercadoPago preapproval, whether the resolved plan
 * declares a trial (`hasTrial`/`trialDays` in `billing_plans.metadata`) and
 * the customer has never had a subscription before. When both hold, the
 * resolved free-trial length (plan base + any `trial_extension` promo, see
 * `resolveCheckoutFreeTrialDays`) is forwarded as `freeTrialDays` to the SAME
 * preapproval every other paid checkout creates.
 *
 * Card-first (HOS-171): there is no longer a separate no-card trial branch.
 * A trial-eligible checkout still redirects to MercadoPago, still creates a
 * real preapproval, and still requires the customer's card — MercadoPago
 * simply defers the FIRST charge by `freeTrialDays` (`auto_recurring.free_trial`)
 * instead of charging immediately. `appliedEffect` carries no `'trial'` marker
 * any more (that variant was deleted from `CheckoutAppliedEffect`) — a trial
 * checkout looks exactly like a paid checkout in the response shape; the only
 * difference is invisible to the response and lives in the `free_trial` the
 * preapproval carries.
 *
 * Two scenarios:
 *  - Eligible customer (no prior subscription) + trial-declaring plan →
 *    the preapproval create call carries `freeTrialDays: 14`, no
 *    `appliedEffect` marker, an MP checkoutUrl (redirect required — the card
 *    IS collected even though the first charge is deferred).
 *  - Ineligible customer (already has a — even cancelled — prior
 *    subscription) + the SAME trial-declaring plan → the preapproval create
 *    call carries NO `freeTrialDays` — the unchanged immediate-charge path.
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
import { createMpStubAdapter, type MpStubCall } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

/**
 * Narrow a recorded `subscriptions.create` call down to the qzpay-core
 * `CreateSubscriptionAdapterInput` (the `input` sub-object of the stub's
 * first arg — the top-level arg also carries `providerCustomerId`,
 * `customer`, `price`, `plan`, `externalReference`, etc., but `freeTrialDays`
 * lives on `input`).
 */
function firstCreateInput(call: MpStubCall | undefined): Record<string, unknown> {
    const arg = (call?.args[0] ?? {}) as { input?: Record<string, unknown> };
    return arg.input ?? {};
}

describe('HOS-110/HOS-171 — trial-vs-pay branch (POST /start-paid, monthly)', () => {
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

    it('a trial-eligible customer still gets a real MP preapproval, carrying a 14-day free_trial', async () => {
        // ARRANGE — seedBillingTestPlans' `expensive` plan (owner-pro) declares
        // a 14-day trial (metadata.hasTrial:true, metadata.trialDays:14).
        // Card-first (HOS-171): the trial no longer skips MercadoPago, so the
        // stub MUST be configured for `subscriptions.create` — if it were
        // still unconfigured, the request would fail loudly with
        // MpStubUnconfiguredError instead of silently taking a dead branch.
        const seed = await seedBillingTestPlans();
        const expectedCheckoutUrl = 'https://stub.example/preapproval/sub_trial_eligible';
        mpStub.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({
                id: 'sub_trial_eligible',
                status: 'pending',
                initPoint: expectedCheckoutUrl
            })
        );

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

        // ASSERT — response contract: NO `appliedEffect` marker (the 'trial'
        // variant was deleted from CheckoutAppliedEffect, HOS-171), a REAL MP
        // checkoutUrl (the card is collected even though the charge is
        // deferred — this is the whole point of card-first).
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
        // customer, WITH a providerSubscriptionId this time (a real
        // preapproval was created — card-first has no MP-less trial object).
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
        expect(row?.mpSubscriptionId).toBe('sub_trial_eligible');

        // ASSERT — AC-8/AC-9 core contract: the preapproval create call
        // carries the resolved `freeTrialDays` (plan base, no promo here).
        // This is the single decision point closing the old 74-day leak —
        // there is exactly ONE `free_trial` on ONE preapproval, not a
        // separate no-card trial object plus a later MP trial.
        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
        expect(firstCreateInput(calls[0]).freeTrialDays).toBe(14);
    });

    it('falls through to the unchanged immediate-charge path for an ineligible (already-subscribed) customer', async () => {
        // ARRANGE — same trial-declaring plan, but this customer already has a
        // prior subscription (even a CANCELLED one disqualifies a trial per
        // HOS-171 §7.4 rule 3: "one trial per customer, for life"). Status
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
        // `expired` = an authorized subscription that ran its course. Post-HOS-230
        // the trial gate no longer counts never-authorized backouts (a bare
        // `cancelled` row with no authorizing event history reads as eligible), so
        // this fixture uses an unambiguously-authorized prior sub to stay ineligible.
        await createTestSubscription({
            customerId: customer.customerId,
            planId: seed.cheap.planId,
            status: 'expired'
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

        // ASSERT — normal paid MP path: no appliedEffect marker, MP checkoutUrl,
        // status 'incomplete' (qzpay-core's mode:'paid' create state, not yet
        // authorized by the user) — identical shape to the eligible test above,
        // the ONLY difference is what the create call carries (see below).
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
        expect(rows[0]?.mpSubscriptionId).toBe('sub_trial_ineligible');

        // ASSERT — the MP adapter WAS invoked exactly once, and this time
        // carries NO freeTrialDays — the "one trial per customer, for life"
        // gate suppressed it even though the plan declares one.
        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
        expect(firstCreateInput(calls[0]).freeTrialDays).toBeUndefined();
    });
});

describe('HOS-110 W1 / HOS-171 §7.4 — promo effect_kind branching within the trial-eligible checkout', () => {
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

    it('comp code wins over an eligible trial: appliedEffect=comp, no preapproval ever created', async () => {
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

        // ASSERT — comp wins, not a trial preapproval.
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
        // preapproval was ever created before/alongside the comp one.
        const allSubs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.customerId, customer.customerId));
        expect(allSubs).toHaveLength(1);

        expect(mpStub.config.getCalls('subscriptions.create')).toHaveLength(0);
    });

    it('AC-8: trial_extension code sums with the plan base into ONE 21-day free_trial on the preapproval', async () => {
        // ARRANGE — a trial_extension code (+7 days) on top of the expensive
        // plan's 14-day base trial. Expected effective length: 21 days, sent
        // as ONE `freeTrialDays` to the SAME preapproval every checkout
        // creates — this is the leak AC-8 closes: not 14 now and 7 later.
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

        const expectedCheckoutUrl = 'https://stub.example/preapproval/sub_trial_extend';
        mpStub.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({
                id: 'sub_trial_extend',
                status: 'pending',
                initPoint: expectedCheckoutUrl
            })
        );

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

        // ASSERT — no appliedEffect marker, no promoCodeIgnored flag, the
        // preapproval create call carries freeTrialDays: 21 (14 base + 7
        // extension), and expiresAt reflects the generic pending-provider TTL
        // (30 minutes) — NOT the trial length. A trial checkout is an ordinary
        // preapproval redirect now; its abandonment TTL is the same as any
        // other paid checkout, unlike the old no-card design where expiresAt
        // mirrored the granted trial length.
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly data: {
                readonly appliedEffect?: string;
                readonly promoCodeIgnored?: boolean;
                readonly expiresAt: string;
                readonly checkoutUrl: string;
            };
        };
        expect(body.data.appliedEffect).toBeUndefined();
        expect(body.data.promoCodeIgnored).toBeUndefined();
        expect(body.data.checkoutUrl).toBe(expectedCheckoutUrl);

        const PENDING_PROVIDER_TTL_MS = 30 * 60 * 1000;
        const expiresAtMs = new Date(body.data.expiresAt).getTime();
        expect(expiresAtMs).toBeGreaterThanOrEqual(before + PENDING_PROVIDER_TTL_MS - 60_000);
        expect(expiresAtMs).toBeLessThanOrEqual(after + PENDING_PROVIDER_TTL_MS + 60_000);

        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(firstCreateInput(calls[0]).freeTrialDays).toBe(21);
    });

    it('discount code applies ALONGSIDE the trial for a trial-eligible customer (HOS-171)', async () => {
        // ARRANGE — a 50%-off discount code on the trial-declaring plan.
        const seed = await seedBillingTestPlans();
        const promo = await createTestPromoCode({
            code: `COMBINED-${Date.now()}`,
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

        const expectedCheckoutUrl = 'https://stub.example/preapproval/sub_trial_with_discount';
        mpStub.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({
                id: 'sub_trial_with_discount',
                status: 'pending',
                initPoint: expectedCheckoutUrl
            })
        );
        // The discount is applied by mutating the live preapproval's amount
        // down — the trial no longer swallows it (HOS-171).
        mpStub.config.setSuccess(
            'subscriptions.update',
            providerResponseFixtures.subscription({
                id: 'sub_trial_with_discount',
                status: 'pending',
                initPoint: expectedCheckoutUrl
            })
        );

        const actor = createMockUserActor({ id: user.id });
        const client = new E2EApiClient(app, actor);

        // ACT
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: seed.expensive.name,
            billingInterval: 'monthly',
            promoCode: promo.code
        });

        // ASSERT — the customer gets BOTH. The trial defers the first charge;
        // the discount lowers what that charge will be. They stopped being
        // mutually exclusive when the trial became a real preapproval: there is
        // now an amount to discount, and one row carries both.
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly data: {
                readonly appliedEffect?: string;
                readonly promoCodeIgnored?: boolean;
                readonly localSubscriptionId: string;
                readonly checkoutUrl: string;
            };
        };
        expect(body.data.appliedEffect).toBe('discount');
        expect(body.data.promoCodeIgnored).toBeUndefined();
        expect(body.data.checkoutUrl).toBe(expectedCheckoutUrl);

        // The promo is really persisted against the subscription now — it is no
        // longer discarded, so the cycle counter must be seeded for the renewal
        // engine to count it down.
        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.customerId).toBe(customer.customerId);
        expect(rows[0]?.promoCodeId).toBe(promo.promoCodeId);

        // ONE preapproval, carrying the base trial length, THEN mutated down.
        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(firstCreateInput(calls[0]).freeTrialDays).toBe(14);
        expect(mpStub.config.getCalls('subscriptions.update')).toHaveLength(1);
    });
});
