/**
 * SPEC-262 T-012 P2 / HOS-171 / HOS-191 — subscription-checkout discount/comp/
 * trial branch routing tests.
 *
 * Exercises the promo branches wired into initiatePaidMonthlySubscription /
 * initiatePaidAnnualSubscription, with the promo resolver + comp creator +
 * MP-plan provisioning + pending-subscription materialization seams mocked
 * (so this stays a focused branch-routing test, not an MP/DB integration
 * test).
 *
 * HOS-171 (card-first) removed the separate no-card trial branch. A trial is
 * baked into the MP `preapproval_plan` resolved by `resolveCheckoutMpPlanId`
 * (via its `trialDays` input) — the SAME resolution + pending-subscription
 * materialization every checkout makes, trial or not. `CheckoutAppliedEffect`
 * has no `'trial'` variant: a granted trial produces no `appliedEffect`
 * marker, only the boolean `trialGranted` on the pending-subscription input
 * and result. Precedence: `comp` wins outright -> `trial_extension` lengthens
 * the trial -> `discount` COEXISTS with a trial (both apply).
 *
 * HOS-191 Path C removed the server-side preapproval create entirely
 * (MercadoPago rejects `POST /preapproval` built from a `preapproval_plan_id`
 * with "card_token_id is required" unless a card was already tokenized).
 * Neither monthly nor annual create a preapproval synchronously any more:
 * both resolve/provision an MP plan, materialize a `pending_provider`
 * subscription via `createPendingProviderSubscription`, and redirect to
 * MercadoPago's hosted share link. A resolved `discount` is therefore
 * DEFERRED — snapshotted as `pendingDiscount` on the pending-subscription
 * input instead of mutating a live preapproval — since there is no
 * preapproval yet to mutate. The old FAIL-CLOSED "mutation rejected by MP,
 * cancel the just-created subscription" scenario no longer exists at this
 * layer (there is nothing to cancel — F2/F3, out of scope here, own applying
 * the deferred discount once the real preapproval is linked).
 *
 * Critical coverage (CI guardrail):
 *  - comp (monthly + annual) → createCompSubscription, appliedEffect='comp', no MP plan resolution.
 *  - discount happy path (monthly + annual) → appliedEffect='discount', pendingDiscount snapshotted.
 *  - discount COEXISTS with a granted trial (HOS-171): both the `trialGranted`
 *    marker and `pendingDiscount` are present.
 *  - AC-8: a 60-day `trial_extension` on a 14-day plan resolves the MP plan
 *    with `trialDays: 74`.
 *  - AC-9: `HOSPEDA_TRIAL_DAYS_OVERRIDE=0` suppresses the trial even with an
 *    extension promo (the kill-switch is evaluated against the BASE length).
 *  - AC-10: any prior subscription (any status) -> no trial, `trialDays: 0`.
 *  - SPEC-262 C1+H1: expired/restricted codes → INVALID_PROMO_CODE (resolver returns invalid).
 *  - SPEC-262 L1: 100% discount → INVALID_PROMO_CODE (0-amount rejected before the pending subscription).
 *
 * @module test/services/subscription-checkout-promo-branches
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock the promo resolver + new helper modules -------------------------
const resolveCheckoutPromoPlanMock = vi.fn();
vi.mock('../../src/services/subscription-checkout-promo.service', () => ({
    resolveCheckoutPromoPlan: (...args: unknown[]) => resolveCheckoutPromoPlanMock(...args)
}));

const createCompSubscriptionMock = vi.fn();
vi.mock('../../src/services/subscription-comp-create.service', () => ({
    createCompSubscription: (...args: unknown[]) => createCompSubscriptionMock(...args)
}));

// HOS-191: the real Initiate* flows now resolve/provision a MercadoPago
// preapproval_plan via `resolveCheckoutMpPlanId`, which reaches the payment
// adapter singleton + `billing_mp_plans`. Stub it at this one boundary so
// these promo-branch tests exercise the checkout decision logic without a
// live adapter or DB. `buildPreapprovalPlanShareLink` is a pure function kept
// REAL (via `importOriginal`) so `checkoutUrl` assertions exercise the actual
// URL-building logic. The provisioning service itself is unit-tested in
// `mp-plan-provisioning.test.ts`.
const resolveCheckoutMpPlanIdMock = vi.fn().mockResolvedValue('mp_plan_test');
vi.mock('../../src/services/billing/mp-plan-provisioning.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../src/services/billing/mp-plan-provisioning.service')
        >();
    return {
        ...actual,
        resolveCheckoutMpPlanId: (...args: unknown[]) => resolveCheckoutMpPlanIdMock(...args),
        resolveOrProvisionMpPlan: vi.fn()
    };
});

// HOS-191 Path C: no preapproval / local subscription is created via
// `billing.subscriptions.create` any more — `createPendingProviderSubscription`
// materializes the `pending_provider` row + correlation row instead. Mocked
// here so these branch-routing tests do not require a live DB; the helper
// itself is unit-tested in `pending-provider-subscription-create.test.ts`.
const createPendingProviderSubscriptionMock = vi.fn();
vi.mock('../../src/services/billing/pending-provider-subscription-create', () => ({
    createPendingProviderSubscription: (...args: unknown[]) =>
        createPendingProviderSubscriptionMock(...args)
}));

const resolveFullPlanPriceCentavosMock = vi.fn();
const calculatePromoCodeEffectMock = vi.fn();
const redeemAndRecordUsageMock = vi.fn();
// HOS-110: keep the rest of the real module (PlanService, resolvePlanTrialConfig,
// resolveCheckoutFreeTrialDays, withServiceTransaction, etc.) intact via
// importActual — subscription-checkout.service.ts transitively imports symbols
// from '@repo/service-core' that construct module-level singletons at import
// time. A fully-replaced mock (no importActual) breaks that construction for
// every test in this file, not just the promo ones.
vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual('@repo/service-core');
    return {
        ...actual,
        resolveFullPlanPriceCentavos: (...args: unknown[]) =>
            resolveFullPlanPriceCentavosMock(...args),
        calculatePromoCodeEffect: (...args: unknown[]) => calculatePromoCodeEffectMock(...args),
        redeemAndRecordUsage: (...args: unknown[]) => redeemAndRecordUsageMock(...args)
    };
});

const dbExecuteMock = vi.fn();
const dbInsertValuesMock = vi.fn();
// HOS-110: importActual (not a full replace) for the same reason as the
// @repo/service-core mock above — the real @repo/service-core module graph
// needs real @repo/db exports too.
vi.mock('@repo/db', async () => {
    const actual = await vi.importActual('@repo/db');
    return {
        ...actual,
        getDb: vi.fn(() => ({
            execute: dbExecuteMock,
            insert: vi.fn(() => ({ values: dbInsertValuesMock }))
        })),
        billingSubscriptions: { __table: 'billing_subscriptions' },
        commerceListingSubscriptions: { __table: 'commerce_listing_subscriptions' },
        sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
        withTransaction: vi.fn()
    };
});

// HOS-110: importActual for the same transitive reason (permission.ts, imported
// via @repo/service-core, needs the real PermissionEnum and friends).
vi.mock('@repo/schemas', async () => {
    const actual = await vi.importActual('@repo/schemas');
    return {
        ...actual,
        ProductDomainEnum: { ACCOMMODATION: 'accommodation', COMMERCE: 'commerce' }
    };
});

vi.mock('../../src/utils/env', () => ({ env: { HOSPEDA_BILLING_POLLING_ENABLED: false } }));
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import {
    initiatePaidAnnualSubscription,
    initiatePaidMonthlySubscription,
    type SubscriptionCheckoutError
} from '../../src/services/subscription-checkout.service';
import { env } from '../../src/utils/env';

// --- Fixtures -------------------------------------------------------------

const PLAN = {
    id: 'plan-uuid-1',
    name: 'owner-premium',
    prices: [
        {
            id: 'price-m',
            billingInterval: 'month',
            intervalCount: 1,
            active: true,
            unitAmount: 10000
        },
        {
            id: 'price-y',
            billingInterval: 'year',
            intervalCount: 1,
            active: true,
            unitAmount: 100000
        }
    ]
};

const MONTHLY_URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

const ANNUAL_URLS = {
    successUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
    cancelUrl: 'https://hospeda.test/es/suscriptores/checkout/failure/',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

const EXPECTED_SHARE_LINK =
    'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=mp_plan_test';

/** Default pending-provider result — overridden per-test via `mockResolvedValueOnce`. */
const DEFAULT_PENDING_RESULT = {
    localSubscriptionId: 'pending-sub-1',
    nonce: 'nonce-test',
    expiresAt: '2099-01-01T00:00:00.000Z'
};

