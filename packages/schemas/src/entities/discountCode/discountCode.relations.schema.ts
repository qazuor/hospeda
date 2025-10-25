import { z } from 'zod';
import { DiscountCodeSchema } from './discountCode.schema.js';
import { DiscountCodeUsageSchema } from './discountCodeUsage.schema.js';

/**
 * Discount Code with Usage Statistics Schema
 * Includes aggregated usage statistics for the discount code
 */
export const DiscountCodeWithUsageSchema = DiscountCodeSchema.extend({
    // Usage statistics
    totalUsageCount: z
        .number({
            message: 'zodError.discountCodeUsage.totalUsageCount.required'
        })
        .int({ message: 'zodError.discountCodeUsage.totalUsageCount.int' })
        .nonnegative({ message: 'zodError.discountCodeUsage.totalUsageCount.nonnegative' }),

    uniqueUsersCount: z
        .number({
            message: 'zodError.discountCodeUsage.uniqueUsersCount.required'
        })
        .int({ message: 'zodError.discountCodeUsage.uniqueUsersCount.int' })
        .nonnegative({ message: 'zodError.discountCodeUsage.uniqueUsersCount.nonnegative' }),

    // Availability status
    isCurrentlyValid: z.boolean({
        message: 'zodError.discountCode.isCurrentlyValid.required'
    }),

    isExhaustedGlobally: z.boolean({
        message: 'zodError.discountCode.isExhaustedGlobally.required'
    }),

    // Usage efficiency metrics
    usagePercentage: z
        .number({
            message: 'zodError.discountCode.usagePercentage.required'
        })
        .min(0, { message: 'zodError.discountCode.usagePercentage.min' })
        .max(100, { message: 'zodError.discountCode.usagePercentage.max' })
        .optional() // Optional because unlimited codes don't have percentage
});

/**
 * Discount Code with Full Usage Details Schema
 * Includes detailed usage records for the discount code
 */
export const DiscountCodeWithUsageDetailsSchema = DiscountCodeWithUsageSchema.extend({
    // Full usage records
    usageRecords: z.array(DiscountCodeUsageSchema).default([])
});

/**
 * Discount Code Usage with Code Details Schema
 * Includes the full discount code details with usage record
 */
export const DiscountCodeUsageWithCodeSchema = DiscountCodeUsageSchema.extend({
    // Related discount code
    discountCode: DiscountCodeSchema
});

/**
 * Discount Code Client Usage Summary Schema
 * Summary of how many times a client has used a specific discount code
 */
export const DiscountCodeClientUsageSummarySchema = z.object({
    discountCodeId: z.string().uuid(),
    clientId: z.string().uuid(),
    totalUsageCount: z.number().int().nonnegative(),
    canUseCode: z.boolean(),
    remainingUsages: z.number().int().nonnegative().optional(),
    firstUsedAt: z.date().optional(),
    lastUsedAt: z.date().optional()
});

/**
 * Discount Code Validation Result Schema
 * Result of validating whether a discount code can be used
 */
export const DiscountCodeValidationResultSchema = z.object({
    isValid: z.boolean(),
    canBeUsed: z.boolean(),
    discountCode: DiscountCodeSchema.optional(),

    // Validation details
    validationErrors: z.array(z.string()).default([]),

    // Usage information
    clientUsageCount: z.number().int().nonnegative().default(0),
    globalUsageCount: z.number().int().nonnegative().default(0),

    // Limits information
    clientUsageLimit: z.number().int().positive().optional(),
    globalUsageLimit: z.number().int().positive().optional(),

    // Availability status
    isExpired: z.boolean().default(false),
    isNotYetValid: z.boolean().default(false),
    isGloballyExhausted: z.boolean().default(false),
    isClientLimitReached: z.boolean().default(false)
});

export type DiscountCodeWithUsage = z.infer<typeof DiscountCodeWithUsageSchema>;
export type DiscountCodeWithUsageDetails = z.infer<typeof DiscountCodeWithUsageDetailsSchema>;
export type DiscountCodeUsageWithCode = z.infer<typeof DiscountCodeUsageWithCodeSchema>;
export type DiscountCodeClientUsageSummary = z.infer<typeof DiscountCodeClientUsageSummarySchema>;
export type DiscountCodeValidationResult = z.infer<typeof DiscountCodeValidationResultSchema>;
