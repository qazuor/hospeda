import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { PromotionIdSchema } from '../../common/id.schema.js';

/**
 * Promotion Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a Promotion entity
 * representing marketing campaigns and promotional activities.
 */
export const PromotionSchema = z
    .object({
        // Base fields
        id: PromotionIdSchema,
        ...BaseAuditFields,

        // Promotion-specific core fields
        name: z
            .string({
                message: 'zodError.promotion.name.required'
            })
            .min(1, { message: 'zodError.promotion.name.min' })
            .max(200, { message: 'zodError.promotion.name.max' }),

        // Promotion rules and conditions
        rules: z
            .string({
                message: 'zodError.promotion.rules.required'
            })
            .min(1, { message: 'zodError.promotion.rules.min' })
            .max(2000, { message: 'zodError.promotion.rules.max' }),

        // Promotion validity period
        startsAt: z.date({
            message: 'zodError.promotion.startsAt.required'
        }),

        endsAt: z.date({
            message: 'zodError.promotion.endsAt.required'
        }),

        // Optional description
        description: z
            .string()
            .min(1, { message: 'zodError.promotion.description.min' })
            .max(1000, { message: 'zodError.promotion.description.max' })
            .nullable(),

        // Optional target conditions
        targetConditions: z.record(z.string(), z.any()).nullable(),

        // Optional usage metrics
        maxTotalUsage: z
            .number()
            .int({ message: 'zodError.promotion.maxTotalUsage.int' })
            .positive({ message: 'zodError.promotion.maxTotalUsage.positive' })
            .nullable(),

        currentUsageCount: z
            .number()
            .int({ message: 'zodError.promotion.currentUsageCount.int' })
            .nonnegative({ message: 'zodError.promotion.currentUsageCount.nonnegative' })
            .default(0),

        // Status flags
        isActive: z
            .boolean({
                message: 'zodError.promotion.isActive.required'
            })
            .default(true),

        // Admin metadata
        adminInfo: z.record(z.string(), z.unknown()).nullable()
    })
    // Date validation refinement
    .refine(
        (data) => {
            return data.startsAt < data.endsAt;
        },
        {
            message: 'zodError.promotion.validDates.invalidRange',
            path: ['endsAt']
        }
    )
    // Usage validation refinement
    .refine(
        (data) => {
            if (data.maxTotalUsage) {
                return data.currentUsageCount <= data.maxTotalUsage;
            }
            return true;
        },
        {
            message: 'zodError.promotion.usage.exceedsLimit',
            path: ['currentUsageCount']
        }
    );

export type Promotion = z.infer<typeof PromotionSchema>;