function makeBilling(opts: { checkout?: Record<string, unknown> } = {}) {
    return {
        plans: { list: vi.fn().mockResolvedValue({ data: [PLAN] }) },
        customers: {
            get: vi.fn().mockResolvedValue({
                id: 'cust-1',
                email: 'a@b.test',
                name: 'A B',
                livemode: false
            })
        },
        subscriptions: {
            // HOS-191 Path C never calls this any more — retained ONLY so
            // "not called" assertions have a spy to inspect.
            create: vi.fn(),
            cancel: vi.fn().mockResolvedValue(undefined)
        },
        checkout: {
            // HOS-191 Path C never calls this either — same reasoning.
            create: vi
                .fn()
                .mockResolvedValue(
                    opts.checkout ?? { id: 'co-1', providerInitPoint: 'https://mp.test/annual/abc' }
                )
        },
        getStorage: vi.fn(() => ({}))
    };
}

/** Shared base input for monthly calls (SPEC-262 C1+H1: userId now required). */
const MONTHLY_BASE = {
    customerId: 'cust-1',
    userId: 'user-1',
    planSlug: 'owner-premium',
    urls: MONTHLY_URLS
} as const;

/** Shared base input for annual calls. */
const ANNUAL_BASE = {
    customerId: 'cust-1',
    userId: 'user-1',
    planSlug: 'owner-premium',
    urls: ANNUAL_URLS
} as const;

