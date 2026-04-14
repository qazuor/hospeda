import { z } from 'zod';
import { AmenityAdminSchema, AmenityProtectedSchema } from '../amenity/amenity.access.schema.js';
import {
    DestinationAdminSchema,
    DestinationProtectedSchema,
    DestinationPublicSchema
} from '../destination/destination.access.schema.js';
import { FeatureAdminSchema, FeatureProtectedSchema } from '../feature/feature.access.schema.js';
import { UserAdminSchema, UserProtectedSchema } from '../user/user.access.schema.js';
import { AccommodationSchema } from './accommodation.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const AccommodationPublicSchema = AccommodationSchema.pick({
    // Identification
    id: true,
    slug: true,
    name: true,
    type: true,

    // Content
    summary: true,
    description: true,
    isFeatured: true,

    // Destination reference
    destinationId: true,

    // Media (public safe)
    media: true,

    // Location (nested object with state, country, coordinates)
    location: true,

    // Review aggregates (public)
    averageRating: true,
    reviewsCount: true,

    // Visibility
    visibility: true,

    // SEO (public)
    seo: true,

    // Price (public)
    price: true,

    // Tags (public)
    tags: true,

    // Extra Info (public)
    extraInfo: true
}).extend({
    /** ISO 8601 creation date (for "Nuevo" badge: < 30 days). */
    createdAt: z.string().optional(),
    /** Public owner data from users table JOIN. No sensitive fields. */
    owner: z
        .object({
            id: z.string().uuid(),
            name: z.string(),
            image: z.string().nullable(),
            createdAt: z.string()
        })
        .optional(),
    /** Amenities with junction table data from r_accommodation_amenity. */
    amenities: z
        .array(
            z.object({
                amenityId: z.string().uuid(),
                name: z.string(),
                icon: z.string().nullable(),
                isOptional: z.boolean(),
                additionalCost: z.number().nullable()
            })
        )
        .optional(),
    /** Features with junction table data from r_accommodation_feature. */
    features: z
        .array(
            z.object({
                featureId: z.string().uuid(),
                name: z.string(),
                icon: z.string().nullable(),
                hostReWriteName: z.string().nullable(),
                comments: z.string().nullable()
            })
        )
        .optional(),
    /** Active FAQs only (lifecycleState = 'ACTIVE', deletedAt IS NULL). */
    faqs: z
        .array(
            z.object({
                id: z.string().uuid(),
                question: z.string(),
                answer: z.string(),
                category: z.string().nullable()
            })
        )
        .optional(),
    /** Destination data from destinations table JOIN (public tier). */
    destination: DestinationPublicSchema.optional()
});

export type AccommodationPublic = z.infer<typeof AccommodationPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including contact info and ownership.
 * Used for user dashboards, owner views, and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const AccommodationProtectedSchema = AccommodationSchema.pick({
    // All public fields
    id: true,
    slug: true,
    name: true,
    type: true,
    summary: true,
    description: true,
    isFeatured: true,
    destinationId: true,
    media: true,
    location: true,
    averageRating: true,
    reviewsCount: true,
    visibility: true,
    seo: true,
    price: true,
    tags: true,
    extraInfo: true,

    // Protected fields - ownership
    ownerId: true,

    // Contact info (nested object with email, phone, website)
    contactInfo: true,

    // Lifecycle (for owners)
    lifecycleState: true,

    // FAQs
    faqs: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
}).extend({
    /** Owner data from users table JOIN (protected tier). */
    owner: UserProtectedSchema.optional(),
    /** Destination data from destinations table JOIN (protected tier). */
    destination: DestinationProtectedSchema.optional(),
    /** Amenities with junction table data from r_accommodation_amenity (protected tier). */
    amenities: z.array(AmenityProtectedSchema).optional(),
    /** Features with junction table data from r_accommodation_feature (protected tier). */
    features: z.array(FeatureProtectedSchema).optional()
});

export type AccommodationProtected = z.infer<typeof AccommodationProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const AccommodationAdminSchema = AccommodationSchema.extend({
    /** Owner data from users table JOIN (admin tier). */
    owner: UserAdminSchema.optional(),
    /** Destination data from destinations table JOIN (admin tier). */
    destination: DestinationAdminSchema.optional(),
    /** Amenities with junction table data from r_accommodation_amenity (admin tier). */
    amenities: z.array(AmenityAdminSchema).optional(),
    /** Features with junction table data from r_accommodation_feature (admin tier). */
    features: z.array(FeatureAdminSchema).optional()
});

export type AccommodationAdmin = z.infer<typeof AccommodationAdminSchema>;
