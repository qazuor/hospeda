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

import { beforeEach, describe, expect, it, vi } from 'vitest';

const validatePromoCodeMock = vi.fn();
// Reassigned per-test before invoking the resolver; read lazily by the mocked
// PromoCodeService.getByCode (see the vi.mock factory below).
let promoServiceGetByCodeMock: ReturnType<typeof vi.fn>;

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
vi.mock('@repo/billing', () => ({
    resolveFreeTrialExtensionPromo: (...args: unknown[]) =>
        resolveFreeTrialExtensionPromoMock(...args)
}));

vi.mock('@repo/schemas', () => ({
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

    it('DB trial_extension → trial with freeTrialDays (after validation pass)', async () => {
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
        expect(result).toEqual({ kind: 'trial', freeTrialDays: 30 });
    });

    it('DB comp → comp with promoCodeId + code', async () => {
        validatePromoCodeMock.mockResolvedValue({ valid: true });
        promoServiceGetByCodeMock = vi.fn().mockResolvedValue({
            success: true,
            data: { id: 'pc-comp', code: 'COMPVIP', active: true, effect: { kind: 'comp' } }
        });
        const result = await resolveCheckoutPromoPlan({ promoCode: 'COMPVIP', userId: 'user-1' });
        expect(result).toEqual({ kind: 'comp', promoCodeId: 'pc-comp', code: 'COMPVIP' });
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