// --- HOS-110/HOS-171 fixtures: a plan that declares a trial -----------------

/**
 * Same slug as PLAN/MONTHLY_BASE.planSlug, but declares a 14-day trial.
 * Carries BOTH a monthly and an annual price (HOS-115) so the same fixture
 * serves the monthly TRIAL-eligible tests and the annual TRIAL-eligible tests
 * — `initiatePaidAnnualSubscription` resolves `findAnnualPrice` BEFORE the
 * promo/trial branches run, so an annual price row is required for any
 * annual test that reaches this fixture.
 */
const TRIAL_PLAN = {
    id: 'plan-uuid-trial',
    name: 'owner-premium',
    metadata: { hasTrial: true, trialDays: 14 },
    prices: [
        {
            id: 'price-m',
            billingInterval: 'month',
            intervalCount: 1,
            active: true,
            unitAmount: 10000
        },
        {
            id: 'price-y',
            billingInterval: 'year',
            intervalCount: 1,
            active: true,
            unitAmount: 100000
        }
    ]
};

/**
 * Billing stub for the trial-eligibility / trial-vs-promo branch tests.
 * Extends `makeBilling`'s shape with the extra call the eligibility check
 * needs (`subscriptions.getByCustomerId`). `plans.list()` resolves
 * {@link TRIAL_PLAN}.
 */
function makeTrialBilling(opts: { existingSubscriptions?: readonly unknown[] } = {}) {
    return {
        plans: { list: vi.fn().mockResolvedValue({ data: [TRIAL_PLAN] }) },
        customers: {
            get: vi.fn().mockResolvedValue({
                id: 'cust-1',
                email: 'a@b.test',
                name: 'A B',
                livemode: false
            })
        },
        subscriptions: {
            // HOS-191 Path C never calls this any more — retained ONLY so
            // "not called" assertions have a spy to inspect.
            create: vi.fn(),
            cancel: vi.fn().mockResolvedValue(undefined),
            getByCustomerId: vi.fn().mockResolvedValue(opts.existingSubscriptions ?? [])
        },
        checkout: { create: vi.fn() },
        getStorage: vi.fn(() => ({}))
    };
}

