import { describe, expect, it } from 'vitest';
import {
    CreatePromoCodeSchema,
    PromoCodeDiscountTypeEnum,
    UpdatePromoCodeSchema
} from '../../../src/api/billing/promo-code.schema.js';

describe('CreatePromoCodeSchema', () => {
    const base = {
        code: 'SAVE25',
        discountType: PromoCodeDiscountTypeEnum.PERCENTAGE,
        discountValue: 25
    };

    it('should validate a minimal valid payload', () => {
        const result = CreatePromoCodeSchema.safeParse(base);
        expect(result.success).toBe(true);
    });

    it('should accept the full rich payload (the 3 extended fields)', () => {
        const result = CreatePromoCodeSchema.safeParse({
            ...base,
            description: 'Launch discount',
            maxUses: 100,
            maxUsesPerUser: 2,
            validFrom: '2026-05-28T00:00:00.000Z',
            expiryDate: '2026-12-31T00:00:00.000Z',
            planRestrictions: ['11111111-1111-1111-1111-111111111111'],
            firstPurchaseOnly: true,
            isStackable: true,
            minAmount: 5000,
            isActive: true
        });

        expect(result.success).toBe(true);
        if (result.success) {
            // dates are coerced to Date so the route can forward them to the service
            expect(result.data.validFrom).toBeInstanceOf(Date);
            expect(result.data.expiryDate).toBeInstanceOf(Date);
            expect(result.data.maxUsesPerUser).toBe(2);
            expect(result.data.isStackable).toBe(true);
        }
    });

    it('should reject a payload missing discountType (the front "type" mismatch bug)', () => {
        const result = CreatePromoCodeSchema.safeParse({
            code: 'SAVE25',
            type: 'percentage',
            discountValue: 25
        });
        expect(result.success).toBe(false);
    });

    it('should reject null maxUses (optional, not nullable — the front null bug)', () => {
        const result = CreatePromoCodeSchema.safeParse({ ...base, maxUses: null });
        expect(result.success).toBe(false);
    });

    it('should reject a percentage discount above 100', () => {
        const result = CreatePromoCodeSchema.safeParse({
            ...base,
            discountType: PromoCodeDiscountTypeEnum.PERCENTAGE,
            discountValue: 150
        });
        expect(result.success).toBe(false);
    });

    it('should allow a fixed discount above 100 (cents, not a percentage)', () => {
        const result = CreatePromoCodeSchema.safeParse({
            code: 'FLAT',
            discountType: PromoCodeDiscountTypeEnum.FIXED,
            discountValue: 50000
        });
        expect(result.success).toBe(true);
    });

    it('should reject a code shorter than 3 characters', () => {
        const result = CreatePromoCodeSchema.safeParse({ ...base, code: 'AB' });
        expect(result.success).toBe(false);
    });

    it('should accept plan restrictions as plain strings (no uuid requirement)', () => {
        const result = CreatePromoCodeSchema.safeParse({
            ...base,
            planRestrictions: ['owner-basico', 'owner-pro']
        });
        expect(result.success).toBe(true);
    });
});

describe('UpdatePromoCodeSchema', () => {
    it('should accept the mutable fields only', () => {
        const result = UpdatePromoCodeSchema.safeParse({
            description: 'Updated',
            maxUses: 50,
            isActive: false
        });
        expect(result.success).toBe(true);
    });

    it('should reject attempts to change immutable fields (strict)', () => {
        const result = UpdatePromoCodeSchema.safeParse({
            description: 'Updated',
            discountValue: 99
        });
        expect(result.success).toBe(false);
    });
});
