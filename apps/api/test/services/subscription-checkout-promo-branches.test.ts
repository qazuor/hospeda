/**
 * SPEC-262 T-012 P2 / HOS-171 — subscription-checkout discount/comp/trial
 * branch routing tests.
 *
 * Exercises the promo branches wired into initiatePaidMonthlySubscription /
 * initiatePaidAnnualSubscription, with the promo resolver + comp creator +
 * discount-signup seam mocked (so this stays a focused branch-routing test,
 * not an MP/DB integration test).
 *
 * HOS-171 (card-first) removed the separate no-card trial branch. A trial is
 * now just an ordinary `mode: 'paid'` preapproval that carries
 * `freeTrialDays` (mapped by qzpay to `auto_recurring.free_trial`) — the
 * SAME `createPaidSubscription` call every checkout makes, trial or not.
 * `CheckoutAppliedEffect` no longer has a `'trial'` variant: a granted trial
 * produces no `appliedEffect` marker at all. Precedence is enforced
 * explicitly via a `trialGranted` boolean (there is no more early `return`
 * to fall out of): `comp` wins outright -> `trial_extension` lengthens the
 * trial -> `discount` YIELDS to a trial and is DISCARDED, never sent to MP,
 * flagged via `promoCodeIgnored: true`.
 *
 * Critical coverage (CI guardrail):
 *  - FAIL-CLOSED: when the monthly discount mutation fails, the just-created
 *    subscription is CANCELLED, NO checkoutUrl is returned, and the route-level
 *    error code is DISCOUNT_APPLY_FAILED.
 *  - comp (monthly + annual) → createCompSubscription, appliedEffect='comp', no MP.
 *  - discount happy path (monthly) → appliedEffect='discount', checkoutUrl present.
 *  - discount (annual) → preapproval created at full price then mutated down via
 *    `applySignupDiscountToMonthly` (the SAME mechanism as monthly — HOS-171 §7.2
 *    made annual a preapproval too, so there is no more one-time line item).
 *  - AC-8: a 60-day `trial_extension` on a 14-day plan sends exactly ONE
 *    `freeTrialDays: 74` to the preapproval create call.
 *  - AC-9: `HOSPEDA_TRIAL_DAYS_OVERRIDE=0` suppresses the trial even with an
 *    extension promo (the kill-switch is evaluated against the BASE length).
 *  - AC-10: any prior subscription (any status) -> no trial, normal paid preapproval.
 *  - A `discount` code alongside a granted trial is DISCARDED and never
 *    reaches `applySignupDiscountToMonthly`/`calculatePromoCodeEffect`/MP.
 *  - SPEC-262 C1+H1: expired/restricted codes → INVALID_PROMO_CODE (resolver returns invalid).
 *  - SPEC-262 L1: 100% discount → INVALID_PROMO_CODE (0-amount rejected before preapproval).
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

const applySignupDiscountToMonthlyMock = vi.fn();
vi.mock('../../src/services/subscription-discount-signup.service', () => ({
    applySignupDiscountToMonthly: (...args: unknown[]) => applySignupDiscountToMonthlyMock(...args)
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
    PENDING_PROVIDER_TTL_MS,
    SubscriptionCheckoutError
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

function makeBilling(
    opts: {
        subscription?: Record<string, unknown>;
        cancel?: ReturnType<typeof vi.fn>;
        checkout?: Record<string, unknown>;
    } = {}
) {
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
            create: vi.fn().mockResolvedValue(
                opts.subscription ?? {
                    id: 'sub-1',
                    providerInitPoint: 'https://mp.test/checkout/abc',
                    providerSubscriptionIds: { mercadopago: 'mp-1' },
                    livemode: false
                }
            ),
            cancel: opts.cancel ?? vi.fn().mockResolvedValue(undefined)
        },
        checkout: {
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
 * {@link TRIAL_PLAN}. `subscriptions.create` ALWAYS returns a full
 * preapproval shape (id + providerInitPoint + providerSubscriptionIds) —
 * card-first means there is no longer a separate MP-less trial object, so
 * the create call must resolve exactly like any other paid checkout whether
 * or not it ends up carrying `freeTrialDays`.
 */