/** Extracts the object `resolveCheckoutMpPlanId` was called with. */
function mpPlanCallArg(): Record<string, unknown> {
    return (resolveCheckoutMpPlanIdMock.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
}

/** Extracts the object `createPendingProviderSubscription` was called with. */
function pendingCallArg(): Record<string, unknown> {
    return (createPendingProviderSubscriptionMock.mock.calls[0]?.[0] ?? {}) as Record<
        string,
        unknown
    >;
}

describe('HOS-110 W1 / HOS-171 / HOS-191: promo effect_kind precedence before the pending subscription is materialized (monthly)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createPendingProviderSubscriptionMock.mockResolvedValue(DEFAULT_PENDING_RESULT);
    });

    it('comp wins over a trial: comp branch resolves first, the MP plan is never resolved', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'comp',
            promoCodeId: 'pc-1',
            code: 'COMPVIP'
        });
        createCompSubscriptionMock.mockResolvedValue({ localSubscriptionId: 'comp-sub-1' });
        const billing = makeTrialBilling();

        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'COMPVIP'
        });

        expect(result.appliedEffect).toBe('comp');
        expect(result.localSubscriptionId).toBe('comp-sub-1');
        expect(createCompSubscriptionMock).toHaveBeenCalledOnce();
        // Neither the eligibility check nor the MP plan resolution ever ran.
        expect(billing.subscriptions.getByCustomerId).not.toHaveBeenCalled();
        expect(resolveCheckoutMpPlanIdMock).not.toHaveBeenCalled();
        expect(createPendingProviderSubscriptionMock).not.toHaveBeenCalled();
    });

    it('AC-8: trial_extension sums with the plan base into ONE 74-day trialDays sent to the MP plan resolver', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'trial', freeTrialDays: 60 });
        const billing = makeTrialBilling();

        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'EXTEND60'
        });

        // No 'trial' marker — card-first removed that CheckoutAppliedEffect
        // variant. The trial is invisible in `appliedEffect`.
        expect(result.appliedEffect).toBeUndefined();
        expect(result.promoCodeIgnored).toBeUndefined();
        expect(result.trialGranted).toBe(true);
        // Exactly ONE MP plan resolution, carrying 74 days (14 base + 60
        // extension) as `trialDays` — not 14 now and 60 again later.
        expect(mpPlanCallArg().trialDays).toBe(74);
        expect(pendingCallArg().trialGranted).toBe(true);
        // HOS-240: a config-backed trial (no DB id) records NO redemption.
        expect(pendingCallArg().pendingTrialExtension).toBeUndefined();
    });

    it('HOS-240: a DB-backed trial_extension threads pendingTrialExtension to the pending sub', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'trial',
            freeTrialDays: 30,
            promoCodeId: 'pc-trial-1',
            code: 'FREEMONTH'
        });
        const billing = makeTrialBilling();

        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'FREEMONTH'
        });

        expect(result.trialGranted).toBe(true);
        // HOS-240: the promo identity is SNAPSHOTTED on the pending sub / correlation
        // row — its redemption is DEFERRED to link time (link-preapproval.service.ts),
        // NOT recorded at checkout. So the checkout must perform no redemption here.
        expect(pendingCallArg().pendingTrialExtension).toEqual({
            promoCodeId: 'pc-trial-1',
            code: 'FREEMONTH'
        });
        expect(redeemAndRecordUsageMock).not.toHaveBeenCalled();
    });

    it('HOS-240: a DB trial_extension that grants NO trial (prior subscription) records no redemption', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'trial',
            freeTrialDays: 30,
            promoCodeId: 'pc-trial-1',
            code: 'FREEMONTH'
        });
        // A customer who already had a subscription burns the one-per-lifetime
        // trial → the extension is ignored → nothing to redeem.
        const billing = makeTrialBilling({ existingSubscriptions: [{ id: 'old-sub' }] });

        await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'FREEMONTH'
        });

        expect(pendingCallArg().trialGranted).toBe(false);
        expect(pendingCallArg().pendingTrialExtension).toBeUndefined();
    });

    it('discount: applies ALONGSIDE the trial — the customer gets both (HOS-171)', async () => {
        // Arrange — a trial-eligible customer on a 14-day plan, with a 50%-off code
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'discount',
            promoCodeId: 'pc-1',
            code: 'LANZA50',
            effect: { kind: 'discount', valueKind: 'percentage', value: 50, durationCycles: 3 }
        });
        calculatePromoCodeEffectMock.mockReturnValue({
            type: 'apply-discount',
            discountAmount: 5000,
            finalAmount: 5000,
            remainingCycles: 3
        });
        const billing = makeTrialBilling();

        // Act
        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'LANZA50'
        });

        // Assert — the trial defers the first charge; the discount lowers what
        // that charge will be once linked (F2/F3). They are no longer mutually
        // exclusive (HOS-171).
        expect(result.promoCodeIgnored).toBeUndefined();
        expect(result.appliedEffect).toBe('discount');
        expect(result.trialGranted).toBe(true);
        // The trial is untouched, at its base length.
        expect(mpPlanCallArg().trialDays).toBe(14);
        // And the discount is snapshotted for the deferred F2/F3 apply — Path C
        // never mutates a live preapproval synchronously.
        expect(pendingCallArg().pendingDiscount).toEqual({
            promoCodeId: 'pc-1',
            finalAmountCentavos: 5000
        });
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('none: no promo code supplied → the trial is granted at its base length, no promoCodeIgnored flag', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'none' });
        const billing = makeTrialBilling();

        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any
        });

        expect(result.appliedEffect).toBeUndefined();
        expect(result.promoCodeIgnored).toBeUndefined();
        expect(mpPlanCallArg().trialDays).toBe(14);
    });

    it('AC-10: a customer with a prior authorized subscription gets no trial and resolves a no-trial MP plan', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'none' });
        // `expired` = a real, authorized subscription that ran its course. Since
        // HOS-230 the gate no longer counts never-authorized backouts
        // (abandoned / pending -> cancelled); an authorized prior sub still does.
        const billing = makeTrialBilling({
            existingSubscriptions: [{ id: 'existing-sub', status: 'expired' }]
        });

        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any
        });

        expect(result.appliedEffect).toBeUndefined();
        expect(result.trialGranted).toBeUndefined();
        expect(billing.subscriptions.getByCustomerId).toHaveBeenCalledOnce();
        expect(mpPlanCallArg().trialDays).toBe(0);
        expect(pendingCallArg().trialGranted).toBe(false);
    });

    it('an invalid promo code always throws INVALID_PROMO_CODE, even for a trial-eligible customer', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'invalid',
            message: 'This promo code has expired'
        });
        const billing = makeTrialBilling();

        let thrown: unknown;
        try {
            await initiatePaidMonthlySubscription({
                ...MONTHLY_BASE,
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                promoCode: 'EXPIRED'
            });
        } catch (e) {
            thrown = e;
        }

        expect((thrown as SubscriptionCheckoutError).code).toBe('INVALID_PROMO_CODE');
        // Neither the eligibility check nor the MP plan resolution ever ran.
        expect(billing.subscriptions.getByCustomerId).not.toHaveBeenCalled();
        expect(resolveCheckoutMpPlanIdMock).not.toHaveBeenCalled();
    });
});

