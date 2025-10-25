import { z } from 'zod';
import { CreateDiscountCodeSchema, UpdateDiscountCodeSchema } from './discountCode.crud.schema.js';
import {
    GetDiscountCodeByCodeSchema,
    ListDiscountCodesSchema,
    ValidateDiscountCodeUsageSchema
} from './discountCode.query.schema.js';

/**
 * HTTP Create Discount Code Schema
 * Coerces and validates HTTP request data for creating discount codes
 */
export const HttpCreateDiscountCodeSchema = CreateDiscountCodeSchema.extend({
    // HTTP coercion for dates
    validFrom: z.coerce.date({
        message: 'zodError.discountCode.validFrom.required'
    }),
    validTo: z.coerce.date({
        message: 'zodError.discountCode.validTo.required'
    }),

    // HTTP coercion for numbers
    percentOff: z.coerce
        .number({
            message: 'zodError.discountCode.percentOff.required'
        })
        .min(0, { message: 'zodError.discountCode.percentOff.min' })
        .max(100, { message: 'zodError.discountCode.percentOff.max' })
        .optional(),

    amountOffMinor: z.coerce
        .number({
            message: 'zodError.discountCode.amountOffMinor.required'
        })
        .int({ message: 'zodError.discountCode.amountOffMinor.int' })
        .nonnegative({ message: 'zodError.discountCode.amountOffMinor.nonnegative' })
        .optional(),

    maxRedemptionsGlobal: z.coerce
        .number({
            message: 'zodError.discountCode.maxRedemptionsGlobal.required'
        })
        .int({ message: 'zodError.discountCode.maxRedemptionsGlobal.int' })
        .positive({ message: 'zodError.discountCode.maxRedemptionsGlobal.positive' })
        .optional(),

    maxRedemptionsPerUser: z.coerce
        .number({
            message: 'zodError.discountCode.maxRedemptionsPerUser.required'
        })
        .int({ message: 'zodError.discountCode.maxRedemptionsPerUser.int' })
        .positive({ message: 'zodError.discountCode.maxRedemptionsPerUser.positive' })
        .optional()
});

/**
 * HTTP Update Discount Code Schema
 * Coerces and validates HTTP request data for updating discount codes
 */
export const HttpUpdateDiscountCodeSchema = UpdateDiscountCodeSchema.extend({
    // HTTP coercion for dates
    validFrom: z.coerce.date().optional(),
    validTo: z.coerce.date().optional(),

    // HTTP coercion for numbers
    percentOff: z.coerce
        .number()
        .min(0, { message: 'zodError.discountCode.percentOff.min' })
        .max(100, { message: 'zodError.discountCode.percentOff.max' })
        .optional(),

    amountOffMinor: z.coerce
        .number()
        .int({ message: 'zodError.discountCode.amountOffMinor.int' })
        .nonnegative({ message: 'zodError.discountCode.amountOffMinor.nonnegative' })
        .optional(),

    maxRedemptionsGlobal: z.coerce
        .number()
        .int({ message: 'zodError.discountCode.maxRedemptionsGlobal.int' })
        .positive({ message: 'zodError.discountCode.maxRedemptionsGlobal.positive' })
        .optional(),

    maxRedemptionsPerUser: z.coerce
        .number()
        .int({ message: 'zodError.discountCode.maxRedemptionsPerUser.int' })
        .positive({ message: 'zodError.discountCode.maxRedemptionsPerUser.positive' })
        .optional(),

    usedCountGlobal: z.coerce
        .number()
        .int({ message: 'zodError.discountCode.usedCountGlobal.int' })
        .nonnegative({ message: 'zodError.discountCode.usedCountGlobal.nonnegative' })
        .optional()
});

/**
 * HTTP List Discount Codes Schema
 * Coerces and validates HTTP query parameters for listing discount codes
 */
export const HttpListDiscountCodesSchema = ListDiscountCodesSchema.extend({
    // HTTP coercion for pagination
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10),

    // HTTP coercion for dates
    validFromStart: z.coerce.date().optional(),
    validFromEnd: z.coerce.date().optional(),
    validToStart: z.coerce.date().optional(),
    validToEnd: z.coerce.date().optional(),
    createdFromDate: z.coerce.date().optional(),
    createdToDate: z.coerce.date().optional(),

    // HTTP coercion for numbers
    percentOffMin: z.coerce
        .number()
        .min(0, { message: 'zodError.discountCode.percentOffMin.min' })
        .max(100, { message: 'zodError.discountCode.percentOffMin.max' })
        .optional(),

    percentOffMax: z.coerce
        .number()
        .min(0, { message: 'zodError.discountCode.percentOffMax.min' })
        .max(100, { message: 'zodError.discountCode.percentOffMax.max' })
        .optional(),

    amountOffMinorMin: z.coerce
        .number()
        .int({ message: 'zodError.discountCode.amountOffMinorMin.int' })
        .nonnegative({ message: 'zodError.discountCode.amountOffMinorMin.nonnegative' })
        .optional(),

    amountOffMinorMax: z.coerce
        .number()
        .int({ message: 'zodError.discountCode.amountOffMinorMax.int' })
        .nonnegative({ message: 'zodError.discountCode.amountOffMinorMax.nonnegative' })
        .optional(),

    // HTTP coercion for booleans
    isValid: z.coerce.boolean().optional(),
    hasGlobalLimit: z.coerce.boolean().optional(),
    hasPerUserLimit: z.coerce.boolean().optional(),
    isExhausted: z.coerce.boolean().optional(),
    includeDeleted: z.coerce.boolean().default(false)
});

/**
 * HTTP Get Discount Code by Code Schema
 * Coerces and validates HTTP query parameters for getting discount code by code
 */
export const HttpGetDiscountCodeByCodeSchema = GetDiscountCodeByCodeSchema.extend({
    // HTTP coercion for boolean
    checkValidity: z.coerce.boolean().default(true)
});

/**
 * HTTP Validate Discount Code Usage Schema
 * Coerces and validates HTTP request data for validating discount code usage
 */
export const HttpValidateDiscountCodeUsageSchema = ValidateDiscountCodeUsageSchema.extend({
    // HTTP coercion for date
    usageDate: z.coerce.date().default(() => new Date())
});

export type HttpCreateDiscountCode = z.infer<typeof HttpCreateDiscountCodeSchema>;
export type HttpUpdateDiscountCode = z.infer<typeof HttpUpdateDiscountCodeSchema>;
export type HttpListDiscountCodes = z.infer<typeof HttpListDiscountCodesSchema>;
export type HttpGetDiscountCodeByCode = z.infer<typeof HttpGetDiscountCodeByCodeSchema>;
export type HttpValidateDiscountCodeUsage = z.infer<typeof HttpValidateDiscountCodeUsageSchema>;
