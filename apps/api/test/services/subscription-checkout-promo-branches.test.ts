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
vi.mock('@repo/service-core', () => ({
    resolveFullPlanPriceCentavos: (...args: unknown[]) => resolveFullPlanPriceCentavosMock(...args),
    calculatePromoCodeEffect: (...args: unknown[]) => calculatePromoCodeEffectMock(...args),
    redeemAndRecordUsage: (...args: unknown[]) => redeemAndRecordUsageMock(...args)
}));

const dbExecuteMock = vi.fn();
const dbInsertValuesMock = vi.fn();
vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        execute: dbExecuteMock,
        insert: vi.fn(() => ({ values: dbInsertValuesMock }))
    })),
    billingSubscriptions: { __table: 'billing_subscriptions' },
    commerceListingSubscriptions: { __table: 'commerce_listing_subscriptions' },
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    withTransaction: vi.fn()
}));

vi.mock('@repo/schemas', () => ({
    ProductDomainEnum: { ACCOMMODATION: 'accommodation', COMMERCE: 'commerce' }
}));

vi.mock('../../src/utils/env', () => ({ env: { HOSPEDA_BILLING_POLLING_ENABLED: false } }));
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import {
    SubscriptionCheckoutError,
    initiatePaidAnnualSubscription,
    initiatePaidMonthlySubscription
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
