import { z } from 'zod';
import {
    PricingTierCreateInputSchema,
    PricingTierUpdateInputSchema
} from './pricingTier.crud.schema.js';
import { PricingTierSchema } from './pricingTier.schema.js';

/**
 * PricingTier Batch Operations Schema Package
 *
 * This schema defines batch operations for PricingTier entities.
 * It enables efficient processing of multiple pricing tiers simultaneously
 * with proper validation, error handling, and business rule enforcement.
 *
 * Key Features:
 * - Bulk create/update/delete operations
 * - Hierarchical tier management
 * - Range validation across multiple tiers
 * - Optimized pricing plan restructuring
 * - Comprehensive error reporting
 * - Transaction-safe operations
 */

// ============================================================================
// Base Batch Schemas
// ============================================================================

/**
 * Batch error schema for pricing tier operations
 */
export const PricingTierBatchErrorSchema = z.object({
    index: z.number().int().min(0),
    error: z.string(),
    code: z.string(),
    details: z.record(z.string(), z.unknown()).optional()
});

export type PricingTierBatchError = z.infer<typeof PricingTierBatchErrorSchema>;

/**
 * Batch item result schema
 */
export const PricingTierBatchItemResultSchema = z.object({
    success: z.boolean(),
    item: PricingTierSchema.optional(),
    error: z.string().optional(),
    clientId: z.string().optional()
});

export type PricingTierBatchItemResult = z.infer<typeof PricingTierBatchItemResultSchema>;

/**
 * Base batch result schema
 */
export const PricingTierBatchResultSchema = z.object({
    success: z.boolean(),
    operation: z.enum(['create', 'update', 'delete', 'upsert', 'restructure']),
    totalRequested: z.number().int().min(0),
    totalProcessed: z.number().int().min(0),
    totalSucceeded: z.number().int().min(0),
    totalFailed: z.number().int().min(0),
    results: z.array(PricingTierBatchItemResultSchema),
    errors: z.array(PricingTierBatchErrorSchema),
    executionTimeMs: z.number().min(0).optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
});

export type PricingTierBatchResult = z.infer<typeof PricingTierBatchResultSchema>;

// ============================================================================
// Batch Create Operations
// ============================================================================

/**
 * Single pricing tier for batch creation
 * Extends base create schema with batch-specific metadata
 */
export const PricingTierBatchCreateItemSchema = PricingTierCreateInputSchema.extend({
    /**
     * Optional client-side identifier for tracking
     * Useful for mapping results back to original requests
     */
    clientId: z.string().optional(),

    /**
     * Position hint for tier ordering
     * System will optimize final positioning
     */
    positionHint: z.number().int().nonnegative().optional()
});

export type PricingTierBatchCreateItem = z.infer<typeof PricingTierBatchCreateItemSchema>;

/**
 * Batch create request for multiple pricing tiers
 */
export const PricingTierBatchCreateRequestSchema = z.object({
    /**
     * Array of tiers to create
     * Minimum 1, maximum 50 for performance
     */
    items: z
        .array(PricingTierBatchCreateItemSchema)
        .min(1, { message: 'zodError.pricingTier.batch.create.items.min' })
        .max(50, { message: 'zodError.pricingTier.batch.create.items.max' }),

    /**
     * Validation and processing options
     */
    options: z
        .object({
            /**
             * Validate range continuity across all tiers
             * Default: true
             */
            validateRangeContinuity: z.boolean().default(true),

            /**
             * Allow gaps between quantity ranges
             * Default: false
             */
            allowGaps: z.boolean().default(false),

            /**
             * Replace all existing tiers for the plan
             * Default: false (append new tiers)
             */
            replaceExisting: z.boolean().default(false),

            /**
             * Optimize tier positioning automatically
             * Default: true
             */
            optimizePositioning: z.boolean().default(true),

            /**
             * Validate pricing progression rules
             * Default: true
             */
            validatePriceProgression: z.boolean().default(true)
        })
        .optional(),

    /**
     * Transaction context for atomicity
     */
    transactionId: z.string().uuid().optional()
});

export type PricingTierBatchCreateRequest = z.infer<typeof PricingTierBatchCreateRequestSchema>;

// ============================================================================
// Batch Update Operations
// ============================================================================

/**
 * Single pricing tier for batch update
 */
export const PricingTierBatchUpdateItemSchema = z.object({
    /**
     * Tier ID to update
     */
    id: z.string().uuid(),

    /**
     * Update data
     */
    data: PricingTierUpdateInputSchema,

    /**
     * Optional client-side identifier
     */
    clientId: z.string().optional()
});

export type PricingTierBatchUpdateItem = z.infer<typeof PricingTierBatchUpdateItemSchema>;

/**
 * Batch update request for multiple pricing tiers
 */
