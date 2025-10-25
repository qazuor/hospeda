import { z } from 'zod';
import {
    CreateBenefitListingSchema,
    UpdateBenefitListingSchema
} from './benefitListing.crud.schema.js';
import { SearchBenefitListingsSchema } from './benefitListing.query.schema.js';

/**
 * HTTP Create Benefit Listing Schema
 *
 * Schema for HTTP requests to create benefit listings.
 * Includes proper coercion and validation for web forms.
 */
export const HttpCreateBenefitListingSchema = CreateBenefitListingSchema.extend({
    // Coerce boolean values
    isTrialPeriod: z
        .union([z.boolean(), z.string()])
        .transform((val) => {
            if (typeof val === 'string') {
                return val.toLowerCase() === 'true' || val === '1';
            }
            return val;
        })
        .default(false),

    // Coerce dates
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    trialStartDate: z.coerce.date().optional(),
    trialEndDate: z.coerce.date().optional()
});

export type HttpCreateBenefitListing = z.infer<typeof HttpCreateBenefitListingSchema>;

/**
 * HTTP Update Benefit Listing Schema
 *
 * Schema for HTTP requests to update benefit listings.
 */
export const HttpUpdateBenefitListingSchema = UpdateBenefitListingSchema.extend({
    // Coerce boolean values
    isTrialPeriod: z
        .union([z.boolean(), z.string()])
        .transform((val) => {
            if (typeof val === 'string') {
                return val.toLowerCase() === 'true' || val === '1';
            }
            return val;
        })
        .optional(),

    // Coerce dates
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    trialStartDate: z.coerce.date().optional(),
    trialEndDate: z.coerce.date().optional()
});

export type HttpUpdateBenefitListing = z.infer<typeof HttpUpdateBenefitListingSchema>;

/**
 * HTTP Search Benefit Listings Schema
 *
 * Schema for HTTP query parameters when searching benefit listings.
 */
export const HttpSearchBenefitListingsSchema = SearchBenefitListingsSchema.extend({
    // Coerce pagination values
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),

    // Coerce boolean filters
    isTrialPeriod: z
        .union([z.boolean(), z.string()])
        .transform((val) => {
            if (typeof val === 'string') {
                return val.toLowerCase() === 'true' || val === '1';
            }
            return val;
        })
        .optional(),

    // Coerce date filters
    startDateFrom: z.coerce.date().optional(),
    startDateTo: z.coerce.date().optional(),
    endDateFrom: z.coerce.date().optional(),
    endDateTo: z.coerce.date().optional(),

    // Comma-separated status values
    status: z
        .union([z.string(), z.array(z.string())])
        .transform((val) => {
            if (typeof val === 'string') {
                return val.split(',').filter(Boolean);
            }
            return val;
        })
        .optional()
});

export type HttpSearchBenefitListings = z.infer<typeof HttpSearchBenefitListingsSchema>;