function makeTrialBilling(
    opts: {
        existingSubscriptions?: readonly unknown[];
        createdSubscriptionId?: string;
        checkoutUrl?: string;
    } = {}
) {
    const createdSubscriptionId = opts.createdSubscriptionId ?? 'trial-sub-1';
    const checkoutUrl = opts.checkoutUrl ?? 'https://mp.test/checkout/trial';
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
            create: vi.fn().mockResolvedValue({
                id: createdSubscriptionId,
                providerInitPoint: checkoutUrl,
                providerSubscriptionIds: { mercadopago: `mp-${createdSubscriptionId}` },
                livemode: false
            }),
            cancel: vi.fn().mockResolvedValue(undefined),
            getByCustomerId: vi.fn().mockResolvedValue(opts.existingSubscriptions ?? [])
        },
        checkout: { create: vi.fn() },
        getStorage: vi.fn(() => ({}))
    };
}

/** Extracts the object `billing.subscriptions.create` was called with. */
function createCallArg(
    billing: ReturnType<typeof makeTrialBilling> | ReturnType<typeof makeBilling>
): Record<string, unknown> {
    const mockFn = billing.subscriptions.create as unknown as { mock: { calls: unknown[][] } };
    return (mockFn.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
}

describe('HOS-110 W1 / HOS-171: promo effect_kind precedence before the preapproval is created (monthly)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('comp wins over a trial: comp branch resolves first, the preapproval is never attempted', async () => {
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
        // Neither the eligibility check nor the preapproval create ever ran.
        expect(billing.subscriptions.getByCustomerId).not.toHaveBeenCalled();
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('AC-8: trial_extension sums with the plan base into ONE 74-day free_trial (the leak closes)', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'trial', freeTrialDays: 60 });
        const billing = makeTrialBilling();

        const before = Date.now();
        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'EXTEND60'
        });
        const after = Date.now();

        // No 'trial' marker — card-first removed that CheckoutAppliedEffect
        // variant. The trial is invisible in the response shape.
        expect(result.appliedEffect).toBeUndefined();
        expect(result.promoCodeIgnored).toBeUndefined();
        // Exactly ONE preapproval create call, carrying 74 days (14 base + 60
        // extension) as `freeTrialDays` — not 14 now and 60 again later.
        const createArg = createCallArg(billing);
        expect(createArg.freeTrialDays).toBe(74);
        expect(createArg.trialDays).toBeUndefined();
        // expiresAt is the generic pending-provider TTL now (30 min), NOT the
        // trial length — a trial checkout is an ordinary preapproval redirect
        // with the same abandonment window as any other paid checkout.
        const expiresAtMs = new Date(result.expiresAt).getTime();
        expect(expiresAtMs).toBeGreaterThanOrEqual(before + PENDING_PROVIDER_TTL_MS - 5000);
        expect(expiresAtMs).toBeLessThanOrEqual(after + PENDING_PROVIDER_TTL_MS + 5000);
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
        applySignupDiscountToMonthlyMock.mockResolvedValue({ success: true, data: {} });
        const billing = makeTrialBilling();

        // Act
        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'LANZA50'
        });

        // Assert — the trial defers the first charge; the discount lowers what
        // that charge will be. They are no longer mutually exclusive: a no-card
        // trial had no preapproval to discount, a card-first one IS the
        // preapproval (verified by the HOS-171 production spike).
        expect(result.promoCodeIgnored).toBeUndefined();
        expect(result.appliedEffect).toBe('discount');
        // The trial is untouched, at its base length.
        expect(createCallArg(billing).freeTrialDays).toBe(14);
        // And the discount really was applied to the live preapproval.
        expect(applySignupDiscountToMonthlyMock).toHaveBeenCalledOnce();
        expect(billing.subscriptions.create).toHaveBeenCalledOnce();
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
        expect(createCallArg(billing).freeTrialDays).toBe(14);
    });

    it('AC-10: a customer with any prior subscription gets no trial and pays immediately', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'none' });
        const billing = makeTrialBilling({
            existingSubscriptions: [{ id: 'existing-sub', status: 'cancelled' }]
        });

        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any
        });

        expect(result.appliedEffect).toBeUndefined();
        expect(billing.subscriptions.getByCustomerId).toHaveBeenCalledOnce();
        expect(createCallArg(billing).freeTrialDays).toBeUndefined();
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
        // Neither the eligibility check nor the preapproval create ever ran.
        expect(billing.subscriptions.getByCustomerId).not.toHaveBeenCalled();
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });
});

