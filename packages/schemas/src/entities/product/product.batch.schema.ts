import { z } from 'zod';
import { ProductIdSchema } from '../../common/id.schema.js';
import { ProductTypeEnumSchema } from '../../enums/product-type.schema.js';
import { ProductCreateInputSchema } from './product.crud.schema.js';

// Base batch constraints
const BATCH_SIZE_LIMIT = 100;

// Individual batch operation schemas
export const ProductBatchCreateSchema = z.object({
    items: z
        .array(ProductCreateInputSchema)
        .min(1, { message: 'At least one item is required' })
        .max(BATCH_SIZE_LIMIT, { message: `Maximum ${BATCH_SIZE_LIMIT} items allowed` })
});

export const ProductBatchUpdateSchema = z.object({
    items: z
        .array(
            z
                .object({
                    id: ProductIdSchema
                })
                .and(
                    // Use a schema without defaults for validation
                    z.object({
                        name: z.string().min(1).max(200).optional(),
                        type: ProductTypeEnumSchema.optional(),
                        metadata: z.record(z.string(), z.any()).optional(),
                        lifecycleState: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional()
                    })
                )
                .refine(
                    (data) => {
                        // Ensure at least one field besides id is provided
                        const { id, ...updateFields } = data;
                        return Object.keys(updateFields).length > 0;
                    },
                    { message: 'At least one field to update is required besides id' }
                )
        )
        .min(1, { message: 'At least one item is required' })
        .max(BATCH_SIZE_LIMIT, { message: `Maximum ${BATCH_SIZE_LIMIT} items allowed` })
});

export const ProductBatchDeleteSchema = z.object({
    ids: z
        .array(ProductIdSchema)
        .min(1, { message: 'At least one ID is required' })
        .max(BATCH_SIZE_LIMIT, { message: `Maximum ${BATCH_SIZE_LIMIT} IDs allowed` }),
    permanent: z.boolean().default(false)
});

export const ProductBatchRestoreSchema = z.object({
    ids: z
        .array(ProductIdSchema)
        .min(1, { message: 'At least one ID is required' })
        .max(BATCH_SIZE_LIMIT, { message: `Maximum ${BATCH_SIZE_LIMIT} IDs allowed` })
});

// Unified batch operation schema with discriminated unions
export const ProductBatchOperationSchema = z.discriminatedUnion('operation', [
    z.object({
        operation: z.literal('create'),
        payload: ProductBatchCreateSchema
    }),
    z.object({
        operation: z.literal('update'),
        payload: ProductBatchUpdateSchema
    }),
    z.object({
        operation: z.literal('delete'),
        payload: ProductBatchDeleteSchema
    }),
    z.object({
        operation: z.literal('restore'),
        payload: ProductBatchRestoreSchema
    })
]);

// Batch result schemas
export const ProductBatchItemResultSchema = z.object({
    success: z.boolean(),
    item: z.record(z.string(), z.unknown()).optional(), // Flexible result item
    error: z.string().optional()
});

export const ProductBatchErrorSchema = z.object({
    index: z.number().int().min(0),
    error: z.string(),
    code: z.string(),
    details: z.record(z.string(), z.unknown()).optional()
});

export const ProductBatchResultSchema = z.object({
    success: z.boolean(),
    operation: z.enum(['create', 'update', 'delete', 'restore']),
    totalRequested: z.number().int().min(0),
    totalProcessed: z.number().int().min(0),
    totalSucceeded: z.number().int().min(0),
    totalFailed: z.number().int().min(0),
    results: z.array(ProductBatchItemResultSchema),
    errors: z.array(ProductBatchErrorSchema),
    executionTimeMs: z.number().min(0).optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
});

// Type exports
export type ProductBatchCreate = z.infer<typeof ProductBatchCreateSchema>;
export type ProductBatchUpdate = z.infer<typeof ProductBatchUpdateSchema>;
export type ProductBatchDelete = z.infer<typeof ProductBatchDeleteSchema>;
export type ProductBatchRestore = z.infer<typeof ProductBatchRestoreSchema>;
export type ProductBatchOperation = z.infer<typeof ProductBatchOperationSchema>;
export type ProductBatchItemResult = z.infer<typeof ProductBatchItemResultSchema>;
export type ProductBatchError = z.infer<typeof ProductBatchErrorSchema>;
export type ProductBatchResult = z.infer<typeof ProductBatchResultSchema>;
