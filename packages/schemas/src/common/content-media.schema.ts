import { z } from 'zod';
import { ModerationStatusEnumSchema } from '../enums/index.js';
import { ImageAttributionSchema, mediaAssetUrl } from './media.schema.js';

// ============================================================================
// ContentMediaSchema — shared relational media row shape for EDITORIAL content
// (posts, events). Mirrors `accommodation_media` (SPEC-204) and
// `commerce-media.schema.ts` (HOS-372). HOS-390.
// ============================================================================

/**
 * Enum schema for the visibility state of a single editorial-content media row.
 *
 * - `visible`  — photo is part of the active gallery (or is the featured image).
 * - `archived` — photo was moved out of the gallery.
 *
 * No editorial flow archives photos today: `archivedGallery` is written only by
 * the accommodation plan-downgrade remediation (SPEC-167), and posts/events
 * have no plan at all. The state is modeled anyway so that posts, events,
 * commerce listings and accommodations share ONE table shape — and therefore
 * one sync/compose implementation — instead of diverging on a column that costs
 * nothing to carry.
 */
export const ContentMediaStateSchema = z.enum(['visible', 'archived'], {
    message: 'zodError.common.contentMedia.state.invalid'
});
export type ContentMediaState = z.infer<typeof ContentMediaStateSchema>;

/**
 * Shared base shape for a single row in an editorial-content media table
 * (`post_media`, `event_media`).
 *
 * Deliberately EXCLUDES `id` and the parent foreign key — the only two fields
 * that differ per entity. Each entity's schema extends this base:
 *
 * ```ts
 * export const PostMediaSchema = BaseContentMediaSchema.extend({
 *   id: PostMediaIdSchema,
 *   postId: PostIdSchema,
 * });
 * ```
 *
 * ## Why this is a third copy of the same shape
 *
 * `BaseCommerceMediaSchema` (`common/commerce-media.schema.ts`) is already this
 * exact object, and `AccommodationMediaSchema` is a fourth. Reusing the commerce
 * one here was the obvious move and was deliberately NOT taken: that file is
 * mid-change under HOS-382 (the relational MediaField port to the commerce admin
 * form), and widening a schema another in-flight branch is editing trades a
 * duplicate for a merge conflict on the shape every media table depends on.
 *
 * Its error-message keys are also commerce-namespaced
 * (`zodError.common.commerceMedia.*`), which a post would surface verbatim.
 *
 * **Follow-up, on purpose, not forgotten**: once HOS-382 lands, collapse all
 * three into a single `BaseEntityMediaSchema` here and keep the per-entity
 * schemas as thin `.extend({ id, <entity>Id })` calls. Nothing below should
 * diverge from the commerce copy in the meantime — if you change a rule here,
 * change it there too.
 *
 * @see packages/db/src/schemas/post/post_media.dbschema.ts
 * @see packages/db/src/schemas/event/event_media.dbschema.ts
 * @see packages/schemas/src/common/commerce-media.schema.ts — the commerce twin
 * @see packages/schemas/src/common/media.schema.ts — `ImageSchema`, the shape this mirrors
 */
