import { z } from 'zod';
import { ModerationStatusEnumSchema } from '../enums/index.js';
import { ImageAttributionSchema, mediaAssetUrl } from './media.schema.js';

// ============================================================================
// ListingMediaSchema — shared relational media row shape for gastronomy and
// experience listings. Mirrors `accommodation_media` (HOS-372).
// ============================================================================

/**
 * Enum schema for the visibility state of a single listing media row.
 *
 * - `visible`  — photo is part of the active gallery (or is the featured image).
 * - `archived` — photo was moved out of the gallery. No gastronomy or experience flow archives
 *   photos today (their plans carry `limits: []`, so there is no
 *   downgrade-over-limit remediation like the accommodation one — SPEC-167).
 *   The state is modeled anyway so gastronomy and experience share ONE table
 *   shape (and therefore one composition/service implementation) with
 *   accommodation instead of diverging.
 *
 * Mirrors `AccommodationMediaStateSchema`
 * (`packages/schemas/src/entities/accommodation/subtypes/accommodation.media.schema.ts`)
 * by value, but is intentionally a SEPARATE schema instance: gastronomy and
 * experience media is its own domain per ADR-035, and importing
 * from the accommodation entity file would couple two verticals that must be
 * able to evolve independently.
 */
export const ListingMediaStateSchema = z.enum(['visible', 'archived'], {
    message: 'zodError.common.listingMedia.state.invalid'
});
export type ListingMediaState = z.infer<typeof ListingMediaStateSchema>;

/**
 * Shared base shape for a single row in a listing media table
 * (`gastronomy_media`, `experience_media`).
 *
 * Deliberately EXCLUDES `id` and the parent foreign key — those are the only
 * two fields that differ per vertical. Each vertical's schema extends this
 * base with its own `id` id field and `<vertical>Id` FK:
 *
 * ```ts
 * export const GastronomyMediaSchema = BaseListingMediaSchema.extend({
 *   id: z.string().uuid(),
 *   gastronomyId: z.string().uuid(),
 * });
 * ```
 *
 * Field-for-field mirror of `AccommodationMediaSchema`'s row shape (same
 * validation rules), kept as a SEPARATE object (not imported from the
 * accommodation subtype file, per the domain-isolation rule in ADR-035):
 * - `attribution` is nullable JSONB, matching the DB column type.
 * - Audit timestamps use `z.coerce.date()` to accept both `Date` and ISO
 *   strings (pg driver may return either).
 * - No `createdById` / `updatedById` / `deletedById` — the media tables do
 *   not carry those columns, unlike their parent listing tables.
 *
 * @see packages/db/src/schemas/gastronomy/gastronomy_media.dbschema.ts
 * @see packages/db/src/schemas/experience/experience_media.dbschema.ts
 * @see packages/schemas/src/common/media.schema.ts — `ImageSchema` (the media-item shape this mirrors)
 */
