import { z } from 'zod';
import {
    BenefitListingPlanIdSchema,
    BenefitPartnerIdSchema,
    ClientIdSchema
} from '../../common/id.schema.js';
import { ListingStatusSchema } from '../../enums/index.js';
import { BenefitListingSchema } from './benefitListing.schema.js';

/**
 * Create Benefit Listing Schema
 *
 * Schema for creating new benefit listings.
 * Excludes auto-generated fields and includes required relationships.
 */
export const CreateBenefitListingSchema = BenefitListingSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).extend({
    // Required relationship fields
    clientId: ClientIdSchema,
    benefitPartnerId: BenefitPartnerIdSchema,
    listingPlanId: BenefitListingPlanIdSchema,

    // Required dates
    fromDate: z.coerce.date(),

    // Benefit configuration is required on creation
    benefitConfiguration: z
        .object({
            discountPercentage: z.number().min(0).max(100).optional(),
            fixedDiscountAmount: z.number().min(0).optional(),
            currency: z.string().length(3).default('USD'),
            usageLimit: z.number().int().min(1).optional(),
            usagePerUserLimit: z.number().int().min(1).optional(),
            redemptionCode: z.string().max(50).optional(),
            termsAndConditions: z.string().max(2000).optional(),
            validFrom: z.coerce.date().optional(),
            validUntil: z.coerce.date().optional()
        })
        .refine(
            (data) => {
                return (
                    data.discountPercentage !== undefined || data.fixedDiscountAmount !== undefined
                );
            },
            {
                message: 'zodError.benefitListing.configuration.missingDiscount'
            }
        )
        .refine(
            (data) => {
                return !(
                    data.discountPercentage !== undefined && data.fixedDiscountAmount !== undefined
                );
            },
            {
                message: 'zodError.benefitListing.configuration.conflictingDiscount'
            }
        )
        .refine(
            (data) => {
                return !data.validFrom || !data.validUntil || data.validFrom <= data.validUntil;
            },
            {
                message: 'zodError.benefitListing.configuration.invalidDateRange'
            }
        )
});

export type CreateBenefitListing = z.infer<typeof CreateBenefitListingSchema>;

/**
 * Update Benefit Listing Schema
 *
 * Schema for updating existing benefit listings.
 * All fields are optional except those with business constraints.
 */
export const UpdateBenefitListingSchema = z.object({
    benefitPartnerId: BenefitPartnerIdSchema.optional(),
    listingPlanId: BenefitListingPlanIdSchema.optional(),

    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),

    trialEndsAt: z.coerce.date().optional(),
    isTrial: z.boolean().optional(),

    status: ListingStatusSchema.optional(),

    benefitDetails: z
        .string()
        .min(10, { message: 'zodError.benefitListing.benefitDetails.tooShort' })
        .max(5000, { message: 'zodError.benefitListing.benefitDetails.tooLong' })
        .optional(),

    benefitConfiguration: z
        .object({
            discountPercentage: z.number().min(0).max(100).optional(),
            fixedDiscountAmount: z.number().min(0).optional(),
            currency: z.string().length(3).optional(),
            usageLimit: z.number().int().min(1).optional(),
            usagePerUserLimit: z.number().int().min(1).optional(),
            redemptionCode: z.string().max(50).optional(),
            termsAndConditions: z.string().max(2000).optional(),
            validFrom: z.coerce.date().optional(),
            validUntil: z.coerce.date().optional()
        })
        .refine(
            (data) => {
                return !data.validFrom || !data.validUntil || data.validFrom <= data.validUntil;
            },
            {
                message: 'zodError.benefitListing.configuration.invalidDateRange'
            }
        )
        .optional(),

    adminInfo: z.record(z.string(), z.unknown()).optional()
});

export type UpdateBenefitListing = z.infer<typeof UpdateBenefitListingSchema>;

/**
 * Update Benefit Listing Status Schema
 *
 * Specialized schema for updating listing status.
 */
export const UpdateBenefitListingStatusSchema = z.object({
    status: ListingStatusSchema,
    adminInfo: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Optional admin notes about the status change')
});

export type UpdateBenefitListingStatus = z.infer<typeof UpdateBenefitListingStatusSchema>;

/**
 * Update Benefit Listing Trial Schema
 *
 * Specialized schema for managing trial periods.
 */
export const UpdateBenefitListingTrialSchema = z
    .object({
        isTrial: z.boolean(),
        trialEndsAt: z.coerce.date().optional(),
        status: ListingStatusSchema.optional(),
        adminInfo: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Optional admin notes about the trial change')
    })
    .refine(
        (data) => {
            // Trial validation
            if (data.isTrial && !data.trialEndsAt) {
                return false;
            }
            if (!data.isTrial && data.trialEndsAt) {
                return false;
            }
            return true;
        },
        {
            message: 'zodError.benefitListing.trial.inconsistent',
            path: ['trialEndsAt']
        }
    );

export type UpdateBenefitListingTrial = z.infer<typeof UpdateBenefitListingTrialSchema>;

/**
 * Update Benefit Configuration Schema
 *
 * Specialized schema for updating benefit configuration.
 */
export const UpdateBenefitConfigurationSchema = z.object({
    benefitConfiguration: z
        .object({
            discountPercentage: z.number().min(0).max(100).optional(),
            fixedDiscountAmount: z.number().min(0).optional(),
            currency: z.string().length(3).optional(),
            usageLimit: z.number().int().min(1).optional(),
            usagePerUserLimit: z.number().int().min(1).optional(),
            redemptionCode: z.string().max(50).optional(),
            termsAndConditions: z.string().max(2000).optional(),
            validFrom: z.coerce.date().optional(),
            validUntil: z.coerce.date().optional()
        })
        .refine(
            (data) => {
                return (
                    data.discountPercentage !== undefined || data.fixedDiscountAmount !== undefined
                );
            },
            {
                message: 'zodError.benefitListing.configuration.missingDiscount'
            }
        )
        .refine(
            (data) => {
                return !(
                    data.discountPercentage !== undefined && data.fixedDiscountAmount !== undefined
                );
            },
            {
                message: 'zodError.benefitListing.configuration.conflictingDiscount'
            }
        )
        .refine(
            (data) => {
                return !data.validFrom || !data.validUntil || data.validFrom <= data.validUntil;
            },
            {
                message: 'zodError.benefitListing.configuration.invalidDateRange'
            }
        ),

    adminInfo: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Optional admin notes about the configuration change')
});

export type UpdateBenefitConfiguration = z.infer<typeof UpdateBenefitConfigurationSchema>;
