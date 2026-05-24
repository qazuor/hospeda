import { z } from 'zod';
import { ApproximateLocationSchema } from '../../common/location.schema.js';
import { AmenityAdminSchema, AmenityProtectedSchema } from '../amenity/amenity.access.schema.js';
import { CityDestinationRefSchema } from '../destination/destination.refs.schema.js';
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
    /** ISO 8601 creation date (for "Nuevo" badge: < 30 days). Accepts Date for raw service output. */
    createdAt: z.union([z.string(), z.date()]).nullish(),
    /** Public owner data from users table JOIN. No sensitive fields. */
    owner: z
        .object({
            id: z.string().uuid(),
            name: z.string().nullish(),
            displayName: z.string().nullish(),
            firstName: z.string().nullish(),
            lastName: z.string().nullish(),
            image: z.string().nullish(),
            createdAt: z.union([z.string(), z.date()]).nullish()
        })
        .nullish(),
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
    /**
     * City projection of the linked destination (SPEC-095). Replaces the
     * geographic context that used to live inside `location` and the heavy
     * `destination` relation projection.
     */
    cityDestination: CityDestinationRefSchema.optional(),
    /**
     * Privacy-aware obfuscated coordinates (SPEC-097). The frontend renders a
     * circle of `radiusMeters` centered on `(lat, lng)` instead of a precise
     * pin. The exact coordinates are never exposed alongside this field — the
     * service projection strips `location.coordinates`, `location.street`,
     * `location.number`, `location.floor`, and `location.apartment` from the
     * public payload.
     */
    approximateLocation: ApproximateLocationSchema.optional()
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
    /**
     * Description — relaxed on the read side so DRAFT accommodations with
     * short descriptions (legacy data, or drafts created via the onboarding
     * "publicar" flow where description is initially placeholder-filled) can
     * still be fetched without tripping the `min(30)` constraint enforced on
     * the base/write schemas. See SPEC-143 Finding #9: read schemas must
     * tolerate what the DB legitimately contains; the write path is where
     * the min(30) gate is meaningful.
     */
    description: z.string().max(2000, { message: 'zodError.accommodation.description.max' }),
    /** Owner data from users table JOIN (protected tier). */
    owner: UserProtectedSchema.optional(),
    /** City projection of the linked destination (SPEC-095). */
    cityDestination: CityDestinationRefSchema.optional(),
    /** Amenities with junction table data from r_accommodation_amenity (protected tier). */
    amenities: z.array(AmenityProtectedSchema).optional(),
    /** Features with junction table data from r_accommodation_feature (protected tier). */
    features: z.array(FeatureProtectedSchema).optional(),
    /** SPEC-097 — Approximate location preview ("how a public visitor sees this"). */
    approximateLocation: ApproximateLocationSchema.optional()
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
    /**
     * Description — relaxed on the read side so DRAFT accommodations with
     * short descriptions (legacy data, or drafts created via the onboarding
     * "publicar" flow) can still be fetched by the admin panel. See
     * SPEC-143 Finding #9.
     */
    description: z.string().max(2000, { message: 'zodError.accommodation.description.max' }),
    /** Owner data from users table JOIN (admin tier). */
    owner: UserAdminSchema.optional(),
    /** City projection of the linked destination (SPEC-095). */
    cityDestination: CityDestinationRefSchema.optional(),
    /** Amenities with junction table data from r_accommodation_amenity (admin tier). */
    amenities: z.array(AmenityAdminSchema).optional(),
    /** Features with junction table data from r_accommodation_feature (admin tier). */
    features: z.array(FeatureAdminSchema).optional(),
    /** SPEC-097 — Approximate location preview ("how a public visitor sees this"). */
    approximateLocation: ApproximateLocationSchema.optional()
});

export type AccommodationAdmin = z.infer<typeof AccommodationAdminSchema>;
