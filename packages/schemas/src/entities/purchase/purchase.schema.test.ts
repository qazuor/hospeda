import { describe, expect, it } from 'vitest';
import type { ZodIssue } from 'zod';
import { PurchaseSchema } from './purchase.schema.js';

describe('PurchaseSchema', () => {
    it('should validate a valid purchase', () => {
        const validPurchase = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            pricingPlanId: '550e8400-e29b-41d4-a716-446655440002',
            purchasedAt: new Date('2024-01-01T10:00:00Z'),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: '550e8400-e29b-41d4-a716-446655440003',
            updatedById: '550e8400-e29b-41d4-a716-446655440003',
            adminInfo: { notes: 'Test purchase' }
        };

        const result = PurchaseSchema.safeParse(validPurchase);
        expect(result.success).toBe(true);
    });

    it('should require all mandatory fields', () => {
        const invalidPurchase = {};

        const result = PurchaseSchema.safeParse(invalidPurchase);
        expect(result.success).toBe(false);
        if (!result.success) {
            const fieldErrors = result.error.issues.map((issue: ZodIssue) => issue.path[0]);
            expect(fieldErrors).toContain('id');
            expect(fieldErrors).toContain('clientId');
            expect(fieldErrors).toContain('pricingPlanId');
            expect(fieldErrors).toContain('purchasedAt');
        }
    });

    it('should allow optional fields to be undefined', () => {
        const purchaseWithOptionals = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            pricingPlanId: '550e8400-e29b-41d4-a716-446655440002',
            purchasedAt: new Date('2024-01-01T10:00:00Z'),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: '550e8400-e29b-41d4-a716-446655440003',
            updatedById: '550e8400-e29b-41d4-a716-446655440003'
            // adminInfo is optional
        };

        const result = PurchaseSchema.safeParse(purchaseWithOptionals);
        expect(result.success).toBe(true);
    });

    it('should validate purchasedAt is a valid date', () => {
        const purchaseWithInvalidDate = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            pricingPlanId: '550e8400-e29b-41d4-a716-446655440002',
            purchasedAt: 'invalid-date',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: '550e8400-e29b-41d4-a716-446655440003',
            updatedById: '550e8400-e29b-41d4-a716-446655440003'
        };

        const result = PurchaseSchema.safeParse(purchaseWithInvalidDate);
        expect(result.success).toBe(false);
    });
});
