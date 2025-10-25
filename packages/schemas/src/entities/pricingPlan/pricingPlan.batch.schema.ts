import { z } from 'zod';
import { BillingIntervalEnum } from '../../enums/billing-interval.enum.js';
import { BillingSchemeEnum } from '../../enums/billing-scheme.enum.js';
import { PricingPlanCreateInputSchema } from './pricingPlan.crud.schema.js';
import { PricingPlanIdSchema } from './pricingPlan.schema.js';

// ============================================================================
// BATCH OPERATION SCHEMAS
// ============================================================================

/**
 * Schema for batch creating pricing plans
 * Supports up to 100 items per batch operation
 */
export const PricingPlanBatchCreateSchema = z.object({
    items: z
        .array(PricingPlanCreateInputSchema)
        .min(1, { message: 'At least one item is required' })
        .max(100, { message: 'Maximum 100 items per batch operation' })
});

export type PricingPlanBatchCreate = z.infer<typeof PricingPlanBatchCreateSchema>;

/**
 * Schema for batch updating pricing plans
 * Each item must have an ID and at least one field to update
 */
const PricingPlanBatchUpdateItemSchema = z
    .object({
        id: PricingPlanIdSchema,
        // Include only the specific fields that can be updated, all optional
        productId: z.string().uuid().optional(),
        billingScheme: z.nativeEnum(BillingSchemeEnum).optional(),
        interval: z.nativeEnum(BillingIntervalEnum).optional(),
        amountMinor: z.number().int().min(0).optional(),
        currency: z.string().length(3).optional(),
        description: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        lifecycleState: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional()
    })
    .refine(
        (data) => {
            // Ensure at least one field besides id is provided
            const { id, ...updateFields } = data;
            const hasAnyField = Object.values(updateFields).some((value) => value !== undefined);
            return hasAnyField;
        },
        {
            message: 'At least one field to update must be provided besides id',
            path: []
        }
    );

export const PricingPlanBatchUpdateSchema = z.object({
    items: z
        .array(PricingPlanBatchUpdateItemSchema)
        .min(1, { message: 'At least one item is required' })
        .max(100, { message: 'Maximum 100 items per batch operation' })
});

export type PricingPlanBatchUpdate = z.infer<typeof PricingPlanBatchUpdateSchema>;

/**
 * Schema for batch soft deleting pricing plans
 */
export const PricingPlanBatchDeleteSchema = z.object({
    ids: z
        .array(PricingPlanIdSchema)
        .min(1, { message: 'At least one ID is required' })
        .max(100, { message: 'Maximum 100 IDs per batch operation' })
});

export type PricingPlanBatchDelete = z.infer<typeof PricingPlanBatchDeleteSchema>;

/**
 * Schema for batch restoring pricing plans
 */
export const PricingPlanBatchRestoreSchema = z.object({
    ids: z
        .array(PricingPlanIdSchema)
        .min(1, { message: 'At least one ID is required' })
        .max(100, { message: 'Maximum 100 IDs per batch operation' })
});

export type PricingPlanBatchRestore = z.infer<typeof PricingPlanBatchRestoreSchema>;

/**
 * Schema for batch hard deleting pricing plans
 * Requires explicit confirmation due to permanent deletion
 */
export const PricingPlanBatchHardDeleteSchema = z.object({
    ids: z
        .array(PricingPlanIdSchema)
        .min(1, { message: 'At least one ID is required' })
        .max(100, { message: 'Maximum 100 IDs per batch operation' }),
    confirm: z.literal(true, {
        message: 'Hard delete requires explicit confirmation'
    })
});

export type PricingPlanBatchHardDelete = z.infer<typeof PricingPlanBatchHardDeleteSchema>;

// ============================================================================
// BATCH OPERATION UNION SCHEMA
// ============================================================================

/**
 * Discriminated union for different batch operations
 * Allows type-safe handling of various batch operation types
 */
export const PricingPlanBatchOperationSchema = z.discriminatedUnion('operation', [
    z.object({
        operation: z.literal('create'),
        data: PricingPlanBatchCreateSchema
    }),
    z.object({
        operation: z.literal('update'),
        data: PricingPlanBatchUpdateSchema
    }),
    z.object({
        operation: z.literal('delete'),
        data: PricingPlanBatchDeleteSchema
    }),
    z.object({
        operation: z.literal('restore'),
        data: PricingPlanBatchRestoreSchema
    }),
    z.object({
        operation: z.literal('hardDelete'),
        data: PricingPlanBatchHardDeleteSchema
    })
]);

export type PricingPlanBatchOperation = z.infer<typeof PricingPlanBatchOperationSchema>;

// ============================================================================
// BATCH RESULT SCHEMAS
// ============================================================================

/**
 * Schema for individual batch operation result
 */
export const PricingPlanBatchItemResultSchema = z.object({
    id: PricingPlanIdSchema.optional(), // May not have ID for failed creates
    success: z.boolean(),
    error: z.string().optional() // Error message if success is false
});

export type PricingPlanBatchItemResult = z.infer<typeof PricingPlanBatchItemResultSchema>;

/**
 * Schema for batch operation results
 * Provides summary statistics and individual results
 */
export const PricingPlanBatchResultSchema = z
    .object({
        operation: z.enum(['create', 'update', 'delete', 'restore', 'hardDelete']),
        successful: z.number().int().min(0),
        failed: z.number().int().min(0),
        total: z.number().int().min(0),
        results: z.array(PricingPlanBatchItemResultSchema)
    })
    .refine((data) => data.successful + data.failed === data.total, {
        message: 'Sum of successful and failed must equal total',
        path: ['total']
    });

export type PricingPlanBatchResult = z.infer<typeof PricingPlanBatchResultSchema>;
