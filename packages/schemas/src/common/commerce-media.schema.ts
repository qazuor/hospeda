import { z } from 'zod';
import { ModerationStatusEnumSchema } from '../enums/index.js';
import { ImageAttributionSchema, mediaAssetUrl } from './media.schema.js';

// ============================================================================
// CommerceMediaSchema — shared relational media row shape for commerce
// listings (gastronomy, experience). Mirrors `accommodation_media` (HOS-372).
// ============================================================================

/**
 * Enum schema for the visibility state of a single commerce-listing media row.
 *
 * - `visible`  — photo is part of the active gallery (or is the featured image).
 * - `archived` — photo was moved out of the gallery. No commerce flow archives
 *   photos today (the commerce plan carries `limits: []`, so there is no
 *   downgrade-over-limit remediation like the accommodation one — SPEC-167).
 *   The state is modeled anyway so gastronomy and experience share ONE table
 *   shape (and therefore one composition/service implementation) with
 *   accommodation instead of diverging.
 *
 * Mirrors `AccommodationMediaStateSchema`
 * (`packages/schemas/src/entities/accommodation/subtypes/accommodation.media.schema.ts`)
 * by value, but is intentionally a SEPARATE schema instance: the accommodation
 * file is mid-change in another task and must not be imported from here.
 */
export const CommerceMediaStateSchema = z.enum(['visible', 'archived'], {
    message: 'zodError.common.commerceMedia.state.invalid'
});
export type CommerceMediaState = z.infer<typeof CommerceMediaStateSchema>;

/**
 * Shared base shape for a single row in a commerce-listing media table
 * (`gastronomy_media`, `experience_media`).
 *
 * Deliberately EXCLUDES `id` and the parent foreign key — those are the only
 * two fields that differ per vertical. Each vertical's schema extends this
 * base with its own `id` id field and `<vertical>Id` FK:
 *
 * ```ts
 * export const GastronomyMediaSchema = BaseCommerceMediaSchema.extend({
 *   id: z.string().uuid(),
 *   gastronomyId: z.string().uuid(),
 * });
 * ```
 *
 * Field-for-field mirror of `AccommodationMediaSchema`'s row shape (same
 * validation rules), kept as a SEPARATE object (not imported from the
 * accommodation subtype file, which is mid-change in another task):
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
export const BaseCommerceMediaSchema = z.object({
    // ── Image fields (mirrors ImageSchema EXACTLY) ────────────────────────────
    /**
     * Full public URL of the photo (Cloudinary delivery URL or external CDN).
     * Required — every media row must have a URL.
     */
    url: mediaAssetUrl('zodError.common.commerceMedia.url.invalid'),
    /**
     * Short display caption (max 100 chars).
     * Nullable/optional — not all uploads include a caption.
     */
    caption: z
        .string()
        .min(3, { message: 'zodError.common.commerceMedia.caption.min' })
        .max(100, { message: 'zodError.common.commerceMedia.caption.max' })
        .nullable()
        .optional(),
    /**
     * Longer description of photo content (max 300 chars).
     * Nullable/optional.
     */
    description: z
        .string()
        .min(10, { message: 'zodError.common.commerceMedia.description.min' })
        .max(300, { message: 'zodError.common.commerceMedia.description.max' })
        .nullable()
        .optional(),
    /**
     * Accessible alt text for `<img alt>` and screen readers.
     * Optional; falls back to caption / listing name at render time.
     */
    alt: z
        .string()
        .min(1, { message: 'zodError.common.commerceMedia.alt.min' })
        .max(200, { message: 'zodError.common.commerceMedia.alt.max' })
        .nullable()
        .optional(),
    /**
     * Cloudinary `public_id` (e.g. `hospeda/dev/abc123`).
     * Optional — historic payloads and external URLs do not carry a Cloudinary id.
     */
    publicId: z
        .string()
        .min(1, { message: 'zodError.common.commerceMedia.publicId.min' })
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
    state: CommerceMediaStateSchema,
    /**
     * When `true` this row is the featured / cover image for the listing.
     * At most one non-deleted row per listing can be featured (enforced by a
     * partial unique index in the DB extras carril, mirroring T-003).
     */
    isFeatured: z.boolean(),
    /**
     * 0-based display order within the active gallery. Lower = appears first.
     */
    sortOrder: z.number().int({ message: 'zodError.common.commerceMedia.sortOrder.int' }),
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

/** Type inferred from `BaseCommerceMediaSchema` (row fields, no id/FK). */
export type BaseCommerceMedia = z.infer<typeof BaseCommerceMediaSchema>;