describe('HOS-171 §7.4 AC-9: the ops kill-switch beats an extension promo', () => {
    let originalOverride: typeof env.HOSPEDA_TRIAL_DAYS_OVERRIDE;

    beforeEach(() => {
        vi.clearAllMocks();
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
        // customer pays immediately on a full-price, no-trial preapproval.
        expect(result.appliedEffect).toBeUndefined();
        expect(result.promoCodeIgnored).toBe(true);
        expect(createCallArg(billing).freeTrialDays).toBeUndefined();
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
        const createArg = createCallArg(billing);
        expect(createArg.billingInterval).toBe('annual');
        expect(createArg.freeTrialDays).toBeUndefined();
    });
});

describe('monthly comp branch', () => {
    beforeEach(() => vi.clearAllMocks());

    it('routes comp → createCompSubscription, appliedEffect=comp, no MP create', async () => {
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
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
        expect(createCompSubscriptionMock).toHaveBeenCalledOnce();
    });
});

describe('monthly discount branch — FAIL-CLOSED', () => {
    beforeEach(() => vi.clearAllMocks());

    it('discount happy path → appliedEffect=discount, checkoutUrl present', async () => {
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
        resolveFullPlanPriceCentavosMock.mockResolvedValue(10000);
        applySignupDiscountToMonthlyMock.mockResolvedValue({
            success: true,
            data: { discountedAmountCentavos: 5000, remainingCyclesSeed: 3 }
        });
        const billing = makeBilling();

        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'LANZA50'
        });

        expect(result.appliedEffect).toBe('discount');
        expect(result.checkoutUrl).toBe('https://mp.test/checkout/abc');
        expect(billing.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('FAIL-CLOSED: MP discount mutation fails → sub CANCELLED, no checkoutUrl, DISCOUNT_APPLY_FAILED', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'discount',
            promoCodeId: 'pc-1',
            code: 'LANZA50',
            effect: { kind: 'discount', valueKind: 'percentage', value: 50, durationCycles: 3 }
        });
        // L1: non-zero amount (50%)
        calculatePromoCodeEffectMock.mockReturnValue({
            type: 'apply-discount',
            discountAmount: 5000,
            finalAmount: 5000,
            remainingCycles: 3
        });
        resolveFullPlanPriceCentavosMock.mockResolvedValue(10000);
        applySignupDiscountToMonthlyMock.mockResolvedValue({
            success: false,
            error: { code: 'MP_DISCOUNT_APPLY_FAILED', message: 'rejected' }
        });
        const cancel = vi.fn().mockResolvedValue(undefined);
        const billing = makeBilling({ cancel });

        // Act + Assert: throws DISCOUNT_APPLY_FAILED, never returns a checkoutUrl.
        let thrown: unknown;
        try {
            await initiatePaidMonthlySubscription({
                ...MONTHLY_BASE,
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                promoCode: 'LANZA50'
            });
        } catch (e) {
            thrown = e;
        }

        expect(thrown).toBeInstanceOf(SubscriptionCheckoutError);
        expect((thrown as SubscriptionCheckoutError).code).toBe('DISCOUNT_APPLY_FAILED');
        // The just-created subscription MUST be cancelled (fail-closed).
        expect(cancel).toHaveBeenCalledWith('sub-1');
    });

    // HOS-151 Bug C: the shared `createPaidSubscription` helper now rejects a
    // provider response with no subscription id BEFORE the discount branch runs,
    // throwing the more specific `MISSING_PROVIDER_SUBSCRIPTION_ID` (was the
    // overloaded `MISSING_INIT_POINT` the discount branch previously used). The
    // just-created row is still cancelled fail-closed and the discount is never
    // applied.
    it('FAIL-CLOSED: no mp preapproval id → sub cancelled, MISSING_PROVIDER_SUBSCRIPTION_ID', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'discount',
            promoCodeId: 'pc-1',
            code: 'LANZA50',
            effect: { kind: 'discount', valueKind: 'percentage', value: 50, durationCycles: 3 }
        });
        // L1: non-zero amount
        calculatePromoCodeEffectMock.mockReturnValue({
            type: 'apply-discount',
            discountAmount: 5000,
            finalAmount: 5000,
            remainingCycles: 3
        });
        const cancel = vi.fn().mockResolvedValue(undefined);
        // Subscription comes back WITHOUT a mercadopago preapproval id.
        const billing = makeBilling({
            cancel,
            subscription: {
                id: 'sub-1',
                providerInitPoint: 'https://mp.test/checkout/abc',
                providerSubscriptionIds: {},
                livemode: false
            }
        });

        let thrown: unknown;
        try {
            await initiatePaidMonthlySubscription({
                ...MONTHLY_BASE,
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                promoCode: 'LANZA50'
            });
        } catch (e) {
            thrown = e;
        }
        expect((thrown as SubscriptionCheckoutError).code).toBe('MISSING_PROVIDER_SUBSCRIPTION_ID');
        expect(cancel).toHaveBeenCalledWith('sub-1');
        expect(applySignupDiscountToMonthlyMock).not.toHaveBeenCalled();
    });

    it('SPEC-262 L1: 100% discount (finalAmount=0) → INVALID_PROMO_CODE, no MP create', async () => {
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
        // No MP create attempted — rejected before preapproval.
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
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
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });
});

