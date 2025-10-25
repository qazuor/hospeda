import { z } from 'zod';
import { PromotionIdSchema } from '../../common/id.schema.js';
import { PaginationSchema, SortingSchema } from '../../common/pagination.schema.js';

/**
 * Search Promotions Schema
 * Schema for filtering and searching promotions
 */
export const SearchPromotionsSchema = z
    .object({
        // Text search
        q: z
            .string()
            .min(1, { message: 'zodError.common.search.min' })
            .max(100, { message: 'zodError.common.search.max' })
            .optional(),

        // Filters by ID
        ids: z
            .array(PromotionIdSchema)
            .min(1, { message: 'zodError.common.ids.min' })
            .max(100, { message: 'zodError.common.ids.max' })
            .optional(),

        // Filter by name
        name: z
            .string()
            .min(1, { message: 'zodError.promotion.name.min' })
            .max(200, { message: 'zodError.promotion.name.max' })
            .optional(),

        // Filter by active status
        isActive: z
            .boolean({
                message: 'zodError.promotion.isActive.invalid'
            })
            .optional(),

        // Filter by current validity status
        isCurrentlyValid: z
            .boolean({
                message: 'zodError.promotion.isCurrentlyValid.invalid'
            })
            .optional(),

        // Filter by promotion period
        startsAfter: z
            .date({
                message: 'zodError.promotion.startsAfter.invalid'
            })
            .optional(),

        startsBefore: z
            .date({
                message: 'zodError.promotion.startsBefore.invalid'
            })
            .optional(),

        endsAfter: z
            .date({
                message: 'zodError.promotion.endsAfter.invalid'
            })
            .optional(),

        endsBefore: z
            .date({
                message: 'zodError.promotion.endsBefore.invalid'
            })
            .optional(),

        // Filter by overlapping date range
        overlapsWithStart: z
            .date({
                message: 'zodError.promotion.overlapsWithStart.invalid'
            })
            .optional(),

        overlapsWithEnd: z
            .date({
                message: 'zodError.promotion.overlapsWithEnd.invalid'
            })
            .optional(),

        // Filter by usage limits
        hasUsageLimit: z
            .boolean({
                message: 'zodError.promotion.hasUsageLimit.invalid'
            })
            .optional(),

        isExhausted: z
            .boolean({
                message: 'zodError.promotion.isExhausted.invalid'
            })
            .optional(),

        // Filter by usage count range
        usageCountMin: z
            .number()
            .int({ message: 'zodError.promotion.usageCountMin.int' })
            .nonnegative({ message: 'zodError.promotion.usageCountMin.nonnegative' })
            .optional(),

        usageCountMax: z
            .number()
            .int({ message: 'zodError.promotion.usageCountMax.int' })
            .nonnegative({ message: 'zodError.promotion.usageCountMax.nonnegative' })
            .optional(),

        // Filter by target conditions existence
        hasTargetConditions: z
            .boolean({
                message: 'zodError.promotion.hasTargetConditions.invalid'
            })
            .optional(),

        // Filter by creation date
        createdFromDate: z
            .date({
                message: 'zodError.common.createdFromDate.invalid'
            })
            .optional(),

        createdToDate: z
            .date({
                message: 'zodError.common.createdToDate.invalid'
            })
            .optional(),

        // Include soft deleted
        includeDeleted: z
            .boolean({
                message: 'zodError.common.includeDeleted.invalid'
            })
            .default(false)
    })
    // Date range validations
    .refine(
        (data) => {
            if (data.startsAfter && data.startsBefore) {
                return data.startsAfter <= data.startsBefore;
            }
            return true;
        },
        {
            message: 'zodError.promotion.startsDateRange.invalid',
            path: ['startsBefore']
        }
    )
    .refine(
        (data) => {
            if (data.endsAfter && data.endsBefore) {
                return data.endsAfter <= data.endsBefore;
            }
            return true;
        },
        {
            message: 'zodError.promotion.endsDateRange.invalid',
            path: ['endsBefore']
        }
    )
    .refine(
        (data) => {
            if (data.overlapsWithStart && data.overlapsWithEnd) {
                return data.overlapsWithStart <= data.overlapsWithEnd;
            }
            return true;
        },
        {
            message: 'zodError.promotion.overlapsDateRange.invalid',
            path: ['overlapsWithEnd']
        }
    )
    .refine(
        (data) => {
            if (data.usageCountMin && data.usageCountMax) {
                return data.usageCountMin <= data.usageCountMax;
            }
            return true;
        },
        {
            message: 'zodError.promotion.usageCountRange.invalid',
            path: ['usageCountMax']
        }
    )
    .refine(
        (data) => {
            if (data.createdFromDate && data.createdToDate) {
                return data.createdFromDate <= data.createdToDate;
            }
            return true;
        },
        {
            message: 'zodError.common.createdDateRange.invalid',
            path: ['createdToDate']
        }
    );

/**
 * List Promotions Schema
 * Combines search filters with pagination and sorting
 */
export const ListPromotionsSchema = SearchPromotionsSchema.merge(PaginationSchema).merge(
    SortingSchema.extend({
        sortBy: z
            .enum([
                'createdAt',
                'updatedAt',
                'name',
                'startsAt',
                'endsAt',
                'currentUsageCount',
                'maxTotalUsage'
            ])
            .default('createdAt')
    })
);

/**
 * Get Active Promotions Schema
 * Schema for retrieving currently active promotions
 */
export const GetActivePromotionsSchema = z.object({
    // Optional date to check for active status (defaults to now)
    checkDate: z
        .date({
            message: 'zodError.promotion.checkDate.invalid'
        })
        .default(() => new Date()),

    // Optional limit on results
    limit: z
        .number()
        .int({ message: 'zodError.common.limit.int' })
        .positive({ message: 'zodError.common.limit.positive' })
        .max(100, { message: 'zodError.common.limit.max' })
        .default(10)
});

/**
 * Check Promotion Overlap Schema
 * Schema for checking if a promotion overlaps with existing ones
 */
export const CheckPromotionOverlapSchema = z
    .object({
        startsAt: z.date({
            message: 'zodError.promotion.startsAt.required'
        }),

        endsAt: z.date({
            message: 'zodError.promotion.endsAt.required'
        }),

        // Optional promotion ID to exclude from overlap check (for updates)
        excludePromotionId: PromotionIdSchema.optional()
    })
    .refine(
        (data) => {
            return data.startsAt < data.endsAt;
        },
        {
            message: 'zodError.promotion.validDates.invalidRange',
            path: ['endsAt']
        }
    );

export type SearchPromotions = z.infer<typeof SearchPromotionsSchema>;
export type ListPromotions = z.infer<typeof ListPromotionsSchema>;
export type GetActivePromotions = z.infer<typeof GetActivePromotionsSchema>;
export type CheckPromotionOverlap = z.infer<typeof CheckPromotionOverlapSchema>;
