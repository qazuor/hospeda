import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ClientIdSchema, SponsorshipIdSchema } from '../../common/id.schema.js';
import { SponsorshipEntityTypeSchema, SponsorshipStatusSchema } from '../../enums/index.js';

/**
 * Sponsorship Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a Sponsorship entity
 * representing sponsored content with polymorphic target entities.
 */
export const SponsorshipSchema = z
    .object({
        // Base fields
        id: SponsorshipIdSchema,
        ...BaseAuditFields,

        // Sponsorship-specific core fields
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

        // Optional sponsorship details
        description: z
            .string()
            .min(1, { message: 'zodError.sponsorship.description.min' })
            .max(1000, { message: 'zodError.sponsorship.description.max' })
            .optional(),

        // Priority for sponsored content ordering
        priority: z
            .number()
            .int({ message: 'zodError.sponsorship.priority.int' })
            .min(0, { message: 'zodError.sponsorship.priority.min' })
            .max(100, { message: 'zodError.sponsorship.priority.max' })
            .default(50),

        // Budget and cost tracking
        budgetAmount: z
            .number()
            .int({ message: 'zodError.sponsorship.budgetAmount.int' })
            .nonnegative({ message: 'zodError.sponsorship.budgetAmount.nonnegative' })
            .optional(),

        spentAmount: z
            .number()
            .int({ message: 'zodError.sponsorship.spentAmount.int' })
            .nonnegative({ message: 'zodError.sponsorship.spentAmount.nonnegative' })
            .default(0),

        // Performance metrics
        impressionCount: z
            .number()
            .int({ message: 'zodError.sponsorship.impressionCount.int' })
            .nonnegative({ message: 'zodError.sponsorship.impressionCount.nonnegative' })
            .default(0),

        clickCount: z
            .number()
            .int({ message: 'zodError.sponsorship.clickCount.int' })
            .nonnegative({ message: 'zodError.sponsorship.clickCount.nonnegative' })
            .default(0)
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
    // Budget validation refinement
    .refine(
        (data) => {
            if (data.budgetAmount) {
                return data.spentAmount <= data.budgetAmount;
            }
            return true;
        },
        {
            message: 'zodError.sponsorship.budget.exceedsLimit',
            path: ['spentAmount']
        }
    )
    // Click tracking validation
    .refine(
        (data) => {
            return data.clickCount <= data.impressionCount;
        },
        {
            message: 'zodError.sponsorship.metrics.clicksExceedImpressions',
            path: ['clickCount']
        }
    );

export type Sponsorship = z.infer<typeof SponsorshipSchema>;
