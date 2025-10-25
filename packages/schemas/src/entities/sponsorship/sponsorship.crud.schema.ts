import { z } from 'zod';
import { ClientIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { SponsorshipEntityTypeSchema, SponsorshipStatusSchema } from '../../enums/index.js';

/**
 * Create Sponsorship Schema
 * Schema for creating new sponsorships with polymorphic validation
 */
export const CreateSponsorshipSchema = z
    .object({
        // Audit fields for creation
        createdById: UserIdSchema,

        // Sponsorship core fields
        clientId: ClientIdSchema,

        // Polymorphic target entity
        entityType: SponsorshipEntityTypeSchema,
        entityId: z
            .string({
                message: 'zodError.sponsorship.entityId.required'
            })
            .uuid({ message: 'zodError.sponsorship.entityId.invalidUuid' }),

        // Sponsorship period
        fromDate: z.date({
            message: 'zodError.sponsorship.fromDate.required'
        }),

        toDate: z.date({
            message: 'zodError.sponsorship.toDate.required'
        }),

        // Sponsorship status
        status: SponsorshipStatusSchema,

        // Optional fields
        description: z
            .string()
            .min(1, { message: 'zodError.sponsorship.description.min' })
            .max(1000, { message: 'zodError.sponsorship.description.max' })
            .optional(),

        priority: z
            .number()
            .int({ message: 'zodError.sponsorship.priority.int' })
            .min(0, { message: 'zodError.sponsorship.priority.min' })
            .max(100, { message: 'zodError.sponsorship.priority.max' })
            .default(50),

        budgetAmount: z
            .number()
            .int({ message: 'zodError.sponsorship.budgetAmount.int' })
            .nonnegative({ message: 'zodError.sponsorship.budgetAmount.nonnegative' })
            .optional()
    })
    // Date validation refinement
    .refine(
        (data) => {
            return data.fromDate < data.toDate;
        },
        {
            message: 'zodError.sponsorship.validDates.invalidRange',
            path: ['toDate']
        }
    )
    // Future start date validation
    .refine(
        (data) => {
            const now = new Date();
            return data.fromDate >= now;
        },
        {
            message: 'zodError.sponsorship.fromDate.pastDate',
            path: ['fromDate']
        }
    );

/**
 * Update Sponsorship Schema
 * Schema for updating existing sponsorships
 */
export const UpdateSponsorshipSchema = z
    .object({
        // Audit fields for updates
        updatedById: UserIdSchema,

        // Optional fields for updates
        clientId: ClientIdSchema.optional(),

        // Polymorphic target entity (can be changed)
        entityType: SponsorshipEntityTypeSchema.optional(),
        entityId: z
            .string()
            .uuid({ message: 'zodError.sponsorship.entityId.invalidUuid' })
            .optional(),

        // Date updates (can extend dates)
        fromDate: z.date().optional(),
        toDate: z.date().optional(),

        // Status updates
        status: SponsorshipStatusSchema.optional(),

        description: z
            .string()
            .min(1, { message: 'zodError.sponsorship.description.min' })
            .max(1000, { message: 'zodError.sponsorship.description.max' })
            .optional(),

        priority: z
            .number()
            .int({ message: 'zodError.sponsorship.priority.int' })
            .min(0, { message: 'zodError.sponsorship.priority.min' })
            .max(100, { message: 'zodError.sponsorship.priority.max' })
            .optional(),

        budgetAmount: z
            .number()
            .int({ message: 'zodError.sponsorship.budgetAmount.int' })
            .nonnegative({ message: 'zodError.sponsorship.budgetAmount.nonnegative' })
            .optional(),

        spentAmount: z
            .number()
            .int({ message: 'zodError.sponsorship.spentAmount.int' })
            .nonnegative({ message: 'zodError.sponsorship.spentAmount.nonnegative' })
            .optional(),

        impressionCount: z
            .number()
            .int({ message: 'zodError.sponsorship.impressionCount.int' })
            .nonnegative({ message: 'zodError.sponsorship.impressionCount.nonnegative' })
            .optional(),

        clickCount: z
            .number()
            .int({ message: 'zodError.sponsorship.clickCount.int' })
            .nonnegative({ message: 'zodError.sponsorship.clickCount.nonnegative' })
            .optional()
    })
    // Date validation for updates
    .refine(
        (data) => {
            if (data.fromDate && data.toDate) {
                return data.fromDate < data.toDate;
            }
            return true;
        },
        {
            message: 'zodError.sponsorship.validDates.invalidRange',
            path: ['toDate']
        }
    )
    // Budget validation for updates
    .refine(
        (data) => {
            if (data.budgetAmount && data.spentAmount) {
                return data.spentAmount <= data.budgetAmount;
            }
            return true;
        },
        {
            message: 'zodError.sponsorship.budget.exceedsLimit',
            path: ['spentAmount']
        }
    )
    // Click tracking validation for updates
    .refine(
        (data) => {
            if (data.clickCount && data.impressionCount) {
                return data.clickCount <= data.impressionCount;
            }
            return true;
        },
        {
            message: 'zodError.sponsorship.metrics.clicksExceedImpressions',
            path: ['clickCount']
        }
    );

export type CreateSponsorship = z.infer<typeof CreateSponsorshipSchema>;
export type UpdateSponsorship = z.infer<typeof UpdateSponsorshipSchema>;
