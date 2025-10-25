import { z } from 'zod';
import { ClientIdSchema, SponsorshipIdSchema } from '../../common/id.schema.js';
import { PaginationSchema, SortingSchema } from '../../common/pagination.schema.js';
import { SponsorshipEntityTypeSchema, SponsorshipStatusSchema } from '../../enums/index.js';

/**
 * Search Sponsorships Schema
 * Schema for filtering and searching sponsorships with polymorphic support
 */
export const SearchSponsorshipsSchema = z
    .object({
        // Text search
        q: z
            .string()
            .min(1, { message: 'zodError.common.search.min' })
            .max(100, { message: 'zodError.common.search.max' })
            .optional(),

        // Filters by ID
        ids: z
            .array(SponsorshipIdSchema)
            .min(1, { message: 'zodError.common.ids.min' })
            .max(100, { message: 'zodError.common.ids.max' })
            .optional(),

        // Filter by client
        clientId: ClientIdSchema.optional(),
        clientIds: z
            .array(ClientIdSchema)
            .min(1, { message: 'zodError.common.clientIds.min' })
            .max(100, { message: 'zodError.common.clientIds.max' })
            .optional(),

        // Filter by polymorphic target entity
        entityType: SponsorshipEntityTypeSchema.optional(),
        entityId: z
            .string()
            .uuid({ message: 'zodError.sponsorship.entityId.invalidUuid' })
            .optional(),
        entityIds: z
            .array(z.string().uuid())
            .min(1, { message: 'zodError.common.entityIds.min' })
            .max(100, { message: 'zodError.common.entityIds.max' })
            .optional(),

        // Filter by status
        status: SponsorshipStatusSchema.optional(),
        statuses: z
            .array(SponsorshipStatusSchema)
            .min(1, { message: 'zodError.common.statuses.min' })
            .max(10, { message: 'zodError.common.statuses.max' })
            .optional(),

        // Filter by current activity status
        isCurrentlyActive: z
            .boolean({
                message: 'zodError.sponsorship.isCurrentlyActive.invalid'
            })
            .optional(),

        // Filter by sponsorship period
        startsAfter: z
            .date({
                message: 'zodError.sponsorship.startsAfter.invalid'
            })
            .optional(),

        startsBefore: z
            .date({
                message: 'zodError.sponsorship.startsBefore.invalid'
            })
            .optional(),

        endsAfter: z
            .date({
                message: 'zodError.sponsorship.endsAfter.invalid'
            })
            .optional(),

        endsBefore: z
            .date({
                message: 'zodError.sponsorship.endsBefore.invalid'
            })
            .optional(),

        // Filter by overlapping date range
        overlapsWithStart: z
            .date({
                message: 'zodError.sponsorship.overlapsWithStart.invalid'
            })
            .optional(),

        overlapsWithEnd: z
            .date({
                message: 'zodError.sponsorship.overlapsWithEnd.invalid'
            })
            .optional(),

        // Filter by priority range
        priorityMin: z
            .number()
            .int({ message: 'zodError.sponsorship.priorityMin.int' })
            .min(0, { message: 'zodError.sponsorship.priorityMin.min' })
            .max(100, { message: 'zodError.sponsorship.priorityMin.max' })
            .optional(),

        priorityMax: z
            .number()
            .int({ message: 'zodError.sponsorship.priorityMax.int' })
            .min(0, { message: 'zodError.sponsorship.priorityMax.min' })
            .max(100, { message: 'zodError.sponsorship.priorityMax.max' })
            .optional(),

        // Filter by budget range
        budgetMin: z
            .number()
            .int({ message: 'zodError.sponsorship.budgetMin.int' })
            .nonnegative({ message: 'zodError.sponsorship.budgetMin.nonnegative' })
            .optional(),

        budgetMax: z
            .number()
            .int({ message: 'zodError.sponsorship.budgetMax.int' })
            .nonnegative({ message: 'zodError.sponsorship.budgetMax.nonnegative' })
            .optional(),

        // Filter by budget usage
        hasBudget: z
            .boolean({
                message: 'zodError.sponsorship.hasBudget.invalid'
            })
            .optional(),

        isOverBudget: z
            .boolean({
                message: 'zodError.sponsorship.isOverBudget.invalid'
            })
            .optional(),

        // Filter by performance metrics
        impressionCountMin: z
            .number()
            .int({ message: 'zodError.sponsorship.impressionCountMin.int' })
            .nonnegative({ message: 'zodError.sponsorship.impressionCountMin.nonnegative' })
            .optional(),

        impressionCountMax: z
            .number()
            .int({ message: 'zodError.sponsorship.impressionCountMax.int' })
            .nonnegative({ message: 'zodError.sponsorship.impressionCountMax.nonnegative' })
            .optional(),

        clickCountMin: z
            .number()
            .int({ message: 'zodError.sponsorship.clickCountMin.int' })
            .nonnegative({ message: 'zodError.sponsorship.clickCountMin.nonnegative' })
            .optional(),

        clickCountMax: z
            .number()
            .int({ message: 'zodError.sponsorship.clickCountMax.int' })
            .nonnegative({ message: 'zodError.sponsorship.clickCountMax.nonnegative' })
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
            message: 'zodError.sponsorship.startsDateRange.invalid',
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
            message: 'zodError.sponsorship.endsDateRange.invalid',
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
            message: 'zodError.sponsorship.overlapsDateRange.invalid',
            path: ['overlapsWithEnd']
        }
    )
    .refine(
        (data) => {
            if (data.priorityMin && data.priorityMax) {
                return data.priorityMin <= data.priorityMax;
            }
            return true;
        },
        {
            message: 'zodError.sponsorship.priorityRange.invalid',
            path: ['priorityMax']
        }
    )
    .refine(
        (data) => {
            if (data.budgetMin && data.budgetMax) {
                return data.budgetMin <= data.budgetMax;
            }
            return true;
        },
        {
            message: 'zodError.sponsorship.budgetRange.invalid',
            path: ['budgetMax']
        }
    )
    .refine(
        (data) => {
            if (data.impressionCountMin && data.impressionCountMax) {
                return data.impressionCountMin <= data.impressionCountMax;
            }
            return true;
        },
        {
            message: 'zodError.sponsorship.impressionCountRange.invalid',
            path: ['impressionCountMax']
        }
    )
    .refine(
        (data) => {
            if (data.clickCountMin && data.clickCountMax) {
                return data.clickCountMin <= data.clickCountMax;
            }
            return true;
        },
        {
            message: 'zodError.sponsorship.clickCountRange.invalid',
            path: ['clickCountMax']
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
 * List Sponsorships Schema
 * Combines search filters with pagination and sorting
 */
export const ListSponsorshipsSchema = SearchSponsorshipsSchema.merge(PaginationSchema).merge(
    SortingSchema.extend({
        sortBy: z
            .enum([
                'createdAt',
                'updatedAt',
                'fromDate',
                'toDate',
                'priority',
                'budgetAmount',
                'spentAmount',
                'impressionCount',
                'clickCount',
                'status'
            ])
            .default('createdAt')
    })
);

/**
 * Get Active Sponsorships Schema
 * Schema for retrieving currently active sponsorships for specific entities
 */
export const GetActiveSponsorshipsSchema = z.object({
    // Optional entity filters
    entityType: SponsorshipEntityTypeSchema.optional(),
    entityId: z.string().uuid({ message: 'zodError.sponsorship.entityId.invalidUuid' }).optional(),
    entityIds: z
        .array(z.string().uuid())
        .min(1, { message: 'zodError.common.entityIds.min' })
        .max(100, { message: 'zodError.common.entityIds.max' })
        .optional(),

    // Optional date to check for active status (defaults to now)
    checkDate: z
        .date({
            message: 'zodError.sponsorship.checkDate.invalid'
        })
        .default(() => new Date()),

    // Optional priority threshold
    minPriority: z
        .number()
        .int({ message: 'zodError.sponsorship.minPriority.int' })
        .min(0, { message: 'zodError.sponsorship.minPriority.min' })
        .max(100, { message: 'zodError.sponsorship.minPriority.max' })
        .optional(),

    // Optional limit on results
    limit: z
        .number()
        .int({ message: 'zodError.common.limit.int' })
        .positive({ message: 'zodError.common.limit.positive' })
        .max(100, { message: 'zodError.common.limit.max' })
        .default(10)
});

/**
 * Get Sponsorship Analytics Schema
 * Schema for retrieving sponsorship performance analytics
 */
export const GetSponsorshipAnalyticsSchema = z
    .object({
        // Optional filters
        clientId: ClientIdSchema.optional(),
        entityType: SponsorshipEntityTypeSchema.optional(),

        // Date range for analytics
        fromDate: z.date({
            message: 'zodError.sponsorship.fromDate.required'
        }),

        toDate: z.date({
            message: 'zodError.sponsorship.toDate.required'
        }),

        // Metrics to include
        includeMetrics: z
            .array(z.enum(['impressions', 'clicks', 'budget', 'performance']))
            .default(['impressions', 'clicks', 'budget'])
    })
    .refine(
        (data) => {
            return data.fromDate <= data.toDate;
        },
        {
            message: 'zodError.sponsorship.validDates.invalidRange',
            path: ['toDate']
        }
    );

export type SearchSponsorships = z.infer<typeof SearchSponsorshipsSchema>;
export type ListSponsorships = z.infer<typeof ListSponsorshipsSchema>;
export type GetActiveSponsorships = z.infer<typeof GetActiveSponsorshipsSchema>;
export type GetSponsorshipAnalytics = z.infer<typeof GetSponsorshipAnalyticsSchema>;
