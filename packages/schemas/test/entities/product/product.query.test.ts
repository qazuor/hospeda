import { describe, expect, it } from 'vitest';
import {
    ProductListOutputSchema,
    ProductSearchOutputSchema,
    ProductSearchSchema,
    ProductSummarySchema
} from '../../../src/entities/product/product.query.schema.js';

describe('Product Query Schema', () => {
    describe('ProductSearchSchema', () => {
        it('should validate basic product search', () => {
            const searchInput = {
                page: 1,
                pageSize: 10,
                sortBy: 'name',
                sortOrder: 'asc' as const,
                q: 'sponsorship'
            };

            const result = ProductSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.q).toBe('sponsorship');
            }
        });

        it('should validate product search with filters', () => {
            const searchInput = {
                page: 1,
                pageSize: 20,
                type: 'campaign',
                name: 'Premium',
                isActive: true,
                createdAfter: new Date('2023-01-01'),
                createdBefore: new Date('2023-12-31')
            };

            const result = ProductSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('campaign');
                expect(result.data.name).toBe('Premium');
                expect(result.data.isActive).toBe(true);
            }
        });

        it('should validate all ProductType enum filters', () => {
            const validTypes = [
                'sponsorship',
                'campaign',
                'featured',
                'prof_service',
                'listing_plan',
                'placement_rate'
            ];

            for (const type of validTypes) {
                const searchInput = {
                    type,
                    page: 1,
                    pageSize: 10
                };

                const result = ProductSearchSchema.safeParse(searchInput);
                expect(result.success).toBe(true);
            }
        });

        it('should apply default pagination', () => {
            const searchInput = {};

            const result = ProductSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(10);
                expect(result.data.sortOrder).toBe('asc');
            }
        });

        it('should validate metadata queries', () => {
            const searchInput = {
                metadataKey: 'pricing.baseRate',
                metadataValue: '150'
            };

            const result = ProductSearchSchema.safeParse(searchInput);
            expect(result.success).toBe(true);
        });
    });

    describe('ProductSearchOutputSchema', () => {
        it('should validate product search output', () => {
            const searchOutput = {
                data: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        name: 'Premium Sponsorship',
                        type: 'sponsorship',
                        metadata: { tier: 'premium' },
                        lifecycleState: 'ACTIVE',
                        createdAt: new Date('2023-01-01T00:00:00Z'),
                        updatedAt: new Date('2023-01-01T00:00:00Z'),
                        createdById: '550e8400-e29b-41d4-a716-446655440001',
                        updatedById: '550e8400-e29b-41d4-a716-446655440001'
                    }
                ],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            const result = ProductSearchOutputSchema.safeParse(searchOutput);
            expect(result.success).toBe(true);
        });
    });

    describe('ProductListOutputSchema', () => {
        it('should validate product list output', () => {
            const listOutput = {
                items: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        name: 'Campaign Package',
                        type: 'campaign',
                        metadata: {},
                        lifecycleState: 'ACTIVE',
                        createdAt: new Date('2023-01-01T00:00:00Z'),
                        updatedAt: new Date('2023-01-01T00:00:00Z'),
                        createdById: '550e8400-e29b-41d4-a716-446655440001',
                        updatedById: '550e8400-e29b-41d4-a716-446655440001'
                    }
                ],
                total: 1
            };

            const result = ProductListOutputSchema.safeParse(listOutput);
            expect(result.success).toBe(true);
        });
    });

    describe('ProductSummarySchema', () => {
        it('should validate product summary', () => {
            const summary = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Professional Service',
                type: 'prof_service'
            };

            const result = ProductSummarySchema.safeParse(summary);
            expect(result.success).toBe(true);
        });
    });
});
