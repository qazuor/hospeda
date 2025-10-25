import { describe, expect, it } from 'vitest';
import { PurchaseCancelSchema, PurchaseCreateInputSchema } from './purchase.crud.schema.js';
import { PurchaseQuerySchema } from './purchase.query.schema.js';

describe('Purchase CRUD and Query Schemas', () => {
    it('should validate purchase creation', () => {
        const createInput = {
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            pricingPlanId: '550e8400-e29b-41d4-a716-446655440002',
            createdById: '550e8400-e29b-41d4-a716-446655440003',
            updatedById: '550e8400-e29b-41d4-a716-446655440003'
        };

        const result = PurchaseCreateInputSchema.safeParse(createInput);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.purchasedAt).toBeInstanceOf(Date);
        }
    });

    it('should validate purchase cancel', () => {
        const cancelInput = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            reason: 'Customer requested refund',
            updatedById: '550e8400-e29b-41d4-a716-446655440003'
        };

        const result = PurchaseCancelSchema.safeParse(cancelInput);
        expect(result.success).toBe(true);
    });

    it('should validate purchase query with defaults', () => {
        const query = {};

        const result = PurchaseQuerySchema.safeParse(query);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(1);
            expect(result.data.pageSize).toBe(20);
            expect(result.data.sortBy).toBe('purchasedAt');
            expect(result.data.sortOrder).toBe('desc');
        }
    });
});