describe('HOS-171 §7.4 AC-9: the ops kill-switch beats an extension promo', () => {
    let originalOverride: typeof env.HOSPEDA_TRIAL_DAYS_OVERRIDE;

    beforeEach(() => {
        vi.clearAllMocks();
        createPendingProviderSubscriptionMock.mockResolvedValue(DEFAULT_PENDING_RESULT);
        originalOverride = env.HOSPEDA_TRIAL_DAYS_OVERRIDE;
    });

    afterEach(() => {
        env.HOSPEDA_TRIAL_DAYS_OVERRIDE = originalOverride;
    });

    it('HOSPEDA_TRIAL_DAYS_OVERRIDE=0 suppresses the trial even with a 60-day extension promo (monthly)', async () => {
        env.HOSPEDA_TRIAL_DAYS_OVERRIDE = 0;
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'trial', freeTrialDays: 60 });
        const billing = makeTrialBilling();

        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'EXTEND60'
        });

        // The extension is discarded — nothing to lengthen — and the
        // customer resolves a full-price, no-trial MP plan.
        expect(result.appliedEffect).toBeUndefined();
        expect(result.promoCodeIgnored).toBe(true);
        expect(mpPlanCallArg().trialDays).toBe(0);
    });

    it('HOSPEDA_TRIAL_DAYS_OVERRIDE=0 suppresses the trial even with a 10-day extension promo (annual)', async () => {
        env.HOSPEDA_TRIAL_DAYS_OVERRIDE = 0;
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'trial', freeTrialDays: 10 });
        const billing = makeTrialBilling();

        const result = await initiatePaidAnnualSubscription({
            ...ANNUAL_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'EXTEND10'
        });

        expect(result.appliedEffect).toBeUndefined();
        expect(result.promoCodeIgnored).toBe(true);
        expect(mpPlanCallArg().billingInterval).toBe('annual');
        expect(mpPlanCallArg().trialDays).toBe(0);
    });
});

describe('monthly comp branch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createPendingProviderSubscriptionMock.mockResolvedValue(DEFAULT_PENDING_RESULT);
    });

    it('routes comp → createCompSubscription, appliedEffect=comp, no MP plan resolution', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'comp',
            promoCodeId: 'pc-1',
            code: 'COMPVIP'
        });
        createCompSubscriptionMock.mockResolvedValue({ localSubscriptionId: 'comp-sub-1' });
        const billing = makeBilling();

        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'COMPVIP'
        });

        expect(result.appliedEffect).toBe('comp');
        expect(result.localSubscriptionId).toBe('comp-sub-1');
        expect(result.checkoutUrl).toBe(MONTHLY_URLS.paymentMethodReturnUrl);
        expect(resolveCheckoutMpPlanIdMock).not.toHaveBeenCalled();
        expect(createPendingProviderSubscriptionMock).not.toHaveBeenCalled();
        expect(createCompSubscriptionMock).toHaveBeenCalledOnce();
    });
});

