import { describe, expect, it } from 'vitest';
import {
    AdminPromoCodeCreateRequestSchema,
    AdminPromoCodeEffectSchema
} from '../../../src/api/billing/promo-code-admin.schema';

const validBody = {
    code: 'SUMMER_2026',
    effect: {
        kind: 'DISCOUNT',
        discountKind: 'PERCENTAGE',
        value: 20,
        durationKind: 'N_CHARGES',
        durationCharges: 3
    },
    allVerticals: true,
    verticals: null,
    totalQuota: 100,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: '2027-01-01T00:00:00.000Z',
    stackable: false,
    usableWithAnotherActive: false
};

describe('AdminPromoCodeCreateRequestSchema', () => {
    it('accepts a complete admin promo code body', () => {
        expect(AdminPromoCodeCreateRequestSchema.safeParse(validBody).success).toBe(true);
    });

    it('rejects a lowercase code', () => {
        expect(
            AdminPromoCodeCreateRequestSchema.safeParse({ ...validBody, code: 'summer' }).success
        ).toBe(false);
    });

    it('rejects percentage discounts above 100', () => {
        expect(
            AdminPromoCodeEffectSchema.safeParse({ ...validBody.effect, value: 101 }).success
        ).toBe(false);
    });

    it('requires durationCharges for N_CHARGES', () => {
        expect(
            AdminPromoCodeEffectSchema.safeParse({ ...validBody.effect, durationCharges: null })
                .success
        ).toBe(false);
    });

    it('rejects durationCharges for FIRST_CHARGE', () => {
        expect(
            AdminPromoCodeEffectSchema.safeParse({
                ...validBody.effect,
                durationKind: 'FIRST_CHARGE'
            }).success
        ).toBe(false);
    });

    it('requires a vertical when not all verticals are selected', () => {
        expect(
            AdminPromoCodeCreateRequestSchema.safeParse({ ...validBody, allVerticals: false })
                .success
        ).toBe(false);
    });

    it('requires validUntil after validFrom', () => {
        expect(
            AdminPromoCodeCreateRequestSchema.safeParse({
                ...validBody,
                validUntil: '2025-01-01T00:00:00.000Z'
            }).success
        ).toBe(false);
    });

    it('rejects unknown request fields', () => {
        expect(
            AdminPromoCodeCreateRequestSchema.safeParse({ ...validBody, unexpected: true }).success
        ).toBe(false);
    });
});