describe('annual comp + discount branches (HOS-171 §7.2: annual is a preapproval too)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('comp → createCompSubscription(interval=annual), appliedEffect=comp, no preapproval', async () => {
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
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
        const compArg = createCompSubscriptionMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(compArg.interval).toBe('annual');
    });

    it('discount → preapproval created at FULL price then mutated down via applySignupDiscountToMonthly, appliedEffect=discount', async () => {
        // HOS-171: annual discount is no longer a one-time discounted line
        // item — it is the SAME preapproval-then-mutate mechanism as monthly
        // (§7.2), because annual is now a recurring preapproval too.
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
        applySignupDiscountToMonthlyMock.mockResolvedValue({
            success: true,
            data: { discountedAmountCentavos: 80000, remainingCyclesSeed: 0 }
        });
        const billing = makeBilling();

        const result = await initiatePaidAnnualSubscription({
            ...ANNUAL_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'ANNUAL20'
        });

        expect(result.appliedEffect).toBe('discount');
        expect(result.checkoutUrl).toBe('https://mp.test/checkout/abc');
        // Annual no longer calls the one-time `checkout.create` at all.
        expect(billing.checkout.create).not.toHaveBeenCalled();
        // The preapproval was created with billingInterval='annual' at full
        // price (annualPrice.unitAmount = 100000) and no freeTrialDays (this
        // plan does not declare a trial), then applySignupDiscountToMonthly
        // (price-agnostic despite the name — it takes fullPriceCentavos)
        // mutates it down to 80000.
        const createArg = createCallArg(billing);
        expect(createArg.billingInterval).toBe('annual');
        expect(createArg.freeTrialDays).toBeUndefined();
        expect(applySignupDiscountToMonthlyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                mpSubscriptionId: 'mp-1',
                subscriptionId: 'sub-1',
                fullPriceCentavos: 100000
            })
        );
        // resolveFullPlanPriceCentavos is a MONTHLY-only DB lookup — annual
        // uses annualPrice.unitAmount directly, never touching it.
        expect(resolveFullPlanPriceCentavosMock).not.toHaveBeenCalled();
    });

    it('FAIL-CLOSED: annual discount mutation fails → sub CANCELLED, no checkoutUrl, DISCOUNT_APPLY_FAILED', async () => {
        // HOS-171: the OLD "SPEC-262 C2 capped annual discount" scenario
        // (redemption failing INSIDE a pre-charge check) no longer exists —
        // annual creates the preapproval FIRST, exactly like monthly, so ANY
        // failure inside applySignupDiscountToMonthly (a max-uses race
        // included) surfaces as the SAME fail-closed DISCOUNT_APPLY_FAILED
        // contract as monthly, not a pre-creation INVALID_PROMO_CODE.
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'discount',
            promoCodeId: 'pc-1',
            code: 'MAXONE',
            effect: { kind: 'discount', valueKind: 'percentage', value: 20, durationCycles: 1 }
        });
        calculatePromoCodeEffectMock.mockReturnValue({
            type: 'apply-discount',
            discountAmount: 20000,
            finalAmount: 80000,
            remainingCycles: 0
        });
        applySignupDiscountToMonthlyMock.mockResolvedValue({
            success: false,
            error: { code: 'PROMO_CODE_MAX_USES', message: 'Code has reached max uses' }
        });
        const cancel = vi.fn().mockResolvedValue(undefined);
        const billing = makeBilling({ cancel });

        let thrown: unknown;
        try {
            await initiatePaidAnnualSubscription({
                ...ANNUAL_BASE,
                // biome-ignore lint/suspicious/noExplicitAny: test billing stub
                billing: billing as any,
                promoCode: 'MAXONE'
            });
        } catch (e) {
            thrown = e;
        }

        expect((thrown as SubscriptionCheckoutError).code).toBe('DISCOUNT_APPLY_FAILED');
        // The just-created preapproval MUST be cancelled (fail-closed) — no
        // checkoutUrl was ever returned to the caller.
        expect(cancel).toHaveBeenCalledWith('sub-1');
    });

    it('SPEC-262 L1: annual 100% discount (finalAmount=0) → INVALID_PROMO_CODE, no preapproval created', async () => {
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
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
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
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// HOS-115/HOS-171 — annual TRIAL-eligible checkout (mirrors monthly above)
// ---------------------------------------------------------------------------

describe('HOS-115/HOS-171: annual TRIAL-eligible checkout (mirrors monthly HOS-110 W1)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('AC-1: a trial-eligible annual checkout is a real preapproval carrying freeTrialDays, billingInterval=annual', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'none' });
        const billing = makeTrialBilling();

        const result = await initiatePaidAnnualSubscription({
            ...ANNUAL_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any
        });

        expect(result.appliedEffect).toBeUndefined();
        expect(result.localSubscriptionId).toBe('trial-sub-1');
        // A REAL MP checkoutUrl — not the comp in-app success sentinel.
        expect(result.checkoutUrl).toBe('https://mp.test/checkout/trial');
        const createArg = createCallArg(billing);
        expect(createArg.billingInterval).toBe('annual');
        expect(createArg.freeTrialDays).toBe(14);
    });

    it('AC-2: a not-eligible customer (existing subscription) skips the trial — the preapproval carries no freeTrialDays', async () => {
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
        const createArg = createCallArg(billing);
        expect(createArg.billingInterval).toBe('annual');
        expect(createArg.freeTrialDays).toBeUndefined();
    });

    it('AC-7/AC-10: cross-interval eligibility — a customer who already consumed a trial (any interval, any status) is not granted a second one', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'none' });
        // The customer's only subscription is a CANCELED trial — the
        // eligibility gate does not distinguish status or interval, so this
        // still disqualifies (one trial per customer, for life).
        const billing = makeTrialBilling({
            existingSubscriptions: [{ id: 'expired-monthly-trial', status: 'canceled' }]
        });

        const result = await initiatePaidAnnualSubscription({
            ...ANNUAL_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any
        });

        expect(result.appliedEffect).toBeUndefined();
        expect(createCallArg(billing).freeTrialDays).toBeUndefined();
        expect(billing.subscriptions.create).toHaveBeenCalledOnce();
    });

    it('comp wins over trial on the annual entry — the preapproval is never attempted', async () => {
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
        // The eligibility check and the preapproval create never ran.
        expect(billing.subscriptions.getByCustomerId).not.toHaveBeenCalled();
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
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
        const createArg = createCallArg(billing);
        expect(createArg.billingInterval).toBe('annual');
        expect(createArg.freeTrialDays).toBe(24);
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
        applySignupDiscountToMonthlyMock.mockResolvedValue({ success: true, data: {} });
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
        const createArg = createCallArg(billing);
        expect(createArg.billingInterval).toBe('annual');
        expect(createArg.freeTrialDays).toBe(14);
        // Mutated down on the live preapproval, not baked into a one-time line
        // item — the hosted checkout is never touched.
        expect(applySignupDiscountToMonthlyMock).toHaveBeenCalledOnce();
        expect(billing.checkout.create).not.toHaveBeenCalled();
    });
});