export const BaseListingMediaSchema = z.object({
    // ── Image fields (mirrors ImageSchema EXACTLY) ────────────────────────────
    /**
     * Full public URL of the photo (Cloudinary delivery URL or external CDN).
     * Required — every media row must have a URL.
     */
    url: mediaAssetUrl('zodError.common.listingMedia.url.invalid'),
    /**
     * Short display caption (max 100 chars).
     * Nullable/optional — not all uploads include a caption.
     */
    caption: z
        .string()
        .min(3, { message: 'zodError.common.listingMedia.caption.min' })
        .max(100, { message: 'zodError.common.listingMedia.caption.max' })
        .nullable()
        .optional(),
    /**
     * Longer description of photo content (max 300 chars).
     * Nullable/optional.
     */
    description: z
        .string()
        .min(10, { message: 'zodError.common.listingMedia.description.min' })
        .max(300, { message: 'zodError.common.listingMedia.description.max' })
        .nullable()
        .optional(),
    /**
     * Accessible alt text for `<img alt>` and screen readers.
     * Optional; falls back to caption / listing name at render time.
     */
    alt: z
        .string()
        .min(1, { message: 'zodError.common.listingMedia.alt.min' })
        .max(200, { message: 'zodError.common.listingMedia.alt.max' })
        .nullable()
        .optional(),
    /**
     * Cloudinary `public_id` (e.g. `hospeda/dev/abc123`).
     * Optional — historic payloads and external URLs do not carry a Cloudinary id.
     */
    publicId: z
        .string()
        .min(1, { message: 'zodError.common.listingMedia.publicId.min' })
        .nullable()
        .optional(),
    /**
     * Optional credits/source metadata (photographer, sourceUrl, license).
     * Nullable because the DB column is JSONB nullable.
     */
    attribution: ImageAttributionSchema.nullable().optional(),
    /**
     * Content moderation state: `PENDING` | `APPROVED` | `REJECTED`.
     */
    moderationState: ModerationStatusEnumSchema,

    // ── Media-row state ───────────────────────────────────────────────────────
    /**
     * Visibility state within the listing's media collection.
     * `visible` = active gallery; `archived` = moved out of the gallery.
     */
    state: ListingMediaStateSchema,
    /**
     * When `true` this row is the featured / cover image for the listing.
     * At most one non-deleted row per listing can be featured (enforced by a
     * partial unique index in the DB extras carril, mirroring T-003).
     */
    isFeatured: z.boolean(),
    /**
     * 0-based display order within the active gallery. Lower = appears first.
     */
    sortOrder: z.number().int({ message: 'zodError.common.listingMedia.sortOrder.int' }),
    /**
     * Timestamp set when the photo is moved to `state = 'archived'`.
     * Null while the photo is visible. Used for FIFO restore ordering.
     */
    archivedAt: z.coerce.date().nullable().optional(),

    // ── Audit columns (no *ById — these tables omit them) ────────────────────
    /** Row creation timestamp (set by the DB, coerced from pg driver output). */
    createdAt: z.coerce.date({ message: 'zodError.common.createdAt.required' }),
    /** Row last-update timestamp. */
    updatedAt: z.coerce.date({ message: 'zodError.common.updatedAt.required' }),
    /**
     * Soft-delete timestamp. Null while the row is active.
     * Rows with a non-null `deletedAt` are excluded from all finder queries.
     */
    deletedAt: z.coerce.date().nullable().optional()
});

/** Type inferred from `BaseListingMediaSchema` (row fields, no id/FK). */
export type BaseListingMedia = z.infer<typeof BaseListingMediaSchema>;

// ============================================================================
// Command payload — shared text-metadata PATCH input (HOS-1036)
// ============================================================================

/**
 * Shared HTTP payload for `PATCH /<gastronomies|experiences>/:id/media/:mediaId`.
 *
 * The gastronomy/experience twin of `AccommodationMediaUpdatePayloadSchema` (HOS-388) and of
 * `ContentMediaUpdatePayloadSchema` (`common/content-media.schema.ts`). The
 * three are field-for-field identical and differ only in the `zodError.*`
 * namespace their messages carry — same reason the three ROW schemas are
 * separate copies today (see {@link BaseListingMediaSchema}'s JSDoc: collapse
 * all of them together, payloads included, once that follow-up lands).
 *
 * Text metadata ONLY. `url`, `publicId`, `moderationState`, `state`,
 * `isFeatured`, `sortOrder` and the parent FK are server-controlled and
 * intentionally absent, so extra keys in the body cannot smuggle them through.
 *
 * All four fields are NULLABLE as well as optional: omit to leave unchanged,
 * `null` to clear, a value to replace.
 *
 * NO `.refine()` here on purpose — see the accommodation twin for the Zod 4
 * `.shape` gotcha. The "at least one field" rule is refined on the per-vertical
 * service INPUT schemas, via `hasAtLeastOneMediaTextField`.
 */
export const ListingMediaUpdatePayloadSchema = z.object({
    /** Short display caption (max 100 chars). `null` clears it; omit to leave unchanged. */
    caption: z
        .string()
        .min(3, { message: 'zodError.common.listingMedia.caption.min' })
        .max(100, { message: 'zodError.common.listingMedia.caption.max' })
        .nullable()
        .optional(),
    /** Longer photo description (max 300 chars). `null` clears it; omit to leave unchanged. */
    description: z
        .string()
        .min(10, { message: 'zodError.common.listingMedia.description.min' })
        .max(300, { message: 'zodError.common.listingMedia.description.max' })
        .nullable()
        .optional(),
    /** Accessible alt text (max 200 chars). `null` clears it; omit to leave unchanged. */
    alt: z
        .string()
        .min(1, { message: 'zodError.common.listingMedia.alt.min' })
        .max(200, { message: 'zodError.common.listingMedia.alt.max' })
        .nullable()
        .optional(),
    /** Optional credits/source metadata. `null` clears it; omit to leave unchanged. */
    attribution: ImageAttributionSchema.nullable().optional()
});

/** Inferred type for the shared listing text-metadata PATCH payload. */
export type ListingMediaUpdatePayload = z.infer<typeof ListingMediaUpdatePayloadSchema>;
