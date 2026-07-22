import { z } from 'zod';
import { I18nTextSchema } from '../../common/i18n.schema.js';
import { ApproximateLocationSchema, CoordinatesSchema } from '../../common/location.schema.js';
import { BaseMediaObjectSchema } from '../../common/media.schema.js';
import { PreferredContactEnumSchema } from '../../enums/index.js';
import { AmenityAdminSchema, AmenityProtectedSchema } from '../amenity/amenity.access.schema.js';
import { CityDestinationRefSchema } from '../destination/destination.refs.schema.js';
import { FeatureAdminSchema, FeatureProtectedSchema } from '../feature/feature.access.schema.js';
import { UserAdminSchema, UserProtectedSchema } from '../user/user.access.schema.js';
import { AccommodationSchema } from './accommodation.schema.js';
import {
    AccommodationPriceSchema,
    AdditionalFeesInfoSchema,
    DiscountInfoSchema,
    OtherAdditionalFeesSchema,
    OtherDiscountSchema
} from './subtypes/accommodation.price.schema.js';

// ============================================================================
// READ⊇WRITE LENIENT SHAPES (HOS-190)
// ============================================================================
//
// The response/access schemas below are stripped against the actual stored row
// by `stripWithSchema` (apps/api/src/utils/response-helpers.ts), which
// FAIL-CLOSES to HTTP 500 when a stored value does not satisfy the declared
// schema. Every long-text/JSONB column on `accommodations` (`name`, `summary`,
// `description`, `seo`, `contact_info`, `social_networks`, `location`, `price`)
// is an unconstrained Postgres `text`/`jsonb` — nothing but Zod has ever gated
// what landed there, so legacy rows, imports, and admin/cron writes can hold
// values stricter than today's bounds would allow. A single such value used to
// 500 the owner's GET and lock them out of editing the ENTIRE accommodation
// (and 500 the public page). This mirrors the profile fix and extends the
// existing SPEC-143 Finding #9 `slug`/`description` read-relaxation precedent:
// the RESPONSE asserts type + presence only for these free-form fields; content
// bounds (length, phone/URL format, price positivity) stay enforced on the
// WRITE path (the domain `updateSchema`/`createSchema` gate in BaseCrudService).

/** SEO read shape — drops title/description length bounds (host cannot even edit SEO, so a legacy value is un-self-healable). */
const AccommodationSeoReadSchema = z
    .object({ title: z.string().optional(), description: z.string().optional() })
    .strip();

/** Contact read shape — phones/emails/website as plain strings (legacy local-format AR phones like `0223-155-1234` are extremely common and lack the `+` the write regex requires). */
const AccommodationContactInfoReadSchema = z.object({
    personalEmail: z.string().optional(),
    workEmail: z.string().optional(),
    homePhone: z.string().optional(),
    workPhone: z.string().optional(),
    mobilePhone: z.string().optional(),
    whatsapp: z.string().optional(),
    website: z.string().optional(),
    preferredEmail: PreferredContactEnumSchema.optional(),
    preferredPhone: PreferredContactEnumSchema.optional()
});

/** Social read shape — plain strings (legacy variant URLs like `m.facebook.com`/mobile share links fail the platform regex). */
const AccommodationSocialNetworksReadSchema = z.object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    linkedIn: z.string().optional(),
    tiktok: z.string().optional(),
    youtube: z.string().optional()
});

/** Location read shape — postal string fields drop min/max (coordinates keep their numeric validation; they only ever come from the map picker). */
const AccommodationLocationReadSchema = z.object({
    coordinates: CoordinatesSchema.optional(),
    street: z.string().optional(),
    number: z.string().optional(),
    floor: z.string().optional(),
    apartment: z.string().optional()
});

/**
 * i18n read shape (HOS-190 / BETA-186) — each locale is individually optional and
 * nullable, unlike the strict `I18nTextSchema` which requires a complete
 * `{es,en,pt}` string triple. The single write path
 * (`apps/api/src/services/ai-translate.service.ts`) always persists a complete
 * triple, but a legacy/imported/partial value in `name_i18n`/`summary_i18n`/
 * `description_i18n` must never fail-close the owner's GET to HTTP 500 and lock
 * them out of editing (`stripWithSchema` fail-closes). Mirrors the lenient-read
 * overlays for the other free-form columns above. The TranslationPanel only reads
 * per-locale presence, so a partial shape degrades gracefully.
 */
