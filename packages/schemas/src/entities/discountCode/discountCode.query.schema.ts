import { z } from 'zod';
import { DiscountCodeIdSchema, PromotionIdSchema } from '../../common/id.schema.js';
import { PaginationSchema, SortingSchema } from '../../common/pagination.schema.js';
import { DiscountTypeEnumSchema } from '../../enums/index.js';

/**
 * Search Discount Codes Schema
 * Schema for filtering and searching discount codes
 */
export const SearchDiscountCodesSchema = z
    .object({
        // Text search
        q: z
            .string()
            .min(1, { message: 'zodError.common.search.min' })
            .max(100, { message: 'zodError.common.search.max' })
            .optional(),

        // Filters by ID
        ids: z
            .array(DiscountCodeIdSchema)
            .min(1, { message: 'zodError.common.ids.min' })
            .max(100, { message: 'zodError.common.ids.max' })
            .optional(),

        // Filter by promotion
        promotionId: PromotionIdSchema.optional(),

        // Filter by discount type
        discountType: DiscountTypeEnumSchema.optional(),

        // Filter by code
        code: z
            .string()
            .min(1, { message: 'zodError.discountCode.code.min' })
            .max(50, { message: 'zodError.discountCode.code.max' })
            .optional(),

        // Filter by validity status
        isValid: z
            .boolean({
                message: 'zodError.discountCode.isValid.invalid'
            })
            .optional(),

        // Filter by validity date range
        validFromStart: z
            .date({
                message: 'zodError.discountCode.validFromStart.invalid'
            })
            .optional(),

        validFromEnd: z
            .date({
                message: 'zodError.discountCode.validFromEnd.invalid'
            })
            .optional(),

        validToStart: z
            .date({
                message: 'zodError.discountCode.validToStart.invalid'
            })
            .optional(),

        validToEnd: z
            .date({
                message: 'zodError.discountCode.validToEnd.invalid'
            })
            .optional(),

        // Filter by usage limits
        hasGlobalLimit: z
            .boolean({
                message: 'zodError.discountCode.hasGlobalLimit.invalid'
            })
            .optional(),

        hasPerUserLimit: z
            .boolean({
                message: 'zodError.discountCode.hasPerUserLimit.invalid'
            })
            .optional(),

        // Filter by usage status
        isExhausted: z
            .boolean({
                message: 'zodError.discountCode.isExhausted.invalid'
            })
            .optional(),

        // Filter by percentage range (for PERCENTAGE type)
        percentOffMin: z
            .number()
            .min(0, { message: 'zodError.discountCode.percentOffMin.min' })
            .max(100, { message: 'zodError.discountCode.percentOffMin.max' })
            .optional(),

        percentOffMax: z
            .number()
            .min(0, { message: 'zodError.discountCode.percentOffMax.min' })
            .max(100, { message: 'zodError.discountCode.percentOffMax.max' })
            .optional(),

        // Filter by amount range (for FIXED_AMOUNT type)
        amountOffMinorMin: z
            .number()
            .int({ message: 'zodError.discountCode.amountOffMinorMin.int' })
            .nonnegative({ message: 'zodError.discountCode.amountOffMinorMin.nonnegative' })
            .optional(),

        amountOffMinorMax: z
            .number()
            .int({ message: 'zodError.discountCode.amountOffMinorMax.int' })
            .nonnegative({ message: 'zodError.discountCode.amountOffMinorMax.nonnegative' })
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
            if (data.validFromStart && data.validFromEnd) {
                return data.validFromStart <= data.validFromEnd;
            }
            return true;
        },
        {
            message: 'zodError.discountCode.validFromRange.invalid',
            path: ['validFromEnd']
        }
    )
    .refine(
        (data) => {
            if (data.validToStart && data.validToEnd) {
                return data.validToStart <= data.validToEnd;
            }
            return true;
        },
        {
            message: 'zodError.discountCode.validToRange.invalid',
            path: ['validToEnd']
        }
    )
    .refine(
        (data) => {
            if (data.percentOffMin && data.percentOffMax) {
                return data.percentOffMin <= data.percentOffMax;
            }
            return true;
        },
        {
            message: 'zodError.discountCode.percentOffRange.invalid',
            path: ['percentOffMax']
        }
    )
    .refine(
        (data) => {
            if (data.amountOffMinorMin && data.amountOffMinorMax) {
                return data.amountOffMinorMin <= data.amountOffMinorMax;
            }
            return true;
        },
        {
            message: 'zodError.discountCode.amountOffRange.invalid',
            path: ['amountOffMinorMax']
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
 * List Discount Codes Schema
 * Combines search filters with pagination and sorting
 */
export const ListDiscountCodesSchema = SearchDiscountCodesSchema.merge(PaginationSchema).merge(
    SortingSchema.extend({
        sortBy: z
            .enum([
                'createdAt',
                'updatedAt',
                'code',
                'discountType',
                'validFrom',
                'validTo',
                'usedCountGlobal',
                'percentOff',
                'amountOffMinor'
            ])
            .default('createdAt')
    })
);

/**
 * Get Discount Code by Code Schema
 * Schema for retrieving a discount code by its unique code
 */
export const GetDiscountCodeByCodeSchema = z.object({
    code: z
        .string({
            message: 'zodError.discountCode.code.required'
        })
        .min(1, { message: 'zodError.discountCode.code.min' })
        .max(50, { message: 'zodError.discountCode.code.max' })
        .regex(/^[A-Z0-9_-]+$/, {
            message: 'zodError.discountCode.code.format'
        }),

    // Optional check for validity
    checkValidity: z
        .boolean({
            message: 'zodError.discountCode.checkValidity.invalid'
        })
        .default(true)
});

/**
 * Validate Discount Code Usage Schema
 * Schema for validating if a discount code can be used
 */
export const ValidateDiscountCodeUsageSchema = z.object({
    code: z
        .string({
            message: 'zodError.discountCode.code.required'
        })
        .min(1, { message: 'zodError.discountCode.code.min' })
        .max(50, { message: 'zodError.discountCode.code.max' }),

    // Client attempting to use the code
    clientId: z
        .string({
            message: 'zodError.common.clientId.required'
        })
        .uuid({ message: 'zodError.common.clientId.invalidUuid' }),

    // Optional usage date (defaults to now)
    usageDate: z
        .date({
            message: 'zodError.discountCode.usageDate.invalid'
        })
        .default(() => new Date())
});

export type SearchDiscountCodes = z.infer<typeof SearchDiscountCodesSchema>;
export type ListDiscountCodes = z.infer<typeof ListDiscountCodesSchema>;
export type GetDiscountCodeByCode = z.infer<typeof GetDiscountCodeByCodeSchema>;
export type ValidateDiscountCodeUsage = z.infer<typeof ValidateDiscountCodeUsageSchema>;