describe('monthly discount branch (deferred — HOS-191 Path C)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createPendingProviderSubscriptionMock.mockResolvedValue(DEFAULT_PENDING_RESULT);
    });

    it('discount happy path → appliedEffect=discount, pendingDiscount snapshotted, MP hosted share-link checkoutUrl', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'discount',
            promoCodeId: 'pc-1',
            code: 'LANZA50',
            effect: { kind: 'discount', valueKind: 'percentage', value: 50, durationCycles: 3 }
        });
        // SPEC-262 L1: non-zero final amount (50% of 10000 = 5000)
        calculatePromoCodeEffectMock.mockReturnValue({
            type: 'apply-discount',
            discountAmount: 5000,
            finalAmount: 5000,
            remainingCycles: 3
        });
        const billing = makeBilling();

        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'LANZA50'
        });

        expect(result.appliedEffect).toBe('discount');
        expect(result.checkoutUrl).toBe(EXPECTED_SHARE_LINK);
        expect(pendingCallArg().pendingDiscount).toEqual({
            promoCodeId: 'pc-1',
            finalAmountCentavos: 5000
        });
        // No live preapproval exists yet to mutate or cancel.
        expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
        // resolveFullPlanPriceCentavos is unused by the checkout path — the
        // discount amount is derived from the already-resolved monthlyPrice.
        expect(resolveFullPlanPriceCentavosMock).not.toHaveBeenCalled();
    });

    it('SPEC-262 L1: 100% discount (finalAmount=0) → INVALID_PROMO_CODE, no pending subscription materialized', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'discount',
            promoCodeId: 'pc-1',
            code: 'FREE100',
            effect: { kind: 'discount', valueKind: 'percentage', value: 100, durationCycles: 1 }
        });
        // 100% off → finalAmount = 0
        calculatePromoCodeEffectMock.mockReturnValue({
            type: 'apply-discount',
            discountAmount: 10000,
            finalAmount: 0,
            remainingCycles: 1
        });
        const billing = makeBilling();

        let thrown: unknown;
        try {
            await initiatePaidMonthlySubscription({
                ...MONTHLY_BASE,
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                promoCode: 'FREE100'
            });
        } catch (e) {
            thrown = e;
        }

        expect((thrown as SubscriptionCheckoutError).code).toBe('INVALID_PROMO_CODE');
        // Rejected before the MP plan is even resolved.
        expect(resolveCheckoutMpPlanIdMock).not.toHaveBeenCalled();
        expect(createPendingProviderSubscriptionMock).not.toHaveBeenCalled();
    });

    it('SPEC-262 C1+H1: resolver returns invalid (expired/restricted) → INVALID_PROMO_CODE', async () => {
        // Simulates validatePromoCode returning valid:false inside the resolver.
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'invalid',
            message: 'This promo code has expired'
        });
        const billing = makeBilling();

        let thrown: unknown;
        try {
            await initiatePaidMonthlySubscription({
                ...MONTHLY_BASE,
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                promoCode: 'EXPIRED'
            });
        } catch (e) {
            thrown = e;
        }

        expect((thrown as SubscriptionCheckoutError).code).toBe('INVALID_PROMO_CODE');
        expect(createPendingProviderSubscriptionMock).not.toHaveBeenCalled();
    });
});

