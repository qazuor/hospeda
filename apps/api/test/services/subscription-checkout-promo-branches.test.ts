/**
 * SPEC-262 T-012 P2 — subscription-checkout discount/comp branch routing tests.
 *
 * Exercises the NEW promo branches wired into initiatePaidMonthlySubscription /
 * initiatePaidAnnualSubscription, with the promo resolver + comp creator +
 * discount-signup seam mocked (so this stays a focused branch-routing test, not
 * an MP/DB integration test).
 *
 * Critical coverage (CI guardrail):
 *  - FAIL-CLOSED: when the monthly discount mutation fails, the just-created
 *    subscription is CANCELLED, NO checkoutUrl is returned, and the route-level
 *    error code is DISCOUNT_APPLY_FAILED.
 *  - comp (monthly + annual) → createCompSubscription, appliedEffect='comp', no MP.
 *  - discount happy path (monthly) → appliedEffect='discount', checkoutUrl present.
 *  - discount (annual) → reduced line-item, appliedEffect='discount'.
 *  - SPEC-262 C1+H1: expired/restricted codes → INVALID_PROMO_CODE (resolver returns invalid).
 *  - SPEC-262 C2: capped annual discount code → INVALID_PROMO_CODE (redemption fails before URL).
 *  - SPEC-262 L1: 100% discount → INVALID_PROMO_CODE (0-amount rejected before preapproval).
 *
 * @module test/services/subscription-checkout-promo-branches
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
// withServiceTransaction, etc.) intact via importActual — subscription-checkout.service.ts
// now transitively imports TrialService (./trial.service.js), which imports
// clearEntitlementCache from '../middlewares/entitlement', which constructs a
// module-level `new PlanService()` from `@repo/service-core` at import time. A
// fully-replaced mock (no importActual) leaves PlanService undefined and breaks
// that construction for every test in this file, not just the new trial ones.
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
// pulled in transitively via TrialService needs real @repo/db exports too.
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
    SubscriptionCheckoutError
} from '../../src/services/subscription-checkout.service';

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

// --- HOS-110 W1 fixtures: a plan that declares a trial ---------------------

/** Same slug as PLAN/MONTHLY_BASE.planSlug, but declares a 14-day trial. */
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
        }
    ]
};

/**
 * Billing stub for the HOS-110 W1 trial-vs-promo branch tests. Extends
 * `makeBilling`'s shape with the two extra calls the TRIAL branch (and the
 * real `TrialService` it constructs) needs: `subscriptions.getByCustomerId`
 * (trial-eligibility check) and `subscriptions.get` (post-create trialEnd
 * lookup). `plans.list()` resolves {@link TRIAL_PLAN} so both
 * `resolvePlanBySlug` and `TrialService.startTrial`'s own internal plan
 * lookup agree on the same trial-declaring plan.
 */
function makeTrialBilling(
    opts: {
        existingSubscriptions?: readonly unknown[];
        trialSubscription?: Record<string, unknown> | null;
        createdTrialId?: string;
    } = {}
) {
    const createdTrialId = opts.createdTrialId ?? 'trial-sub-1';
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
            create: vi.fn().mockResolvedValue({ id: createdTrialId }),
            cancel: vi.fn().mockResolvedValue(undefined),
            getByCustomerId: vi.fn().mockResolvedValue(opts.existingSubscriptions ?? []),
            get: vi
                .fn()
                .mockResolvedValue(
                    opts.trialSubscription === undefined
                        ? { id: createdTrialId, trialEnd: null }
                        : opts.trialSubscription
                )
        },
        checkout: { create: vi.fn() },
        getStorage: vi.fn(() => ({}))
    };
}