const AccommodationI18nTextReadSchema = z
    .object({
        es: z.string().nullish(),
        en: z.string().nullish(),
        pt: z.string().nullish()
    })
    .nullish();

/**
 * Price read shape — drops `.positive()` on the nightly amount AND on every
 * nested fee/discount amount, so a legacy/"consultar precio" `0` never 500s the
 * response at ANY nesting level (the shared `PriceSchema.price` positivity is a
 * WRITE constraint asserted by an existing test, so it stays strict; the
 * relaxation is contained to this read overlay). The `.extend({ price })` on each
 * info schema overrides only the amount, preserving every fee/discount flag.
 */
const LenientPriceAmount = z.number().optional();
const AdditionalFeesInfoReadSchema = AdditionalFeesInfoSchema.extend({ price: LenientPriceAmount });
const DiscountInfoReadSchema = DiscountInfoSchema.extend({ price: LenientPriceAmount });
const AccommodationPriceReadSchema = AccommodationPriceSchema.extend({
    price: LenientPriceAmount,
    additionalFees: z
        .object({
            cleaning: AdditionalFeesInfoReadSchema.optional(),
            tax: AdditionalFeesInfoReadSchema.optional(),
            lateCheckout: AdditionalFeesInfoReadSchema.optional(),
            pets: AdditionalFeesInfoReadSchema.optional(),
            bedlinen: AdditionalFeesInfoReadSchema.optional(),
            towels: AdditionalFeesInfoReadSchema.optional(),
            babyCrib: AdditionalFeesInfoReadSchema.optional(),
            babyHighChair: AdditionalFeesInfoReadSchema.optional(),
            extraBed: AdditionalFeesInfoReadSchema.optional(),
            securityDeposit: AdditionalFeesInfoReadSchema.optional(),
            extraGuest: AdditionalFeesInfoReadSchema.optional(),
            parking: AdditionalFeesInfoReadSchema.optional(),
            earlyCheckin: AdditionalFeesInfoReadSchema.optional(),
            lateCheckin: AdditionalFeesInfoReadSchema.optional(),
            luggageStorage: AdditionalFeesInfoReadSchema.optional(),
            // `name` is also relaxed (drops min2/max100, stays required) so a
            // legacy custom fee with a short name never 500s either.
            others: z
                .array(
                    OtherAdditionalFeesSchema.extend({
                        price: LenientPriceAmount,
                        name: z.string()
                    })
                )
                .optional()
        })
        .optional(),
    discounts: z
        .object({
            weekly: DiscountInfoReadSchema.optional(),
            monthly: DiscountInfoReadSchema.optional(),
            lastMinute: DiscountInfoReadSchema.optional(),
            others: z
                .array(OtherDiscountSchema.extend({ price: LenientPriceAmount, name: z.string() }))
                .optional()
        })
        .optional()
});

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
    isVerified: true,

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
     * Slug — relaxed on the read side so accommodations whose slug was
     * generated before the BETA-172 truncation fix (onboarding drafts with a
     * long imported name) can still be fetched without tripping the write
     * schema's `max(50)` constraint. See SPEC-143 Finding #9: read schemas
     * must tolerate what the DB legitimately contains; the write path is
     * where the max(50) gate is meaningful (and where the root-cause fix —
     * truncating at generation time — lives).
     */
    slug: z.string().max(120, { message: 'zodError.accommodation.slug.max' }),
    // HOS-190 read⊇write: assert type + presence only for free-form content
    // fields (see the lenient-shapes block at the top of this file). A legacy
    // value must never 500 the public page.
    name: z.string(),
    summary: z.string(),
    description: z.string(),
    seo: AccommodationSeoReadSchema.nullish(),
    price: AccommodationPriceReadSchema.nullish(),
    socialNetworks: AccommodationSocialNetworksReadSchema.nullish(),
    location: AccommodationLocationReadSchema.nullish(),
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
                category: z.string().nullable(),
                questionI18n: I18nTextSchema.nullish(),
                answerI18n: I18nTextSchema.nullish()
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
    // SPEC-212 / BETA-186: I18nText translations of the free-form content fields.
    // The owner's editor reads these to show the TranslationPanel status per locale;
    // without them here `stripWithSchema` deleted the auto-translations from the GET
    // response, so the panel always showed "—" for en/pt even when the DB had them.
    // These three are the SAME content translations the public schema exposes
    // UNGATED to anonymous visitors, so surfacing them to the authenticated OWNER
    // adds no exposure. richDescriptionI18n is intentionally NOT added: it is
    // premium/entitlement-gated and the protected getById route does not run the
    // richDescription entitlement strip (unlike the public route), so exposing it
    // here would need that gate first — tracked as a follow-up.
    nameI18n: true,
    summaryI18n: true,
    descriptionI18n: true,
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
     * Slug — relaxed on the read side so accommodations whose slug was
     * generated before the BETA-172 truncation fix (onboarding drafts with a
     * long imported name) can still be fetched without tripping the write
     * schema's `max(50)` constraint. See SPEC-143 Finding #9: read schemas
     * must tolerate what the DB legitimately contains; the write path is
     * where the max(50) gate is meaningful (and where the root-cause fix —
     * truncating at generation time — lives).
     */
    slug: z.string().max(120, { message: 'zodError.accommodation.slug.max' }),
    // HOS-190 read⊇write: the OWNER edits this accommodation off this exact
    // schema — a single stored value stricter than today's write bounds (a
    // legacy short `description`, an AR local-format phone, a `seo` block the
    // host cannot even edit, a `0` price) used to 500 the GET and lock the
    // owner out of editing EVERYTHING. Assert type + presence only for these
    // free-form fields; content bounds stay on the write/domain schema. See the
    // lenient-shapes block at the top of this file and SPEC-143 Finding #9.
    name: z.string(),
    summary: z.string(),
    description: z.string(),
    // BETA-186 / HOS-190: lenient i18n read overlay so a legacy/partial value in
    // these columns never fail-closes the owner's editor GET (and the list/patch/
    // publish/unpublish/create routes that reuse this schema). See the lenient
    // AccommodationI18nTextReadSchema definition above.
    nameI18n: AccommodationI18nTextReadSchema,
    summaryI18n: AccommodationI18nTextReadSchema,
    descriptionI18n: AccommodationI18nTextReadSchema,
    seo: AccommodationSeoReadSchema.nullish(),
    price: AccommodationPriceReadSchema.nullish(),
    contactInfo: AccommodationContactInfoReadSchema.nullish(),
    socialNetworks: AccommodationSocialNetworksReadSchema.nullish(),
    location: AccommodationLocationReadSchema.nullish(),
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
     * Slug — relaxed on the read side so accommodations whose slug was
     * generated before the BETA-172 truncation fix (onboarding drafts with a
     * long imported name) can still be fetched by the admin panel without
     * tripping the write schema's `max(50)` constraint. See SPEC-143
     * Finding #9: read schemas must tolerate what the DB legitimately
     * contains; the write path is where the max(50) gate is meaningful.
     */
    slug: z.string().max(120, { message: 'zodError.accommodation.slug.max' }),
    // HOS-190 read⊇write: assert type + presence only for free-form content
    // fields so a legacy/imported value never 500s the admin GET. Content
    // bounds stay on the write/domain schema. See the lenient-shapes block at
    // the top of this file and SPEC-143 Finding #9.
    name: z.string(),
    summary: z.string(),
    description: z.string(),
    seo: AccommodationSeoReadSchema.nullish(),
    price: AccommodationPriceReadSchema.nullish(),
    contactInfo: AccommodationContactInfoReadSchema.nullish(),
    socialNetworks: AccommodationSocialNetworksReadSchema.nullish(),
    location: AccommodationLocationReadSchema.nullish(),
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