describe('annual comp + discount branches (HOS-171 §7.2: annual resolves an MP plan too)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createPendingProviderSubscriptionMock.mockResolvedValue(DEFAULT_PENDING_RESULT);
    });

    it('comp → createCompSubscription(interval=annual), appliedEffect=comp, no MP plan resolution', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'comp',
            promoCodeId: 'pc-1',
            code: 'COMPVIP'
        });
        createCompSubscriptionMock.mockResolvedValue({ localSubscriptionId: 'comp-annual-1' });
        const billing = makeBilling();

        const result = await initiatePaidAnnualSubscription({
            ...ANNUAL_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any
        });

        expect(result.appliedEffect).toBe('comp');
        expect(result.localSubscriptionId).toBe('comp-annual-1');
        expect(result.checkoutUrl).toBe(ANNUAL_URLS.successUrl);
        expect(billing.checkout.create).not.toHaveBeenCalled();
        expect(resolveCheckoutMpPlanIdMock).not.toHaveBeenCalled();
        const compArg = createCompSubscriptionMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(compArg.interval).toBe('annual');
    });

    it('discount → pendingDiscount snapshotted at full price (deferred to F2/F3), appliedEffect=discount', async () => {
        // HOS-191: annual discount is no longer mutated onto a live preapproval
        // at checkout time — it is snapshotted exactly like monthly (both routes
        // resolve/materialize identically now; only the cadence differs).
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'discount',
            promoCodeId: 'pc-1',
            code: 'ANNUAL20',
            effect: { kind: 'discount', valueKind: 'percentage', value: 20, durationCycles: 1 }
        });
        calculatePromoCodeEffectMock.mockReturnValue({
            type: 'apply-discount',
            discountAmount: 20000,
            finalAmount: 80000,
            remainingCycles: 0
        });
        const billing = makeBilling();

        const result = await initiatePaidAnnualSubscription({
            ...ANNUAL_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'ANNUAL20'
        });

        expect(result.appliedEffect).toBe('discount');
        expect(result.checkoutUrl).toBe(EXPECTED_SHARE_LINK);
        // Annual no longer calls the one-time `checkout.create` at all.
        expect(billing.checkout.create).not.toHaveBeenCalled();
        // The MP plan was resolved with billingInterval='annual' at full price
        // (annualPrice.unitAmount = 100000) and no trial (this plan does not
        // declare one), and the discount is snapshotted for the deferred apply.
        expect(mpPlanCallArg().billingInterval).toBe('annual');
        expect(mpPlanCallArg().trialDays).toBe(0);
        expect(pendingCallArg().pendingDiscount).toEqual({
            promoCodeId: 'pc-1',
            finalAmountCentavos: 80000
        });
        // resolveFullPlanPriceCentavos is a MONTHLY-only DB lookup — annual
        // (and the deferred discount path generally) uses annualPrice.unitAmount
        // directly, never touching it.
        expect(resolveFullPlanPriceCentavosMock).not.toHaveBeenCalled();
    });

    it('SPEC-262 L1: annual 100% discount (finalAmount=0) → INVALID_PROMO_CODE, no pending subscription materialized', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'discount',
            promoCodeId: 'pc-1',
            code: 'FREE100',
            effect: { kind: 'discount', valueKind: 'percentage', value: 100, durationCycles: 1 }
        });
        calculatePromoCodeEffectMock.mockReturnValue({
            type: 'apply-discount',
            discountAmount: 100000,
            finalAmount: 0,
            remainingCycles: 1
        });
        const billing = makeBilling();

        let thrown: unknown;
        try {
            await initiatePaidAnnualSubscription({
                ...ANNUAL_BASE,
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                promoCode: 'FREE100'
            });
        } catch (e) {
            thrown = e;
        }

        expect((thrown as SubscriptionCheckoutError).code).toBe('INVALID_PROMO_CODE');
        expect(createPendingProviderSubscriptionMock).not.toHaveBeenCalled();
    });

    it('SPEC-262 C1+H1: annual expired/restricted code → INVALID_PROMO_CODE', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'invalid',
            message: 'This promo code is not valid for the selected plan'
        });
        const billing = makeBilling();

        let thrown: unknown;
        try {
            await initiatePaidAnnualSubscription({
                ...ANNUAL_BASE,
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                promoCode: 'WRONGPLAN'
            });
        } catch (e) {
            thrown = e;
        }

        expect((thrown as SubscriptionCheckoutError).code).toBe('INVALID_PROMO_CODE');
        expect(createPendingProviderSubscriptionMock).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// HOS-115/HOS-171/HOS-191 — annual TRIAL-eligible checkout (mirrors monthly above)
// ---------------------------------------------------------------------------

