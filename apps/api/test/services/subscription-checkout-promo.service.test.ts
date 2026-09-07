/**
 * SPEC-262 T-012 P2 — subscription-checkout-promo.service resolver tests.
 *
 * Proves the checkout promo resolver classifies a code into none/trial/discount/
 * comp/invalid WITHOUT throwing (so the checkout service has no import cycle).
 *
 * SPEC-262 C1+H1: the resolver now routes through the FULL validatePromoCode
 * (active + expiresAt + maxUses + maxPerCustomer + validPlans + newCustomersOnly
 * + minAmount) when userId is supplied. Tests prove that invalid validation
 * results are mapped to `{kind:'invalid'}`.
 *
 * @module test/services/subscription-checkout-promo.service
 */

import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const validatePromoCodeMock = vi.fn();
// Reassigned per-test before invoking the resolver; read lazily by the mocked
// PromoCodeService.getByCode (see the vi.mock factory below).
let promoServiceGetByCodeMock: Mock;

vi.mock('@repo/service-core', async () => {
    return {
        validatePromoCode: (...args: unknown[]) => validatePromoCodeMock(...args),
        // classifyValidatedCode does a dynamic import of PromoCodeService.
        // `getByCode` reads `promoServiceGetByCodeMock` LAZILY at instantiation
        // (each test assigns it before invoking the resolver) — never eagerly
        // inside this hoisted factory, which would hit the TDZ of the top-level
        // `let` (it initializes after this factory runs).
        PromoCodeService: class {
            getByCode = (...args: unknown[]) => (promoServiceGetByCodeMock ?? vi.fn())(...args);
        }
    };
});

const resolveFreeTrialExtensionPromoMock = vi.fn();
vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    resolveFreeTrialExtensionPromo: (...args: unknown[]) =>
        resolveFreeTrialExtensionPromoMock(...args)
}));