export const PricingTierBatchUpdateRequestSchema = z.object({
    /**
     * Array of tier updates
     */
    items: z
        .array(PricingTierBatchUpdateItemSchema)
        .min(1, { message: 'zodError.pricingTier.batch.update.items.min' })
        .max(50, { message: 'zodError.pricingTier.batch.update.items.max' }),

    /**
     * Update options
     */
    options: z
        .object({
            /**
             * Validate range continuity after updates
             */
            validateRangeContinuity: z.boolean().default(true),

            /**
             * Allow partial updates if some items fail
             */
            allowPartialSuccess: z.boolean().default(false),

            /**
             * Re-optimize tier positioning after updates
             */
            reoptimizePositioning: z.boolean().default(true),

            /**
             * Validate price progression after updates
             */
            validatePriceProgression: z.boolean().default(true)
        })
        .optional(),

    /**
     * Transaction context
     */
    transactionId: z.string().uuid().optional()
});

export type PricingTierBatchUpdateRequest = z.infer<typeof PricingTierBatchUpdateRequestSchema>;

// ============================================================================
// Batch Delete Operations
// ============================================================================

/**
 * Single pricing tier for batch deletion
 */
export const PricingTierBatchDeleteItemSchema = z.object({
    /**
     * Tier ID to delete
     */
    id: z.string().uuid(),

    /**
     * Deletion mode
     */
    mode: z.enum(['soft', 'hard']).default('soft'),

    /**
     * Optional client-side identifier
     */
    clientId: z.string().optional()
});

export type PricingTierBatchDeleteItem = z.infer<typeof PricingTierBatchDeleteItemSchema>;

/**
 * Batch delete request for multiple pricing tiers
 */
export const PricingTierBatchDeleteRequestSchema = z.object({
    /**
     * Array of tier IDs to delete
     */
    items: z
        .array(PricingTierBatchDeleteItemSchema)
        .min(1, { message: 'zodError.pricingTier.batch.delete.items.min' })
        .max(50, { message: 'zodError.pricingTier.batch.delete.items.max' }),

    /**
     * Deletion options
     */
    options: z
        .object({
            /**
             * Validate range continuity after deletions
             */
            validateRangeContinuity: z.boolean().default(true),

            /**
             * Allow partial deletions if some items fail
             */
            allowPartialSuccess: z.boolean().default(false),

            /**
             * Re-optimize remaining tier positioning
             */
            reoptimizePositioning: z.boolean().default(true),

            /**
             * Cascade delete related entities
             */
            cascadeDelete: z.boolean().default(false)
        })
        .optional(),

    /**
     * Transaction context
     */
    transactionId: z.string().uuid().optional()
});

export type PricingTierBatchDeleteRequest = z.infer<typeof PricingTierBatchDeleteRequestSchema>;

// ============================================================================
// Advanced Batch Operations
// ============================================================================

/**
 * Pricing tier restructure operation
 * Allows complete reorganization of pricing plan tiers
 */
export const PricingTierRestructureRequestSchema = z.object({
    /**
     * Pricing plan ID to restructure
     */
    pricingPlanId: z.string().uuid(),

    /**
     * New tier structure
     */
    newStructure: z
        .array(PricingTierCreateInputSchema.omit({ pricingPlanId: true }))
        .min(1, { message: 'zodError.pricingTier.restructure.tiers.min' })
        .max(20, { message: 'zodError.pricingTier.restructure.tiers.max' }),

    /**
     * Restructure options
     */
    options: z
        .object({
            /**
             * Backup existing tiers before restructure
             */
            createBackup: z.boolean().default(true),

            /**
             * Validate new structure before applying
             */
            validateBeforeApply: z.boolean().default(true),

            /**
             * Apply changes atomically
             */
            atomic: z.boolean().default(true),

            /**
             * Preserve tier IDs where possible
             */
            preserveIds: z.boolean().default(false)
        })
        .optional(),

    /**
     * Transaction context
     */
    transactionId: z.string().uuid().optional()
});

export type PricingTierRestructureRequest = z.infer<typeof PricingTierRestructureRequestSchema>;

/**
 * Pricing tier restructure response
 */
export const PricingTierRestructureResponseSchema = z.object({
    /**
     * Success status
     */
    success: z.boolean(),

    /**
     * Message
     */
    message: z.string().optional(),

    /**
     * New tier structure
     */
    newTiers: z.array(PricingTierSchema),

    /**
     * Backup information
     */
    backup: z
        .object({
            id: z.string().uuid(),
            createdAt: z.date(),
            originalTiers: z.array(PricingTierSchema)
        })
        .optional(),

    /**
     * Statistics
     */
    statistics: z.object({
        tiersCreated: z.number().nonnegative(),
        tiersUpdated: z.number().nonnegative(),
        tiersDeleted: z.number().nonnegative(),
        processingTimeMs: z.number().nonnegative()
    }),

    /**
     * Errors encountered
     */
    errors: z.array(PricingTierBatchErrorSchema).default([])
});

export type PricingTierRestructureResponse = z.infer<typeof PricingTierRestructureResponseSchema>;