export const BaseContentMediaSchema = z.object({
    // ── Image fields (mirrors ImageSchema EXACTLY) ────────────────────────────
    /**
     * Full public URL of the photo (Cloudinary delivery URL or external CDN).
     * Required — every media row must have a URL.
     */
    url: mediaAssetUrl('zodError.common.contentMedia.url.invalid'),
    /**
     * Short display caption (max 100 chars).
     * Nullable/optional — not all uploads include a caption.
     */
    caption: z
        .string()
        .min(3, { message: 'zodError.common.contentMedia.caption.min' })
        .max(100, { message: 'zodError.common.contentMedia.caption.max' })
        .nullable()
        .optional(),
    /**
     * Longer description of photo content (max 300 chars).
     * Nullable/optional.
     */
    description: z
        .string()
        .min(10, { message: 'zodError.common.contentMedia.description.min' })
        .max(300, { message: 'zodError.common.contentMedia.description.max' })
        .nullable()
        .optional(),
    /**
     * Accessible alt text for `<img alt>` and screen readers.
     * Optional; falls back to caption / the post title or event name at render time.
     */
    alt: z
        .string()
        .min(1, { message: 'zodError.common.contentMedia.alt.min' })
        .max(200, { message: 'zodError.common.contentMedia.alt.max' })
        .nullable()
        .optional(),
    /**
     * Cloudinary `public_id` (e.g. `hospeda/dev/abc123`).
     * Optional — historic payloads and external URLs do not carry a Cloudinary id.
     */
    publicId: z
        .string()
        .min(1, { message: 'zodError.common.contentMedia.publicId.min' })
        .nullable()
        .optional(),
    /**
     * Optional credits/source metadata (photographer, sourceUrl, license).
     * Nullable because the DB column is JSONB nullable.
     */
    attribution: ImageAttributionSchema.nullable().optional(),
    /**
     * Content moderation state: `PENDING` | `APPROVED` | `REJECTED`.
     *
     * Independent of the PARENT's `moderationState` (HOS-374 §7.6.1): approving
     * a post says nothing about whether each of its photos passed review.
     */
    moderationState: ModerationStatusEnumSchema,

    // ── Media-row state ───────────────────────────────────────────────────────
    /**
     * Visibility state within the content's media collection.
     * `visible` = active gallery; `archived` = moved out of the gallery.
     */
    state: ContentMediaStateSchema,
    /**
     * When `true` this row is the featured / cover image for the post or event.
     * At most one non-deleted row per parent can be featured (enforced by a
     * partial unique index in the DB extras carril, mirroring SPEC-204 T-003).
     */
    isFeatured: z.boolean(),
    /**
     * 0-based display order within the active gallery. Lower = appears first.
     */
    sortOrder: z.number().int({ message: 'zodError.common.contentMedia.sortOrder.int' }),
    /**
     * Timestamp set when the photo is moved to `state = 'archived'`.
     * Null while the photo is visible.
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

/** Type inferred from `BaseContentMediaSchema` (row fields, no id/FK). */
export type BaseContentMedia = z.infer<typeof BaseContentMediaSchema>;

// ============================================================================
// Command payload — shared add-photo input for editorial content (HOS-390)
// ============================================================================

/**
 * Shared HTTP payload for adding a single photo to a post or event gallery.
 *
 * This is a URL-receiver schema: the upload to Cloudinary has already happened
 * via the media-upload endpoint. The add-media endpoint only registers the
 * already-uploaded URL as a new `post_media` / `event_media` row.
 *
 * Server-controlled fields are intentionally EXCLUDED from the input:
 * - `id`         — generated by the DB
 * - the parent FK — comes from the URL param `/:id`
 * - `sortOrder`  — computed as max(visible sortOrder) + 1 (append to end)
 * - `isFeatured` — always `false` on create; managed by a separate endpoint
 * - `state`      — always `'visible'` on create
 * - `archivedAt` — null on create
 * - audit timestamps — set by the DB
 *
 * Field rules mirror {@link BaseContentMediaSchema} exactly, except that the
 * nullable row columns are plain `.optional()` here — a caller adding a photo
 * omits a caption, it does not send `null` for one.
 *
 * @see packages/schemas/src/entities/post/subtypes/post.media.schema.ts
 * @see packages/schemas/src/entities/event/subtypes/event.media.schema.ts
 */
export const ContentMediaAddPayloadSchema = z.object({
    /**
     * Full public URL of the photo (Cloudinary delivery URL or external CDN).
     * Required — the upload endpoint returns this URL before this call is made.
     */
    url: mediaAssetUrl('zodError.common.contentMedia.url.invalid'),
    /**
     * Cloudinary `public_id` (e.g. `hospeda/dev/abc123`).
     * Optional — historic or external-URL payloads may not carry one.
     */
    publicId: z
        .string()
        .min(1, { message: 'zodError.common.contentMedia.publicId.min' })
        .optional(),
    /** Short display caption (max 100 chars). Optional. */
    caption: z
        .string()
        .min(3, { message: 'zodError.common.contentMedia.caption.min' })
        .max(100, { message: 'zodError.common.contentMedia.caption.max' })
        .optional(),
    /** Longer description of photo content (max 300 chars). Optional. */
    description: z
        .string()
        .min(10, { message: 'zodError.common.contentMedia.description.min' })
        .max(300, { message: 'zodError.common.contentMedia.description.max' })
        .optional(),
    /**
     * Accessible alt text for `<img alt>` and screen readers.
     * Optional; falls back to caption / the post title or event name at render time.
     */
    alt: z
        .string()
        .min(1, { message: 'zodError.common.contentMedia.alt.min' })
        .max(200, { message: 'zodError.common.contentMedia.alt.max' })
        .optional(),
    /** Optional credits/source metadata (photographer, sourceUrl, license). */
    attribution: ImageAttributionSchema.nullable().optional(),
    /**
     * Content moderation state supplied by the upload endpoint.
     * When omitted the service defaults to `PENDING`.
     */
    moderationState: ModerationStatusEnumSchema.optional()
});

/** Inferred type for the shared add-photo payload. */
export type ContentMediaAddPayload = z.infer<typeof ContentMediaAddPayloadSchema>;

/**
 * Shared HTTP payload for reordering a post or event gallery.
 *
 * The caller supplies the FULL ordered list of visible media UUIDs; the service
 * validates that this set matches the current visible rows exactly (no extras,
 * no missing entries, no duplicates) before applying the new positions.
 */
export const ContentMediaReorderPayloadSchema = z.object({
    /** Ordered array of media-row UUIDs — exactly the current visible set. */
    orderedIds: z
        .array(z.string().uuid({ message: 'zodError.common.id.invalidUuid' }), {
            message: 'zodError.common.contentMedia.reorder.orderedIds.invalid'
        })
        .min(1, { message: 'zodError.common.contentMedia.reorder.orderedIds.min' })
});

/** Inferred type for the shared reorder payload. */
export type ContentMediaReorderPayload = z.infer<typeof ContentMediaReorderPayloadSchema>;
