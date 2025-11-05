import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    ClientIdSchema,
    ServiceListingIdSchema,
    ServiceListingPlanIdSchema,
    TouristServiceIdSchema
} from '../../common/id.schema.js';
import { ServiceListingStatusSchema } from '../../enums/service-listing-status.schema.js';

/**
 * Schedule details schema for scheduled availability
 */
export const ScheduleDetailsSchema = z.object({
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
    timeSlots: z
        .array(
            z.object({
                startTime: z.string(),
                endTime: z.string()
            })
        )
        .optional(),
    exceptions: z
        .array(
            z.object({
                date: z.string().datetime(),
                reason: z.string()
            })
        )
        .optional()
});

/**
 * Booking settings schema
 */
export const BookingSettingsSchema = z.object({
    advanceBookingDays: z.number().min(0).optional(),
    cancellationPolicy: z.string().optional(),
    minParticipants: z.number().min(1).optional(),
    maxParticipants: z.number().optional(),
    instantBooking: z.boolean().default(false)
});

/**
 * Media details schema
 */
export const MediaDetailsSchema = z.object({
    images: z.array(z.string().url()).optional(),
    videos: z.array(z.string().url()).optional(),
    coverImage: z.string().url().optional()
});

/**
 * Translation schema for multilingual content
 */
export const TranslationSchema = z.object({
    locale: z.string(),
    title: z.string(),
    description: z.string().optional()
});

/**
 * SEO schema
 */
export const SEOSchema = z.object({
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    keywords: z.array(z.string()).optional()
});

/**
 * Special offer schema
 */
export const SpecialOfferSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    discountPercentage: z.number().min(0).max(100).optional(),
    validFrom: z.string().datetime(),
    validTo: z.string().datetime()
});

/**
 * Complete listing details schema (JSONB field)
 */
export const ListingDetailsSchema = z.object({
    availabilityType: z.enum(['scheduled', 'on-demand', 'seasonal']).optional(),
    scheduleDetails: ScheduleDetailsSchema.optional(),
    bookingSettings: BookingSettingsSchema.optional(),
    media: MediaDetailsSchema.optional(),
    translations: z.array(TranslationSchema).optional(),
    seo: SEOSchema.optional(),
    highlights: z.array(z.string()).optional(),
    amenities: z.array(z.string()).optional(),
    inclusions: z.array(z.string()).optional(),
    exclusions: z.array(z.string()).optional(),
    additionalInfo: z.string().optional(),
    specialOffers: z.array(SpecialOfferSchema).optional()
});

/**
 * Main ServiceListing schema
 */
export const ServiceListingSchema = z.object({
    id: ServiceListingIdSchema,
    ...BaseAuditFields,
    clientId: ClientIdSchema,
    touristServiceId: TouristServiceIdSchema,
    listingPlanId: ServiceListingPlanIdSchema,
    title: z
        .string({
            message: 'zodError.serviceListing.title.required'
        })
        .min(3, { message: 'zodError.serviceListing.title.min' })
        .max(200, { message: 'zodError.serviceListing.title.max' }),
    description: z
        .string({
            message: 'zodError.serviceListing.description.required'
        })
        .min(10, { message: 'zodError.serviceListing.description.min' })
        .max(2000, { message: 'zodError.serviceListing.description.max' })
        .optional(),
    basePrice: z
        .number({
            message: 'zodError.serviceListing.basePrice.required'
        })
        .min(0, { message: 'zodError.serviceListing.basePrice.min' })
        .optional(),
    listingDetails: ListingDetailsSchema.optional(),
    status: ServiceListingStatusSchema.default('draft'),
    isActive: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    isTrialListing: z.boolean().default(false),
    trialStartDate: z.coerce.date().optional().nullable(),
    trialEndDate: z.coerce.date().optional().nullable(),
    publishedAt: z.coerce.date().optional().nullable(),
    expiresAt: z.coerce.date().optional().nullable(),
    ...BaseAdminFields
});

export type ServiceListing = z.infer<typeof ServiceListingSchema>;
export type ListingDetails = z.infer<typeof ListingDetailsSchema>;
export type ScheduleDetails = z.infer<typeof ScheduleDetailsSchema>;
export type BookingSettings = z.infer<typeof BookingSettingsSchema>;
export type MediaDetails = z.infer<typeof MediaDetailsSchema>;
export type Translation = z.infer<typeof TranslationSchema>;
export type SEO = z.infer<typeof SEOSchema>;
export type SpecialOffer = z.infer<typeof SpecialOfferSchema>;
