import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';

/**
 * Create Promotion Schema
 * Schema for creating new promotions with date validation
 */
export const CreatePromotionSchema = z
    .object({
        // Audit fields for creation
        createdById: UserIdSchema,

        // Promotion core fields
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

        // Optional fields
        description: z
            .string()
            .min(1, { message: 'zodError.promotion.description.min' })
            .max(1000, { message: 'zodError.promotion.description.max' })
            .optional(),

        targetConditions: z.record(z.string(), z.any()).optional(),

        maxTotalUsage: z
            .number()
            .int({ message: 'zodError.promotion.maxTotalUsage.int' })
            .positive({ message: 'zodError.promotion.maxTotalUsage.positive' })
            .optional(),

        isActive: z
            .boolean({
                message: 'zodError.promotion.isActive.required'
            })
            .default(true)
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
    // Future start date validation
    .refine(
        (data) => {
            const now = new Date();
            return data.startsAt >= now;
        },
        {
            message: 'zodError.promotion.startsAt.pastDate',
            path: ['startsAt']
        }
    );

/**
 * Update Promotion Schema
 * Schema for updating existing promotions
 */
export const UpdatePromotionSchema = z
    .object({
        // Audit fields for updates
        updatedById: UserIdSchema,

        // Optional fields for updates
        name: z
            .string()
            .min(1, { message: 'zodError.promotion.name.min' })
            .max(200, { message: 'zodError.promotion.name.max' })
            .optional(),

        rules: z
            .string()
            .min(1, { message: 'zodError.promotion.rules.min' })
            .max(2000, { message: 'zodError.promotion.rules.max' })
            .optional(),

        description: z
            .string()
            .min(1, { message: 'zodError.promotion.description.min' })
            .max(1000, { message: 'zodError.promotion.description.max' })
            .optional(),

        // Date updates (can extend dates)
        startsAt: z.date().optional(),
        endsAt: z.date().optional(),

        targetConditions: z.record(z.string(), z.any()).optional(),

        maxTotalUsage: z
            .number()
            .int({ message: 'zodError.promotion.maxTotalUsage.int' })
            .positive({ message: 'zodError.promotion.maxTotalUsage.positive' })
            .optional(),

        currentUsageCount: z
            .number()
            .int({ message: 'zodError.promotion.currentUsageCount.int' })
            .nonnegative({ message: 'zodError.promotion.currentUsageCount.nonnegative' })
            .optional(),

        isActive: z
            .boolean({
                message: 'zodError.promotion.isActive.required'
            })
            .optional()
    })
    // Date validation for updates
    .refine(
        (data) => {
            if (data.startsAt && data.endsAt) {
                return data.startsAt < data.endsAt;
            }
            return true;
        },
        {
            message: 'zodError.promotion.validDates.invalidRange',
            path: ['endsAt']
        }
    )
    // Usage validation for updates
    .refine(
        (data) => {
            if (data.maxTotalUsage && data.currentUsageCount) {
                return data.currentUsageCount <= data.maxTotalUsage;
            }
            return true;
        },
        {
            message: 'zodError.promotion.usage.exceedsLimit',
            path: ['currentUsageCount']
        }
    );

export type CreatePromotion = z.infer<typeof CreatePromotionSchema>;
export type UpdatePromotion = z.infer<typeof UpdatePromotionSchema>;
