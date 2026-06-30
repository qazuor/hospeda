import { z } from 'zod';
import { I18nTextSchema } from '../../common/i18n.schema.js';
import { ApproximateLocationSchema } from '../../common/location.schema.js';
import { BaseMediaObjectSchema } from '../../common/media.schema.js';
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

    // SPEC-212: I18nText translations (public-safe content fields).
    // Web public pages render these to switch the visible locale to en/pt.
    // richDescriptionI18n is intentionally NOT picked here — like the plain
    // richDescription it is premium/entitlement-gated and re-added via .extend()
    // below (the CAN_USE_RICH_DESCRIPTION strip runs server-side before serialization).
    nameI18n: true,
    summaryI18n: true,
    descriptionI18n: true,

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

    // Social networks (public)
    socialNetworks: true,

    // Extra Info (public)
    extraInfo: true
}).extend({
    /**
     * Rich-text (markdown) variant of the description for entitled hosts.
     * Must survive serialization so the web client can switch between rich
     * and plain rendering (FR-3b / FR-4 in SPEC-187). The entitlement-by-omission
     * gate (strips the field server-side for non-entitled owners) runs BEFORE
     * stripWithSchema, so schema presence is safe — omission is the protection.
     * Accepts null (DB default for un-filled rows) and undefined (entitlement gate
     * strips to undefined), matching the base schema's .nullish() declaration.
     */
    richDescription: z
        .string()
        .max(5000, { message: 'zodError.accommodation.richDescription.max' })
        .nullish(),
    /**
     * SPEC-212: I18nText translations of richDescription. Follows EXACTLY the
     * same premium gating as the plain richDescription field above — the
     * entitlement-by-omission gate (CAN_USE_RICH_DESCRIPTION) strips it
     * server-side for non-entitled owners BEFORE stripWithSchema runs, so schema
     * presence is safe; omission is the protection. Re-added via .extend() (not
     * .pick()) so it mirrors richDescription's deliberate public exposure.
     */
    richDescriptionI18n: I18nTextSchema.nullish(),
    /**
     * Media WITHOUT archivedGallery. The entity schema carries `archivedGallery`
     * for server-side use (restore on re-upgrade), but it must never be exposed
     * to public consumers. Override the picked field with the input-safe shape.
     */
    media: BaseMediaObjectSchema.nullish(),
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
                // SPEC-266: catalog `name` was dropped; `slug` is the canonical
                // identifier and the i18n key (`accommodations.amenityNames.<slug>`).
                slug: z.string(),
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
                // SPEC-266: catalog `name` was dropped; `slug` is the canonical
                // identifier and the i18n key (`accommodations.featureNames.<slug>`).
                slug: z.string(),
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
    approximateLocation: ApproximateLocationSchema.optional(),
    /**
     * Whether the owning host has the AI_CHAT entitlement — i.e. the per-listing
     * AI chat assistant is available on this accommodation's detail page. This is
     * NOT a stored column: it is resolved per-owner at the API route layer (the
     * same entitlement the chat route gates on) and surfaced so the listing card
     * can show a "Chat IA" badge. Optional: absent on responses that don't enrich
     * it (only the public list endpoint populates it today).
     */
    hasAiChat: z.boolean().optional()
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

    // Social networks
    socialNetworks: true,

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
    /**
     * Media WITHOUT archivedGallery. The entity schema carries `archivedGallery`
     * for server-side use, but it must never be exposed to authenticated (non-admin)
     * consumers either. Override the picked field with the input-safe shape.
     */
    media: BaseMediaObjectSchema.nullish(),
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
