import { describe, expect, it } from 'vitest';
import {
    ProductBatchCreateSchema,
    ProductBatchDeleteSchema,
    ProductBatchOperationSchema,
    ProductBatchRestoreSchema,
    ProductBatchResultSchema,
    ProductBatchUpdateSchema
} from '../../../src/entities/product/product.batch.schema.js';

describe('Product Batch Schema', () => {
    describe('ProductBatchCreateSchema', () => {
        it('should validate batch create operations', () => {
            const batchCreate = {
                items: [
                    {
                        name: 'Product 1',
                        type: 'campaign',
                        metadata: { tier: 'basic' },
                        lifecycleState: 'ACTIVE'
                    },
                    {
                        name: 'Product 2',
                        type: 'sponsorship',
                        description: 'Premium package',
                        metadata: { tier: 'premium' },
                        lifecycleState: 'ACTIVE'
                    }
                ]
            };

            const result = ProductBatchCreateSchema.safeParse(batchCreate);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.items).toHaveLength(2);
                const firstItem = result.data.items[0];
                const secondItem = result.data.items[1];
                expect(firstItem?.name).toBe('Product 1');
                expect(secondItem?.type).toBe('sponsorship');
            }
        });

        it('should enforce maximum batch size for create', () => {
            const largeBatch = {
                items: Array.from({ length: 101 }, (_, i) => ({
                    name: `Product ${i}`,
                    type: 'campaign',
                    lifecycleState: 'ACTIVE'
                }))
            };

            const result = ProductBatchCreateSchema.safeParse(largeBatch);
            expect(result.success).toBe(false);
        });
    });

    describe('ProductBatchUpdateSchema', () => {
        it('should validate batch update operations', () => {
            const batchUpdate = {
                items: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        name: 'Updated Product 1'
                    },
                    {
                        id: '456e7890-e12b-34d5-a678-901234567890',
                        type: 'sponsorship'
                    }
                ]
            };

            const result = ProductBatchUpdateSchema.safeParse(batchUpdate);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.items).toHaveLength(2);
                const firstItem = result.data.items[0];
                const secondItem = result.data.items[1];
                expect(firstItem?.id).toBe('123e4567-e89b-12d3-a456-426614174000');
                expect(secondItem?.type).toBe('sponsorship');
            }
        });

        it('should require at least one field per update item', () => {
            const invalidUpdate = {
                items: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000'
                    }
                ]
            };

            const result = ProductBatchUpdateSchema.safeParse(invalidUpdate);
            expect(result.success).toBe(false);
        });
    });

    describe('ProductBatchDeleteSchema', () => {
        it('should validate batch delete operations', () => {
            const batchDelete = {
                ids: [
                    '123e4567-e89b-12d3-a456-426614174000',
                    '456e7890-e12b-34d5-a678-901234567890'
                ],
                permanent: false
            };

            const result = ProductBatchDeleteSchema.safeParse(batchDelete);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toHaveLength(2);
                expect(result.data.permanent).toBe(false);
            }
        });

        it('should default permanent to false', () => {
            const batchDelete = {
                ids: ['123e4567-e89b-12d3-a456-426614174000']
            };

            const result = ProductBatchDeleteSchema.safeParse(batchDelete);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.permanent).toBe(false);
            }
        });
    });

    describe('ProductBatchRestoreSchema', () => {
        it('should validate batch restore operations', () => {
            const batchRestore = {
                ids: [
                    '123e4567-e89b-12d3-a456-426614174000',
                    '456e7890-e12b-34d5-a678-901234567890'
                ]
            };

            const result = ProductBatchRestoreSchema.safeParse(batchRestore);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toHaveLength(2);
            }
        });
    });

    describe('ProductBatchOperationSchema', () => {
        it('should validate different batch operation types', () => {
            const createOp = {
                operation: 'create',
                payload: {
                    items: [
                        {
                            name: 'Test Product',
                            type: 'campaign',
                            lifecycleState: 'ACTIVE'
                        }
                    ]
                }
            };

            const updateOp = {
                operation: 'update',
                payload: {
                    items: [
                        {
                            id: '123e4567-e89b-12d3-a456-426614174000',
                            name: 'Updated'
                        }
                    ]
                }
            };

            const deleteOp = {
                operation: 'delete',
                payload: {
                    ids: ['123e4567-e89b-12d3-a456-426614174000'],
                    permanent: false
                }
            };

            expect(ProductBatchOperationSchema.safeParse(createOp).success).toBe(true);
            expect(ProductBatchOperationSchema.safeParse(updateOp).success).toBe(true);
            expect(ProductBatchOperationSchema.safeParse(deleteOp).success).toBe(true);
        });
    });

    describe('ProductBatchResultSchema', () => {
        it('should validate batch operation results', () => {
            const batchResult = {
                success: true,
                operation: 'create',
                totalRequested: 3,
                totalProcessed: 2,
                totalSucceeded: 2,
                totalFailed: 0,
                results: [
                    {
                        success: true,
                        item: {
                            id: '123e4567-e89b-12d3-a456-426614174000',
                            name: 'Product 1',
                            type: 'campaign'
                        }
                    },
                    {
                        success: true,
                        item: {
                            id: '456e7890-e12b-34d5-a678-901234567890',
                            name: 'Product 2',
                            type: 'sponsorship'
                        }
                    }
                ],
                errors: []
            };

            const result = ProductBatchResultSchema.safeParse(batchResult);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.totalSucceeded).toBe(2);
                expect(result.data.totalFailed).toBe(0);
                expect(result.data.results).toHaveLength(2);
                expect(result.data.errors).toHaveLength(0);
            }
        });

        it('should validate batch results with errors', () => {
            const batchResult = {
                success: false,
                operation: 'update',
                totalRequested: 2,
                totalProcessed: 2,
                totalSucceeded: 1,
                totalFailed: 1,
                results: [
                    {
                        success: true,
                        item: {
                            id: '123e4567-e89b-12d3-a456-426614174000',
                            name: 'Updated Product'
                        }
                    }
                ],
                errors: [
                    {
                        index: 1,
                        error: 'Product not found',
                        code: 'NOT_FOUND'
                    }
                ]
            };

            const result = ProductBatchResultSchema.safeParse(batchResult);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.totalSucceeded).toBe(1);
                expect(result.data.totalFailed).toBe(1);
                expect(result.data.errors).toHaveLength(1);
                const firstError = result.data.errors[0];
                expect(firstError?.code).toBe('NOT_FOUND');
            }
        });
    });
});
