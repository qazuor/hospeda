import { describe, expect, it } from 'vitest';
import {
    ProductBulkCreateInputSchema,
    ProductBulkDeleteSchema,
    ProductBulkUpdateInputSchema,
    ProductCreateInputSchema,
    ProductDeleteSchema,
    ProductRestoreSchema,
    ProductUpdateInputSchema
} from '../../../src/entities/product/product.crud.schema.js';

describe('Product CRUD Schema', () => {
    describe('ProductCreateInputSchema', () => {
        it('should validate product creation with required fields', () => {
            const createInput = {
                name: 'Premium Sponsorship Package',
                type: 'sponsorship',
                metadata: {
                    description: 'Premium sponsorship features',
                    maxSponsorships: 10
                }
            };

            const result = ProductCreateInputSchema.safeParse(createInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('Premium Sponsorship Package');
                expect(result.data.type).toBe('sponsorship');
                expect(result.data.lifecycleState).toBe('ACTIVE');
            }
        });

        it('should apply default lifecycle state', () => {
            const createInput = {
                name: 'Basic Campaign',
                type: 'campaign',
                metadata: {}
            };

            const result = ProductCreateInputSchema.safeParse(createInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.lifecycleState).toBe('ACTIVE');
            }
        });

        it('should reject invalid product type', () => {
            const createInput = {
                name: 'Invalid Product',
                type: 'invalid_type',
                metadata: {}
            };

            const result = ProductCreateInputSchema.safeParse(createInput);
            expect(result.success).toBe(false);
        });

        it('should require name field', () => {
            const createInput = {
                type: 'sponsorship',
                metadata: {}
            };

            const result = ProductCreateInputSchema.safeParse(createInput);
            expect(result.success).toBe(false);
        });

        it('should validate all ProductType enum values in creation', () => {
            const validTypes = [
                'sponsorship',
                'campaign',
                'featured',
                'prof_service',
                'listing_plan',
                'placement_rate'
            ];

            for (const type of validTypes) {
                const createInput = {
                    name: `Product ${type}`,
                    type,
                    metadata: {}
                };

                const result = ProductCreateInputSchema.safeParse(createInput);
                expect(result.success).toBe(true);
            }
        });
    });

    describe('ProductUpdateInputSchema', () => {
        it('should validate partial product updates', () => {
            const updateInput = {
                name: 'Updated Sponsorship Package'
            };

            const result = ProductUpdateInputSchema.safeParse(updateInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('Updated Sponsorship Package');
            }
        });

        it('should allow updating metadata only', () => {
            const updateInput = {
                metadata: {
                    newFeature: 'priority_support',
                    pricing: { base: 299 }
                }
            };

            const result = ProductUpdateInputSchema.safeParse(updateInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.metadata?.newFeature).toBe('priority_support');
            }
        });

        it('should allow updating type', () => {
            const updateInput = {
                type: 'campaign'
            };

            const result = ProductUpdateInputSchema.safeParse(updateInput);
            expect(result.success).toBe(true);
        });

        it('should allow empty update object', () => {
            const updateInput = {};

            const result = ProductUpdateInputSchema.safeParse(updateInput);
            expect(result.success).toBe(true);
        });
    });

    describe('ProductDeleteSchema', () => {
        it('should validate product deletion with ID', () => {
            const deleteInput = {
                id: '123e4567-e89b-12d3-a456-426614174000'
            };

            const result = ProductDeleteSchema.safeParse(deleteInput);
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUID', () => {
            const deleteInput = {
                id: 'invalid-uuid'
            };

            const result = ProductDeleteSchema.safeParse(deleteInput);
            expect(result.success).toBe(false);
        });
    });

    describe('ProductRestoreSchema', () => {
        it('should validate product restoration', () => {
            const restoreInput = {
                id: '123e4567-e89b-12d3-a456-426614174000'
            };

            const result = ProductRestoreSchema.safeParse(restoreInput);
            expect(result.success).toBe(true);
        });
    });

    describe('Bulk Operations', () => {
        it('should validate bulk create operations', () => {
            const bulkCreateInput = {
                items: [
                    {
                        name: 'Sponsorship Package A',
                        type: 'sponsorship',
                        metadata: { tier: 'basic' }
                    },
                    {
                        name: 'Campaign Package B',
                        type: 'campaign',
                        metadata: { channels: ['web', 'social'] }
                    }
                ]
            };

            const result = ProductBulkCreateInputSchema.safeParse(bulkCreateInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.items).toHaveLength(2);
                const firstItem = result.data.items[0];
                const secondItem = result.data.items[1];
                expect(firstItem?.name).toBe('Sponsorship Package A');
                expect(secondItem?.type).toBe('campaign');
            }
        });

        it('should validate bulk update operations', () => {
            const bulkUpdateInput = {
                items: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        name: 'Updated Product A'
                    },
                    {
                        id: '123e4567-e89b-12d3-a456-426614174001',
                        metadata: { updated: true }
                    }
                ]
            };

            const result = ProductBulkUpdateInputSchema.safeParse(bulkUpdateInput);
            expect(result.success).toBe(true);
        });

        it('should validate bulk delete operations', () => {
            const bulkDeleteInput = {
                ids: [
                    '123e4567-e89b-12d3-a456-426614174000',
                    '123e4567-e89b-12d3-a456-426614174001'
                ]
            };

            const result = ProductBulkDeleteSchema.safeParse(bulkDeleteInput);
            expect(result.success).toBe(true);
        });
    });
});
