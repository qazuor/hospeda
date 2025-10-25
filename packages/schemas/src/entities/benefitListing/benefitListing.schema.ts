import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    BenefitListingIdSchema,
    BenefitListingPlanIdSchema,
    BenefitPartnerIdSchema,
    ClientIdSchema
} from '../../common/id.schema.js';
import { ListingStatusSchema } from '../../enums/index.js';

/**
 * Benefit Listing Schema
 *
 * Defines benefit listings offered by partners to platform users.
 * Includes listing status, trial periods, and benefit details.
 * Maps to BENEFIT_LISTING in the database diagram.
 */
export const BenefitListingSchema = z
    .object({
        // Base fields
        id: BenefitListingIdSchema,
        ...BaseAuditFields,

        // Relationship fields
        clientId: ClientIdSchema.describe('Client who owns this benefit listing'),
        benefitPartnerId: BenefitPartnerIdSchema.describe('Partner providing the benefit'),
        listingPlanId: BenefitListingPlanIdSchema.describe('Listing plan for this benefit'),

        // Listing status
        status: ListingStatusSchema.describe('Current listing status'),

        // Listing content
        title: z
            .string()
            .min(3, { message: 'zodError.benefitListing.title.tooShort' })
            .max(200, { message: 'zodError.benefitListing.title.tooLong' })
            .describe('Title of the benefit listing'),

        description: z
            .string()
            .min(10, { message: 'zodError.benefitListing.description.tooShort' })
            .max(2000, { message: 'zodError.benefitListing.description.tooLong' })
            .describe('Description of the benefit offering'),

        // Benefit details object matching database schema
        benefitDetails: z
            .object({
                discountPercent: z.number().min(0).max(100).optional(),
                discountAmount: z.number().min(0).optional(),
                freeItems: z.array(z.string()).optional(),
                specialOffers: z.array(z.string()).optional(),
                terms: z.array(z.string()).optional(),
                validDays: z.array(z.string()).optional(),
                validHours: z.string().optional()
            })
            .refine(
                (data) => {
                    // Must have some benefit configuration
                    return (
                        data.discountPercent !== undefined ||
                        data.discountAmount !== undefined ||
                        (data.freeItems && data.freeItems.length > 0) ||
                        (data.specialOffers && data.specialOffers.length > 0)
                    );
                },
                {
                    message: 'zodError.benefitListing.benefitDetails.missingBenefit'
                }
            )
            .describe('Structured benefit details'),

        // Trial information
        isTrialPeriod: z
            .boolean()
            .default(false)
            .describe('Whether this listing is on a trial period'),

        trialStartDate: z.coerce.date().optional().describe('Trial period start date'),

        trialEndDate: z.coerce.date().optional().describe('Trial period end date'),

        // Listing period
        startDate: z.coerce.date().describe('Start date for the benefit listing'),

        endDate: z.coerce
            .date()
            .optional()
            .describe('End date for the benefit listing (optional for permanent listings)'),

        // Additional metadata
        adminInfo: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Administrative information and internal notes')
    })
    .refine(
        (data) => {
            // Trial validation
            if (data.isTrialPeriod && !data.trialEndDate) {
                return false;
            }
            if (!data.isTrialPeriod && data.trialEndDate) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.benefitListing.trial.inconsistent',
            path: ['trialEndDate']
        }
    )
    .refine(
        (data) => {
            // Date range validation
            return !data.endDate || data.startDate <= data.endDate;
        },
        {
            message: 'zodError.benefitListing.dateRange.invalid',
            path: ['endDate']
        }
    )
    .refine(
        (data) => {
            // Trial date range validation
            if (data.trialStartDate && data.trialEndDate) {
                return data.trialStartDate <= data.trialEndDate;
            }
            return true;
        },
        {
            message: 'zodError.benefitListing.trialRange.invalid',
            path: ['trialEndDate']
        }
    );

export type BenefitListing = z.infer<typeof BenefitListingSchema>;

/**
 * Benefit Listing Schema without admin fields
 * Used for public API responses
 */
export const PublicBenefitListingSchema = BenefitListingSchema.omit({
    adminInfo: true,
    deletedAt: true,
    deletedById: true
});

export type PublicBenefitListing = z.infer<typeof PublicBenefitListingSchema>;

/**
 * Benefit Listing with Partner Information
 * Extended schema that includes partner details
 */
export const BenefitListingWithPartnerSchema = BenefitListingSchema.extend({
    benefitPartner: z
        .object({
            id: BenefitPartnerIdSchema,
            name: z.string(),
            category: z.string(),
            description: z.string().optional()
        })
        .optional()
});

export type BenefitListingWithPartner = z.infer<typeof BenefitListingWithPartnerSchema>;
