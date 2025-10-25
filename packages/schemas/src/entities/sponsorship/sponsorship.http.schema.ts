import { z } from 'zod';
import { CreateSponsorshipSchema, UpdateSponsorshipSchema } from './sponsorship.crud.schema.js';
import {
    GetActiveSponsorshipsSchema,
    GetSponsorshipAnalyticsSchema,
    ListSponsorshipsSchema
} from './sponsorship.query.schema.js';

/**
 * HTTP Create Sponsorship Schema
 * Coerces and validates HTTP request data for creating sponsorships
 */
export const HttpCreateSponsorshipSchema = CreateSponsorshipSchema.extend({
    // HTTP coercion for dates
    fromDate: z.coerce.date({
        message: 'zodError.sponsorship.fromDate.required'
    }),
    toDate: z.coerce.date({
        message: 'zodError.sponsorship.toDate.required'
    }),

    // HTTP coercion for numbers
    priority: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.priority.int' })
        .min(0, { message: 'zodError.sponsorship.priority.min' })
        .max(100, { message: 'zodError.sponsorship.priority.max' })
        .default(50),

    budgetAmount: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.budgetAmount.int' })
        .nonnegative({ message: 'zodError.sponsorship.budgetAmount.nonnegative' })
        .optional()
});

/**
 * HTTP Update Sponsorship Schema
 * Coerces and validates HTTP request data for updating sponsorships
 */
export const HttpUpdateSponsorshipSchema = UpdateSponsorshipSchema.extend({
    // HTTP coercion for dates
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),

    // HTTP coercion for numbers
    priority: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.priority.int' })
        .min(0, { message: 'zodError.sponsorship.priority.min' })
        .max(100, { message: 'zodError.sponsorship.priority.max' })
        .optional(),

    budgetAmount: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.budgetAmount.int' })
        .nonnegative({ message: 'zodError.sponsorship.budgetAmount.nonnegative' })
        .optional(),

    spentAmount: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.spentAmount.int' })
        .nonnegative({ message: 'zodError.sponsorship.spentAmount.nonnegative' })
        .optional(),

    impressionCount: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.impressionCount.int' })
        .nonnegative({ message: 'zodError.sponsorship.impressionCount.nonnegative' })
        .optional(),

    clickCount: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.clickCount.int' })
        .nonnegative({ message: 'zodError.sponsorship.clickCount.nonnegative' })
        .optional()
});

/**
 * HTTP List Sponsorships Schema
 * Coerces and validates HTTP query parameters for listing sponsorships
 */
export const HttpListSponsorshipsSchema = ListSponsorshipsSchema.extend({
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
    priorityMin: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.priorityMin.int' })
        .min(0, { message: 'zodError.sponsorship.priorityMin.min' })
        .max(100, { message: 'zodError.sponsorship.priorityMin.max' })
        .optional(),

    priorityMax: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.priorityMax.int' })
        .min(0, { message: 'zodError.sponsorship.priorityMax.min' })
        .max(100, { message: 'zodError.sponsorship.priorityMax.max' })
        .optional(),

    budgetMin: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.budgetMin.int' })
        .nonnegative({ message: 'zodError.sponsorship.budgetMin.nonnegative' })
        .optional(),

    budgetMax: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.budgetMax.int' })
        .nonnegative({ message: 'zodError.sponsorship.budgetMax.nonnegative' })
        .optional(),

    impressionCountMin: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.impressionCountMin.int' })
        .nonnegative({ message: 'zodError.sponsorship.impressionCountMin.nonnegative' })
        .optional(),

    impressionCountMax: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.impressionCountMax.int' })
        .nonnegative({ message: 'zodError.sponsorship.impressionCountMax.nonnegative' })
        .optional(),

    clickCountMin: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.clickCountMin.int' })
        .nonnegative({ message: 'zodError.sponsorship.clickCountMin.nonnegative' })
        .optional(),

    clickCountMax: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.clickCountMax.int' })
        .nonnegative({ message: 'zodError.sponsorship.clickCountMax.nonnegative' })
        .optional(),

    // HTTP coercion for booleans
    isCurrentlyActive: z.coerce.boolean().optional(),
    hasBudget: z.coerce.boolean().optional(),
    isOverBudget: z.coerce.boolean().optional(),
    includeDeleted: z.coerce.boolean().default(false)
});

/**
 * HTTP Get Active Sponsorships Schema
 * Coerces and validates HTTP query parameters for getting active sponsorships
 */
export const HttpGetActiveSponsorshipsSchema = GetActiveSponsorshipsSchema.extend({
    // HTTP coercion for date
    checkDate: z.coerce.date().default(() => new Date()),

    // HTTP coercion for numbers
    minPriority: z.coerce
        .number()
        .int({ message: 'zodError.sponsorship.minPriority.int' })
        .min(0, { message: 'zodError.sponsorship.minPriority.min' })
        .max(100, { message: 'zodError.sponsorship.minPriority.max' })
        .optional(),

    limit: z.coerce
        .number()
        .int({ message: 'zodError.common.limit.int' })
        .positive({ message: 'zodError.common.limit.positive' })
        .max(100, { message: 'zodError.common.limit.max' })
        .default(10)
});

/**
 * HTTP Get Sponsorship Analytics Schema
 * Coerces and validates HTTP query parameters for sponsorship analytics
 */
export const HttpGetSponsorshipAnalyticsSchema = GetSponsorshipAnalyticsSchema.extend({
    // HTTP coercion for dates
    fromDate: z.coerce.date({
        message: 'zodError.sponsorship.fromDate.required'
    }),
    toDate: z.coerce.date({
        message: 'zodError.sponsorship.toDate.required'
    })
});

export type HttpCreateSponsorship = z.infer<typeof HttpCreateSponsorshipSchema>;
export type HttpUpdateSponsorship = z.infer<typeof HttpUpdateSponsorshipSchema>;
export type HttpListSponsorships = z.infer<typeof HttpListSponsorshipsSchema>;
export type HttpGetActiveSponsorships = z.infer<typeof HttpGetActiveSponsorshipsSchema>;
export type HttpGetSponsorshipAnalytics = z.infer<typeof HttpGetSponsorshipAnalyticsSchema>;
