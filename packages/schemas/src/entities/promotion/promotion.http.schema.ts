import { z } from 'zod';
import { CreatePromotionSchema, UpdatePromotionSchema } from './promotion.crud.schema.js';
import {
    CheckPromotionOverlapSchema,
    GetActivePromotionsSchema,
    ListPromotionsSchema
} from './promotion.query.schema.js';

/**
 * HTTP Create Promotion Schema
 * Coerces and validates HTTP request data for creating promotions
 */
export const HttpCreatePromotionSchema = CreatePromotionSchema.extend({
    // HTTP coercion for dates
    startsAt: z.coerce.date({
        message: 'zodError.promotion.startsAt.required'
    }),
    endsAt: z.coerce.date({
        message: 'zodError.promotion.endsAt.required'
    }),

    // HTTP coercion for numbers
    maxTotalUsage: z.coerce
        .number()
        .int({ message: 'zodError.promotion.maxTotalUsage.int' })
        .positive({ message: 'zodError.promotion.maxTotalUsage.positive' })
        .optional(),

    // HTTP coercion for boolean
    isActive: z.coerce
        .boolean({
            message: 'zodError.promotion.isActive.required'
        })
        .default(true)
});

/**
 * HTTP Update Promotion Schema
 * Coerces and validates HTTP request data for updating promotions
 */
export const HttpUpdatePromotionSchema = UpdatePromotionSchema.extend({
    // HTTP coercion for dates
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),

    // HTTP coercion for numbers
    maxTotalUsage: z.coerce
        .number()
        .int({ message: 'zodError.promotion.maxTotalUsage.int' })
        .positive({ message: 'zodError.promotion.maxTotalUsage.positive' })
        .optional(),

    currentUsageCount: z.coerce
        .number()
        .int({ message: 'zodError.promotion.currentUsageCount.int' })
        .nonnegative({ message: 'zodError.promotion.currentUsageCount.nonnegative' })
        .optional(),

    // HTTP coercion for boolean
    isActive: z.coerce
        .boolean({
            message: 'zodError.promotion.isActive.required'
        })
        .optional()
});

/**
 * HTTP List Promotions Schema
 * Coerces and validates HTTP query parameters for listing promotions
 */
export const HttpListPromotionsSchema = ListPromotionsSchema.extend({
    // HTTP coercion for pagination
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10),

    // HTTP coercion for dates
    startsAfter: z.coerce.date().optional(),
    startsBefore: z.coerce.date().optional(),
    endsAfter: z.coerce.date().optional(),
    endsBefore: z.coerce.date().optional(),
    overlapsWithStart: z.coerce.date().optional(),
    overlapsWithEnd: z.coerce.date().optional(),
    createdFromDate: z.coerce.date().optional(),
    createdToDate: z.coerce.date().optional(),

    // HTTP coercion for numbers
    usageCountMin: z.coerce
        .number()
        .int({ message: 'zodError.promotion.usageCountMin.int' })
        .nonnegative({ message: 'zodError.promotion.usageCountMin.nonnegative' })
        .optional(),

    usageCountMax: z.coerce
        .number()
        .int({ message: 'zodError.promotion.usageCountMax.int' })
        .nonnegative({ message: 'zodError.promotion.usageCountMax.nonnegative' })
        .optional(),

    // HTTP coercion for booleans
    isActive: z.coerce.boolean().optional(),
    isCurrentlyValid: z.coerce.boolean().optional(),
    hasUsageLimit: z.coerce.boolean().optional(),
    isExhausted: z.coerce.boolean().optional(),
    hasTargetConditions: z.coerce.boolean().optional(),
    includeDeleted: z.coerce.boolean().default(false)
});

/**
 * HTTP Get Active Promotions Schema
 * Coerces and validates HTTP query parameters for getting active promotions
 */
export const HttpGetActivePromotionsSchema = GetActivePromotionsSchema.extend({
    // HTTP coercion for date
    checkDate: z.coerce.date().default(() => new Date()),

    // HTTP coercion for number
    limit: z.coerce
        .number()
        .int({ message: 'zodError.common.limit.int' })
        .positive({ message: 'zodError.common.limit.positive' })
        .max(100, { message: 'zodError.common.limit.max' })
        .default(10)
});

/**
 * HTTP Check Promotion Overlap Schema
 * Coerces and validates HTTP request data for checking promotion overlap
 */
export const HttpCheckPromotionOverlapSchema = CheckPromotionOverlapSchema.extend({
    // HTTP coercion for dates
    startsAt: z.coerce.date({
        message: 'zodError.promotion.startsAt.required'
    }),
    endsAt: z.coerce.date({
        message: 'zodError.promotion.endsAt.required'
    })
});

export type HttpCreatePromotion = z.infer<typeof HttpCreatePromotionSchema>;
export type HttpUpdatePromotion = z.infer<typeof HttpUpdatePromotionSchema>;
export type HttpListPromotions = z.infer<typeof HttpListPromotionsSchema>;
export type HttpGetActivePromotions = z.infer<typeof HttpGetActivePromotionsSchema>;
export type HttpCheckPromotionOverlap = z.infer<typeof HttpCheckPromotionOverlapSchema>;