describe('HOS-115/HOS-171/HOS-191: annual TRIAL-eligible checkout (mirrors monthly HOS-110 W1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createPendingProviderSubscriptionMock.mockResolvedValue({
            ...DEFAULT_PENDING_RESULT,
            localSubscriptionId: 'trial-sub-1'
        });
    });

    it('AC-1: a trial-eligible annual checkout resolves an MP plan carrying trialDays=14, billingInterval=annual', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'none' });
        const billing = makeTrialBilling();

        const result = await initiatePaidAnnualSubscription({
            ...ANNUAL_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any
        });

        expect(result.appliedEffect).toBeUndefined();
        expect(result.trialGranted).toBe(true);
        expect(result.localSubscriptionId).toBe('trial-sub-1');
        // A REAL MP hosted share-link URL — not the comp in-app success sentinel.
        expect(result.checkoutUrl).toBe(EXPECTED_SHARE_LINK);
        expect(mpPlanCallArg().billingInterval).toBe('annual');
        expect(mpPlanCallArg().trialDays).toBe(14);
        expect(pendingCallArg().trialGranted).toBe(true);
    });

    it('AC-2: a not-eligible customer (existing subscription) skips the trial — the MP plan resolves with trialDays=0', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'none' });
        const billing = makeTrialBilling({
            existingSubscriptions: [{ id: 'existing-sub', status: 'active' }]
        });

        const result = await initiatePaidAnnualSubscription({
            ...ANNUAL_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any
        });

        expect(result.appliedEffect).toBeUndefined();
        expect(billing.subscriptions.getByCustomerId).toHaveBeenCalledOnce();
        expect(mpPlanCallArg().billingInterval).toBe('annual');
        expect(mpPlanCallArg().trialDays).toBe(0);
    });

    it('AC-7/AC-10: cross-interval eligibility — a customer who already consumed a trial (any interval, any status) is not granted a second one', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'none' });
        // The customer's only subscription is an EXPIRED monthly trial — an
        // authorized subscription that ran its course. The eligibility gate is
        // cross-interval, so this disqualifies an annual trial too (one trial
        // per customer, for life). Post-HOS-230 the gate DOES distinguish never-
        // authorized backouts, but an expired trial is unambiguously authorized.
        const billing = makeTrialBilling({
            existingSubscriptions: [{ id: 'expired-monthly-trial', status: 'expired' }]
        });

        const result = await initiatePaidAnnualSubscription({
            ...ANNUAL_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any
        });

        expect(result.appliedEffect).toBeUndefined();
        expect(mpPlanCallArg().trialDays).toBe(0);
        expect(createPendingProviderSubscriptionMock).toHaveBeenCalledOnce();
    });

    it('comp wins over trial on the annual entry — the MP plan is never resolved', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'comp',
            promoCodeId: 'pc-1',
            code: 'COMPVIP'
        });
        createCompSubscriptionMock.mockResolvedValue({
            localSubscriptionId: 'comp-annual-trial-1'
        });
        const billing = makeTrialBilling();

        const result = await initiatePaidAnnualSubscription({
            ...ANNUAL_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'COMPVIP'
        });

        expect(result.appliedEffect).toBe('comp');
        expect(result.localSubscriptionId).toBe('comp-annual-trial-1');
        const compArg = createCompSubscriptionMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(compArg.interval).toBe('annual');
        // The eligibility check and the MP plan resolution never ran.
        expect(billing.subscriptions.getByCustomerId).not.toHaveBeenCalled();
        expect(resolveCheckoutMpPlanIdMock).not.toHaveBeenCalled();
    });

    it('trial_extension lengthens the annual trial by the code freeTrialDays', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'trial', freeTrialDays: 10 });
        const billing = makeTrialBilling();

        const result = await initiatePaidAnnualSubscription({
            ...ANNUAL_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'EXTEND10'
        });

        expect(result.appliedEffect).toBeUndefined();
        expect(result.promoCodeIgnored).toBeUndefined();
        // 14 base (TRIAL_PLAN) + 10 extension = 24.
        expect(mpPlanCallArg().billingInterval).toBe('annual');
        expect(mpPlanCallArg().trialDays).toBe(24);
    });

    it('discount applies ALONGSIDE the annual trial, exactly like monthly (HOS-171)', async () => {
        // Arrange
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'discount',
            promoCodeId: 'pc-1',
            code: 'LANZA50',
            effect: { kind: 'discount', valueKind: 'percentage', value: 50, durationCycles: 3 }
        });
        calculatePromoCodeEffectMock.mockReturnValue({
            type: 'apply-discount',
            discountAmount: 17_500_000,
            finalAmount: 17_500_000,
            remainingCycles: 3
        });
        const billing = makeTrialBilling();

        // Act
        const result = await initiatePaidAnnualSubscription({
            ...ANNUAL_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'LANZA50'
        });

        // Assert — annual has no promo behavior of its own any more
        expect(result.promoCodeIgnored).toBeUndefined();
        expect(result.appliedEffect).toBe('discount');
        expect(mpPlanCallArg().billingInterval).toBe('annual');
        expect(mpPlanCallArg().trialDays).toBe(14);
        // Snapshotted for the deferred F2/F3 apply — the hosted checkout is
        // never touched synchronously.
        expect(pendingCallArg().pendingDiscount).toEqual({
            promoCodeId: 'pc-1',
            finalAmountCentavos: 17_500_000
        });
        expect(billing.checkout.create).not.toHaveBeenCalled();
    });
});
