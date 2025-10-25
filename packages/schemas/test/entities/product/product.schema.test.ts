import { describe, expect, it } from 'vitest';
import { ProductSchema } from '../../../src/entities/product/product.schema.js';

describe('Product Schema', () => {
    describe('Basic validation', () => {
        it('should validate complete product object', () => {
            const product = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Premium Sponsorship Package',
                type: 'sponsorship',
                metadata: {
                    description: 'Premium sponsorship for posts',
                    features: ['priority_placement', 'analytics']
                },
                lifecycleState: 'ACTIVE',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ProductSchema.safeParse(product);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('Premium Sponsorship Package');
                expect(result.data.type).toBe('sponsorship');
                expect(result.data.metadata).toEqual({
                    description: 'Premium sponsorship for posts',
                    features: ['priority_placement', 'analytics']
                });
            }
        });

        it('should validate product with minimal required fields', () => {
            const product = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Basic Campaign',
                type: 'campaign',
                metadata: {},
                lifecycleState: 'ACTIVE',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ProductSchema.safeParse(product);
            expect(result.success).toBe(true);
        });

        it('should reject invalid product type', () => {
            const product = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Invalid Product',
                type: 'invalid_type',
                metadata: {},
                lifecycleState: 'ACTIVE',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ProductSchema.safeParse(product);
            expect(result.success).toBe(false);
        });

        it('should reject empty name', () => {
            const product = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: '',
                type: 'sponsorship',
                metadata: {},
                lifecycleState: 'ACTIVE',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ProductSchema.safeParse(product);
            expect(result.success).toBe(false);
        });

        it('should handle complex metadata structure', () => {
            const product = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Professional Service Package',
                type: 'prof_service',
                metadata: {
                    serviceTypes: ['consultation', 'design'],
                    pricing: {
                        baseRate: 150,
                        currency: 'USD'
                    },
                    duration: {
                        min: 30,
                        max: 120,
                        unit: 'minutes'
                    }
                },
                lifecycleState: 'ACTIVE',
                createdAt: new Date('2023-01-01T00:00:00Z'),
                updatedAt: new Date('2023-01-01T00:00:00Z'),
                createdById: '550e8400-e29b-41d4-a716-446655440001',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            const result = ProductSchema.safeParse(product);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.metadata.serviceTypes).toEqual(['consultation', 'design']);
                expect(result.data.metadata.pricing.baseRate).toBe(150);
            }
        });

        it('should validate all ProductType enum values', () => {
            const validTypes = [
                'sponsorship',
                'campaign',
                'featured',
                'prof_service',
                'listing_plan',
                'placement_rate'
            ];

            for (const type of validTypes) {
                const product = {
                    id: '123e4567-e89b-12d3-a456-426614174000',
                    name: `Product ${type}`,
                    type,
                    metadata: {},
                    lifecycleState: 'ACTIVE',
                    createdAt: new Date('2023-01-01T00:00:00Z'),
                    updatedAt: new Date('2023-01-01T00:00:00Z'),
                    createdById: '550e8400-e29b-41d4-a716-446655440001',
                    updatedById: '550e8400-e29b-41d4-a716-446655440001'
                };

                const result = ProductSchema.safeParse(product);
                expect(result.success).toBe(true);
            }
        });
    });
});