// HOS-702: PARTIAL. This suite now loads the REAL @repo/billing, whose config
// barrel reads ProductDomainEnum from @repo/schemas — a whole-module literal
// here made that import undefined and aborted the file.
vi.mock('@repo/schemas', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/schemas')>()),
    PromoEffectKindEnum: { DISCOUNT: 'discount', TRIAL_EXTENSION: 'trial_extension', COMP: 'comp' }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import { resolveCheckoutPromoPlan } from '../../src/services/subscription-checkout-promo.service';

describe('resolveCheckoutPromoPlan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: validatePromoCode returns valid (passes through to classifyValidatedCode)
        validatePromoCodeMock.mockResolvedValue({ valid: true });
        // Default: DB getByCode returns not found (falls back to config)
        promoServiceGetByCodeMock = vi
            .fn()
            .mockResolvedValue({ success: false, error: { code: 'NOT_FOUND', message: 'x' } });
    });

    it('undefined / empty code → none', async () => {
        expect(await resolveCheckoutPromoPlan({})).toEqual({ kind: 'none' });
        expect(await resolveCheckoutPromoPlan({ promoCode: '' })).toEqual({ kind: 'none' });
        expect(validatePromoCodeMock).not.toHaveBeenCalled();
    });

    it('SPEC-262 C1: validatePromoCode returns invalid (expired) → invalid result, never throws', async () => {
        validatePromoCodeMock.mockResolvedValue({
            valid: false,
            errorCode: 'PROMO_CODE_EXPIRED',
            errorMessage: 'This promo code has expired'
        });
        const plan = await resolveCheckoutPromoPlan({
            promoCode: 'EXPIRED',
            userId: 'user-1',
            planId: 'plan-1'
        });
        expect(plan.kind).toBe('invalid');
        expect((plan as { kind: 'invalid'; message: string }).message).toBe(
            'This promo code has expired'
        );
    });

    it('SPEC-262 H1: validatePromoCode returns invalid (plan restriction) → invalid result', async () => {
        validatePromoCodeMock.mockResolvedValue({
            valid: false,
            errorCode: 'PROMO_CODE_PLAN_RESTRICTION',
            errorMessage: 'This promo code is not valid for the selected plan'
        });
        const plan = await resolveCheckoutPromoPlan({
            promoCode: 'WRONGPLAN',
            userId: 'user-1',
            planId: 'plan-1'
        });
        expect(plan.kind).toBe('invalid');
    });

    it('SPEC-262 H1: validatePromoCode returns invalid (newCustomersOnly) → invalid result', async () => {
        validatePromoCodeMock.mockResolvedValue({
            valid: false,
            errorCode: 'PROMO_CODE_NEW_USERS_ONLY',
            errorMessage: 'This promo code is only valid for new customers'
        });
        const plan = await resolveCheckoutPromoPlan({
            promoCode: 'NEWONLY',
            userId: 'existing-user',
            planId: 'plan-1'
        });
        expect(plan.kind).toBe('invalid');
    });

    it('SPEC-262 H1: validatePromoCode returns invalid (maxPerCustomer) → invalid result', async () => {
        validatePromoCodeMock.mockResolvedValue({
            valid: false,
            errorCode: 'PROMO_CODE_MAX_USES_PER_USER',
            errorMessage: 'You have already used this promo code'
        });
        const plan = await resolveCheckoutPromoPlan({
            promoCode: 'MAXPERUSER',
            userId: 'user-1'
        });
        expect(plan.kind).toBe('invalid');
    });

    it('passes userId + planId + amount to validatePromoCode', async () => {
        validatePromoCodeMock.mockResolvedValue({ valid: true });
        promoServiceGetByCodeMock = vi
            .fn()
            .mockResolvedValue({ success: false, error: { code: 'NOT_FOUND', message: 'x' } });
        resolveFreeTrialExtensionPromoMock.mockReturnValue(null);

        await resolveCheckoutPromoPlan({
            promoCode: 'ANYCODE',
            userId: 'user-1',
            planId: 'plan-abc',
            amount: 5000
        });

        expect(validatePromoCodeMock).toHaveBeenCalledWith('ANYCODE', {
            userId: 'user-1',
            planId: 'plan-abc',
            amount: 5000
        });
    });

    it('DB trial_extension → trial with freeTrialDays + promoCodeId + code (HOS-240)', async () => {
        validatePromoCodeMock.mockResolvedValue({ valid: true });
        promoServiceGetByCodeMock = vi.fn().mockResolvedValue({
            success: true,
            data: {
                id: 'pc',
                code: 'FREE30',
                active: true,
                effect: { kind: 'trial_extension', extraDays: 30 }
            }
        });
        const result = await resolveCheckoutPromoPlan({ promoCode: 'FREE30', userId: 'user-1' });
        // HOS-240: a DB-backed trial_extension now carries its identity so the
        // checkout can record the redemption + stamp promo_code_id.
        expect(result).toEqual({
            kind: 'trial',
            freeTrialDays: 30,
            promoCodeId: 'pc',
            code: 'FREE30'
        });
    });

    // HOS-1171. This replaces a test that asserted the opposite — 'DB comp → comp
    // with promoCodeId + code' — which was the vulnerability written down as a
    // contract. Returning `{ kind: 'comp' }` here is what let `/start-paid`
    // reach `createCompSubscription()`: `status='comp'`, no MercadoPago
    // preapproval, a period end 100 years out, on a route with no
    // `requiredPermissions` and no `livemode` filter. `HOSPEDA_FREE` was active
    // and uncapped in production; anyone who learned the string could issue
    // themselves a permanently free subscription in ONE request.
    //
    // This is the load-bearing door. `/apply` needs an existing subscription to
    // flip, and someone after free access has none.
    it('HOS-1171 DB comp → invalid: the checkout NEVER creates a comp subscription', async () => {
        validatePromoCodeMock.mockResolvedValue({ valid: true });
        promoServiceGetByCodeMock = vi.fn().mockResolvedValue({
            success: true,
            data: { id: 'pc-comp', code: 'COMPVIP', active: true, effect: { kind: 'comp' } }
        });

        const result = await resolveCheckoutPromoPlan({ promoCode: 'COMPVIP', userId: 'user-1' });

        // `invalid` is what the caller maps to INVALID_PROMO_CODE. The assertion
        // that matters is the discriminant: anything that still said `comp` would
        // route straight back into `createCompSubscription`.
        expect(result.kind).toBe('invalid');
        expect(result).not.toMatchObject({ kind: 'comp' });
    });

    it('HOS-1171 DB comp → invalid on the no-userId path too', async () => {
        // The partial path (`classifyValidatedCode` reached without a userId)
        // shares the same branch. Pinning it separately because it is the one a
        // future caller is most likely to reach by accident — it skips
        // `validatePromoCode` entirely.
        promoServiceGetByCodeMock = vi.fn().mockResolvedValue({
            success: true,
            data: { id: 'pc-comp', code: 'COMPVIP', active: true, effect: { kind: 'comp' } }
        });

        const result = await resolveCheckoutPromoPlan({ promoCode: 'COMPVIP' });

        expect(result.kind).toBe('invalid');
    });

    it('DB discount → discount with effect', async () => {
        const effect = { kind: 'discount', valueKind: 'percentage', value: 50, durationCycles: 3 };
        validatePromoCodeMock.mockResolvedValue({ valid: true });
        promoServiceGetByCodeMock = vi.fn().mockResolvedValue({
            success: true,
            data: { id: 'pc-d', code: 'LANZA50', active: true, effect }
        });
        const plan = await resolveCheckoutPromoPlan({ promoCode: 'LANZA50', userId: 'user-1' });
        expect(plan).toMatchObject({
            kind: 'discount',
            promoCodeId: 'pc-d',
            code: 'LANZA50',
            effect
        });
    });

    it('not in DB + config trial → trial (no userId path)', async () => {
        // Without userId, bypasses validatePromoCode and goes straight to classifyValidatedCode
        promoServiceGetByCodeMock = vi
            .fn()
            .mockResolvedValue({ success: false, error: { code: 'NOT_FOUND', message: 'x' } });
        resolveFreeTrialExtensionPromoMock.mockReturnValue({ extraTrialDays: 30 });
        const result = await resolveCheckoutPromoPlan({ promoCode: 'FREEMONTH' });
        expect(result).toEqual({ kind: 'trial', freeTrialDays: 30 });
    });

    it('not in DB + not a config trial → invalid', async () => {
        promoServiceGetByCodeMock = vi
            .fn()
            .mockResolvedValue({ success: false, error: { code: 'NOT_FOUND', message: 'x' } });
        resolveFreeTrialExtensionPromoMock.mockReturnValue(null);
        const plan = await resolveCheckoutPromoPlan({ promoCode: 'BOGUS' });
        expect(plan.kind).toBe('invalid');
    });
});