describe('HOS-110 W1: promo effect_kind reordered BEFORE the trial branch', () => {
    beforeEach(() => vi.clearAllMocks());

    it('comp wins over trial: comp branch resolves first, trial is never attempted', async () => {
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
        // The trial branch never ran: no eligibility check, no trial create.
        expect(billing.subscriptions.getByCustomerId).not.toHaveBeenCalled();
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('trial_extension: the granted trial length is base + the code freeTrialDays', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'trial', freeTrialDays: 7 });
        const billing = makeTrialBilling({
            trialSubscription: { id: 'trial-sub-1', trialEnd: null }
        });

        const before = Date.now();
        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'EXTEND7'
        });
        const after = Date.now();

        expect(result.appliedEffect).toBe('trial');
        expect(result.promoCodeIgnored).toBeUndefined();
        // TrialService.startTrial receives the combined length: 14 base + 7 extension.
        expect(billing.subscriptions.create).toHaveBeenCalledWith(
            expect.objectContaining({ trialDays: 21 })
        );
        const expiresAtMs = new Date(result.expiresAt).getTime();
        expect(expiresAtMs).toBeGreaterThanOrEqual(before + 21 * 24 * 60 * 60 * 1000 - 5000);
        expect(expiresAtMs).toBeLessThanOrEqual(after + 21 * 24 * 60 * 60 * 1000 + 5000);
    });

    it('discount: the trial wins outright and the discount is discarded (promoCodeIgnored=true)', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'discount',
            promoCodeId: 'pc-1',
            code: 'LANZA50',
            effect: { kind: 'discount', valueKind: 'percentage', value: 50, durationCycles: 3 }
        });
        const billing = makeTrialBilling({
            trialSubscription: { id: 'trial-sub-1', trialEnd: '2027-01-01T00:00:00.000Z' }
        });

        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'LANZA50'
        });

        expect(result.appliedEffect).toBe('trial');
        expect(result.promoCodeIgnored).toBe(true);
        expect(result.expiresAt).toBe('2027-01-01T00:00:00.000Z');
        // No extension — the trial is granted at its base length, unchanged.
        expect(billing.subscriptions.create).toHaveBeenCalledWith(
            expect.objectContaining({ trialDays: 14 })
        );
        // The discount machinery is never invoked — the code was discarded,
        // not persisted anywhere (no post-trial discount, per owner decision).
        expect(applySignupDiscountToMonthlyMock).not.toHaveBeenCalled();
        expect(calculatePromoCodeEffectMock).not.toHaveBeenCalled();
        expect(resolveFullPlanPriceCentavosMock).not.toHaveBeenCalled();
    });

    it('none: no promo code supplied → unchanged trial, no promoCodeIgnored flag', async () => {
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'none' });
        const billing = makeTrialBilling({
            trialSubscription: { id: 'trial-sub-1', trialEnd: '2027-02-01T00:00:00.000Z' }
        });

        const result = await initiatePaidMonthlySubscription({
            ...MONTHLY_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any
        });

        expect(result.appliedEffect).toBe('trial');
        expect(result.promoCodeIgnored).toBeUndefined();
        expect(billing.subscriptions.create).toHaveBeenCalledWith(
            expect.objectContaining({ trialDays: 14 })
        );
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
        // Neither the comp/trial branches nor the paid path ever ran.
        expect(billing.subscriptions.getByCustomerId).not.toHaveBeenCalled();
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
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

    it('FAIL-CLOSED: no mp preapproval id → sub cancelled, MISSING_INIT_POINT', async () => {
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
        expect((thrown as SubscriptionCheckoutError).code).toBe('MISSING_INIT_POINT');
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

describe('annual comp + discount branches', () => {
    beforeEach(() => vi.clearAllMocks());

    it('comp → createCompSubscription(interval=annual), appliedEffect=comp, no checkout', async () => {
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
        const compArg = createCompSubscriptionMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(compArg.interval).toBe('annual');
    });

    it('discount → reduced line-item amount, appliedEffect=discount', async () => {
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
        // SPEC-262 C2: redemption succeeds (gating the discounted URL)
        redeemAndRecordUsageMock.mockResolvedValue({ success: true, data: {} });
        dbInsertValuesMock.mockResolvedValue(undefined);
        dbExecuteMock.mockResolvedValue({ rows: [] });
        const billing = makeBilling();

        const result = await initiatePaidAnnualSubscription({
            ...ANNUAL_BASE,
            // biome-ignore lint/suspicious/noExplicitAny: test billing stub
            billing: billing as any,
            promoCode: 'ANNUAL20'
        });

        expect(result.appliedEffect).toBe('discount');
        // Line item charged the discounted amount (80000), not the full 100000.
        const checkoutArg = billing.checkout.create.mock.calls[0]?.[0] as {
            lineItems: { unitAmount: number }[];
        };
        expect(checkoutArg.lineItems[0]?.unitAmount).toBe(80000);
        // Redemption MUST have been called before the checkout URL was returned (C2).
        expect(redeemAndRecordUsageMock).toHaveBeenCalledBefore(billing.checkout.create);
    });

    it('SPEC-262 C2: capped annual discount → redemption fails → INVALID_PROMO_CODE, no checkoutUrl', async () => {
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
        // Redemption fails (cap exhausted race)
        redeemAndRecordUsageMock.mockResolvedValue({
            success: false,
            error: { code: 'PROMO_CODE_MAX_USES', message: 'Code has reached max uses' }
        });
        const billing = makeBilling();

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

        expect((thrown as SubscriptionCheckoutError).code).toBe('INVALID_PROMO_CODE');
        // No checkout was provisioned — no URL returned.
        expect(billing.checkout.create).not.toHaveBeenCalled();
    });

    it('SPEC-262 L1: annual 100% discount (finalAmount=0) → INVALID_PROMO_CODE', async () => {
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
        expect(billing.checkout.create).not.toHaveBeenCalled();
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
        expect(billing.checkout.create).not.toHaveBeenCalled();
    });
});
