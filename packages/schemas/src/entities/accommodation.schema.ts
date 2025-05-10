import { z } from 'zod';
import {
    AdminInfoSchema,
    BaseEntitySchema,
    BasePriceSchema,
    ContactInfoSchema,
    LocationSchema,
    MediaSchema,
    SeoSchema,
    SocialNetworkSchema
} from '../common.schema';
import { AccommodationTypeEnumSchema, AmenitiesTypeEnumSchema } from '../enums.schema';

/**
 * Schema for additional custom fees (defined by host).
 */
export const OtherAdditionalFeesSchema = z.object({
    name: z.string().min(1),
    displayName: z.string().min(1),
    value: z.number().nonnegative()
});

/**
 * Schema for custom discounts (e.g. seasonal or user-defined).
 */
export const OtherDiscountSchema = z.object({
    name: z.string().min(1),
    displayName: z.string().min(1),
    value: z.number().nonnegative()
});

/**
 * Schema for optional additional charges beyond the base price.
 */
export const AdditionalFeesSchema = z.object({
    cleaning: z.number().nonnegative().optional(),
    taxPercent: z.number().min(0).max(100).optional(),
    lateCheckout: z.number().nonnegative().optional(),
    others: z.array(OtherAdditionalFeesSchema).optional()
});

/**
 * Schema for optional discounts applied to bookings.
 */
export const DiscountsSchema = z.object({
    weekly: z.number().min(0).max(100).optional(),
    monthly: z.number().min(0).max(100).optional(),
    lastMinute: z.number().min(0).max(100).optional(),
    others: z.array(OtherDiscountSchema).optional()
});

/**
 * Full pricing configuration for a listing.
 */
export const AccommodationPriceSchema = z.object({
    basePrice: BasePriceSchema,
    additionalFees: AdditionalFeesSchema.optional(),
    discounts: DiscountsSchema.optional()
});

/**
 * Schema for defining a single amenity.
 */
export const AmenitySchema = z.object({
    name: z.string().min(1),
    displayName: z.string().min(1),
    optional: z.boolean(),
    additionalCost: BasePriceSchema.optional(),
    additionalCostPercent: z.number().min(0).max(100).optional(),
    description: z.string().min(1),
    type: AmenitiesTypeEnumSchema.optional()
});

/**
 * Ratings across multiple criteria submitted by users.
 */
export const RatingSchema = z.object({
    cleanliness: z.number().min(0).max(5),
    hospitality: z.number().min(0).max(5),
    services: z.number().min(0).max(5),
    accuracy: z.number().min(0).max(5),
    communication: z.number().min(0).max(5),
    location: z.number().min(0).max(5)
});

/**
 * Configuration for check-in, check-out, and related options.
 */
export const ScheduleSchema = z.object({
    checkinTime: z.string().optional(), // format "HH:mm"
    checkoutTime: z.string().optional(),
    lateCheckout: z.boolean(),
    lateCheckoutTime: z.string().optional(),
    selfCheckin: z.boolean(),
    selfCheckout: z.boolean()
});

/**
 * Physical characteristics and rules of the accommodation.
 */
export const ExtraInfoSchema = z.object({
    capacity: z.number().min(1),
    minNights: z.number().min(1),
    maxNights: z.number().min(1).optional(),
    bedrooms: z.number().min(0),
    beds: z.number().min(0).optional(),
    bathrooms: z.number().min(0),
    petFriendly: z.boolean().optional(),
    smokingAllowed: z.boolean().optional(),
    extraRules: z.array(z.string()).optional()
});

/**
 * A single user review with ratings.
 */
export const ReviewSchema = z.object({
    author: z.string().uuid(), // user ID
    title: z.string().min(1),
    content: z.string().min(1),
    rating: RatingSchema
});

/**
 * FAQ entry specific to an accommodation.
 */
export const AccommodationFaqSchema = BaseEntitySchema.extend({
    question: z.string().min(1),
    answer: z.string().min(1),
    adminInfo: AdminInfoSchema.optional()
});

/**
 * IA-generated or AI-augmented content block for a listing.
 */
export const AccommodationIaDataSchema = BaseEntitySchema.extend({
    title: z.string().min(1),
    content: z.string().min(1),
    adminInfo: AdminInfoSchema.optional()
});

/**
 * Complete schema for an accommodation listing.
 */
export const AccommodationSchema = BaseEntitySchema.extend({
    slug: z.string().min(1),
    type: AccommodationTypeEnumSchema,
    description: z.string().min(1),
    contactInfo: ContactInfoSchema,
    socialNetworks: SocialNetworkSchema,
    price: AccommodationPriceSchema,
    ownerId: z.string().uuid(),
    location: LocationSchema,
    features: z.array(z.string()),
    amenities: z.array(AmenitySchema),
    media: MediaSchema,
    rating: RatingSchema,
    reviews: z.array(ReviewSchema),
    schedule: ScheduleSchema,
    extraInfo: ExtraInfoSchema,
    isFeatured: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    seo: SeoSchema.optional(),
    adminInfo: AdminInfoSchema.optional(),
    faqs: z.array(AccommodationFaqSchema).optional(),
    iaData: z.array(AccommodationIaDataSchema).optional()
});
