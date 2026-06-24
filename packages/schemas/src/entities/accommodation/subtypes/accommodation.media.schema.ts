import { z } from 'zod';
import { AccommodationIdSchema, AccommodationMediaIdSchema } from '../../../common/id.schema.js';
import { ImageAttributionSchema } from '../../../common/media.schema.js';
import { ModerationStatusEnumSchema } from '../../../enums/index.js';

/**
 * Enum schema for the visibility state of a single accommodation media row.
 *
 * - `visible`  — photo is part of the active gallery (or is the featured image).
 * - `archived` — photo was moved out of the gallery (e.g. plan downgrade over-limit).
 *
 * Mirrors the `AccommodationMediaStatePgEnum` values defined in the DB layer
 * (`packages/db/src/schemas/accommodation/accommodation_media.dbschema.ts`).
 */
export const AccommodationMediaStateSchema = z.enum(['visible', 'archived'], {
    message: 'zodError.accommodation.media.state.invalid'
});
export type AccommodationMediaState = z.infer<typeof AccommodationMediaStateSchema>;

/**
 * Zod schema for a single row in the `accommodation_media` table.
 *
 * Mirrors `ImageSchema` fields from `packages/schemas/src/common/media.schema.ts`
 * EXACTLY, plus the relational + state columns added by SPEC-204.
 *
 * Key design notes (locked decisions):
 * - D1: this entity covers gallery + archived + featured photos only. Videos stay
 *       in the `accommodations.media` JSONB column.
 * - D2: visibility is `state` enum + `isFeatured` boolean (not a 3-way kind enum).
 * - `attribution` is stored as a nullable JSONB object in Postgres — modeled here
 *   as `ImageAttributionSchema.nullable()` to align with the DB column type.
 * - Audit columns (`createdAt`, `updatedAt`, `deletedAt`) use `z.coerce.date()` to
 *   accept both Date objects and ISO strings (pg driver may return either).
 * - `createdById`, `updatedById`, `deletedById` are NOT present — the
 *   `accommodation_media` table does not have those columns, unlike the parent
 *   `accommodations` table. Do NOT spread `BaseAuditFields` here.
 *
 * @see packages/db/src/schemas/accommodation/accommodation_media.dbschema.ts
 * @see packages/schemas/src/common/media.schema.ts — `ImageSchema` (the media-item shape)
 */
export const AccommodationMediaSchema = z.object({
    // ── Identity & ownership ──────────────────────────────────────────────────
    /** UUID primary key for this media row. */
    id: AccommodationMediaIdSchema,
    /** UUID of the parent accommodation (FK → accommodations.id). */
    accommodationId: AccommodationIdSchema,

    // ── Image fields (mirrors ImageSchema EXACTLY) ────────────────────────────
    /**
     * Full public URL of the photo (Cloudinary delivery URL or external CDN).
     * Required — every media row must have a URL.
     */
    url: z.string().url({ message: 'zodError.common.media.image.url.invalid' }),
    /**
     * Short display caption (max 100 chars in Zod).
     * Nullable/optional — not all uploads include a caption.
     */
    caption: z
        .string()
        .min(3, { message: 'zodError.common.media.image.caption.min' })
        .max(100, { message: 'zodError.common.media.image.caption.max' })
        .optional(),
    /**
     * Longer description of photo content (max 300 chars).
     * Nullable/optional.
     */
    description: z
        .string()
        .min(10, { message: 'zodError.common.media.image.description.min' })
        .max(300, { message: 'zodError.common.media.image.description.max' })
        .optional(),
    /**
     * Accessible alt text for `<img alt>` and screen readers.
     * Optional; falls back to caption / accommodation name at render time.
     */
    alt: z
        .string()
        .min(1, { message: 'zodError.common.media.image.alt.min' })
        .max(200, { message: 'zodError.common.media.image.alt.max' })
        .optional(),
    /**
     * Cloudinary `public_id` (e.g. `hospeda/dev/abc123`).
     * Optional — historic payloads and external URLs do not carry a Cloudinary id.
     */
    publicId: z.string().min(1, { message: 'zodError.common.media.image.publicId.min' }).optional(),
    /**
     * Optional credits/source metadata (photographer, sourceUrl, license).
     * Nullable because the DB column is JSONB nullable.
     */
    attribution: ImageAttributionSchema.nullable().optional(),
    /**
     * Content moderation state: `PENDING` | `APPROVED` | `REJECTED`.
     * Reuses `ModerationStatusEnumSchema` from `@repo/schemas`.
     */
    moderationState: ModerationStatusEnumSchema,

    // ── Media-row state ───────────────────────────────────────────────────────
    /**
     * Visibility state within the accommodation media collection.
     * `visible` = active gallery; `archived` = moved out on plan downgrade.
     */
    state: AccommodationMediaStateSchema,
    /**
     * When `true` this row is the featured / cover image for the accommodation.
     * At most one non-deleted row per accommodation can be featured (enforced by
     * a partial unique index in the DB extras carril, T-003).
     */
    isFeatured: z.boolean(),
    /**
     * 0-based display order within the active gallery. Lower = appears first.
     */
    sortOrder: z.number().int({ message: 'zodError.accommodation.media.sortOrder.int' }),
    /**
     * Timestamp set when the photo is moved to `state = 'archived'`.
     * Null while the photo is visible. Used for FIFO restore ordering.
     */
    archivedAt: z.coerce.date().nullable().optional(),

    // ── Audit columns (no *ById — this table omits them) ─────────────────────
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

/**
 * Type inferred from `AccommodationMediaSchema`.
 *
 * Structurally compatible with `SelectAccommodationMedia` (the Drizzle-inferred type)
 * so the model generic `BaseModelImpl<AccommodationMedia>` typechecks without casts.
 */
export type AccommodationMedia = z.infer<typeof AccommodationMediaSchema>;

// ----------------------------------------------------------------------------
// Command Input Schemas (SPEC-204 granular gallery endpoints)
// ----------------------------------------------------------------------------

/**
 * Input payload for adding a single photo to an accommodation gallery.
 *
 * This is a URL-receiver schema: the upload to Cloudinary has already happened
 * via `POST /api/v1/admin/media/upload`. This endpoint registers the already-
 * uploaded URL as a new `accommodation_media` row.
 *
 * Server-controlled fields are intentionally EXCLUDED from the input:
 * - `id`               — generated by the DB
 * - `accommodationId`  — comes from the URL param `/:id`
 * - `sortOrder`        — computed as max(visible sortOrder) + 1 (append to end)
 * - `isFeatured`       — always `false` on create; managed by a separate endpoint
 * - `state`            — always `'visible'` on create
 * - `archivedAt`       — null on create (set when archiving)
 * - Audit timestamps   — set by the DB
 */
export const AccommodationMediaAddPayloadSchema = z.object({
    /**
     * Full public URL of the photo (Cloudinary delivery URL or external CDN).
     * Required — the upload endpoint returns this URL before this call is made.
     */
    url: z.string().url({ message: 'zodError.common.media.image.url.invalid' }),
    /**
     * Cloudinary `public_id` (e.g. `hospeda/dev/abc123`).
     * Optional — historic or external-URL payloads may not carry one.
     */
    publicId: z.string().min(1, { message: 'zodError.common.media.image.publicId.min' }).optional(),
    /**
     * Short display caption (max 100 chars).
     * Optional — not all photos include a caption.
     */
    caption: z
        .string()
        .min(3, { message: 'zodError.common.media.image.caption.min' })
        .max(100, { message: 'zodError.common.media.image.caption.max' })
        .optional(),
    /**
     * Longer description of photo content (max 300 chars).
     * Optional.
     */
    description: z
        .string()
        .min(10, { message: 'zodError.common.media.image.description.min' })
        .max(300, { message: 'zodError.common.media.image.description.max' })
        .optional(),
    /**
     * Accessible alt text for `<img alt>` and screen readers.
     * Optional; falls back to caption / accommodation name at render time.
     */
    alt: z
        .string()
        .min(1, { message: 'zodError.common.media.image.alt.min' })
        .max(200, { message: 'zodError.common.media.image.alt.max' })
        .optional(),
    /**
     * Optional credits/source metadata (photographer, sourceUrl, license).
     */
    attribution: ImageAttributionSchema.nullable().optional(),
    /**
     * Content moderation state supplied by the upload endpoint.
     * When omitted the service defaults to `'PENDING'`.
     * Upload endpoint pre-approves images, so callers should pass `'APPROVED'`.
     */
    moderationState: ModerationStatusEnumSchema.optional()
});

/** Inferred type for the add-media payload. */
export type AccommodationMediaAddPayload = z.infer<typeof AccommodationMediaAddPayloadSchema>;

/**
 * Full service input for `AccommodationService.addMedia`.
 * Combines the URL param `accommodationId` with the photo payload.
 */
export const AccommodationMediaAddInputSchema = z.object({
    /** UUID of the parent accommodation (from URL param `/:id`). */
    accommodationId: AccommodationIdSchema,
    /** Photo payload received from the caller. */
    media: AccommodationMediaAddPayloadSchema
});

/** Inferred type for the full add-media service input. */
export type AccommodationMediaAddInput = z.infer<typeof AccommodationMediaAddInputSchema>;

// ----------------------------------------------------------------------------
// Command Output Schemas (SPEC-204 granular gallery endpoints)
// ----------------------------------------------------------------------------

/**
 * Single-row output schema for add-media / update-media / get-media-by-id responses.
 * Wraps the created/updated `AccommodationMedia` row in a `media` key, mirroring
 * the `{ faq: ... }` envelope used by FAQ endpoints.
 */
export const AccommodationMediaSingleOutputSchema = z.object({
    media: AccommodationMediaSchema
});

/** Inferred type for a single-media response. */
export type AccommodationMediaSingleOutput = z.infer<typeof AccommodationMediaSingleOutputSchema>;

/**
 * List output schema for `GET /:id/media` responses.
 * Wraps an ordered array of `AccommodationMedia` rows in a `media` key, mirroring
 * the `{ faqs: [...] }` envelope used by FAQ list endpoints.
 */
export const AccommodationMediaListOutputSchema = z.object({
    media: z.array(AccommodationMediaSchema)
});

/** Inferred type for a media list response. */
export type AccommodationMediaListOutput = z.infer<typeof AccommodationMediaListOutputSchema>;

// ----------------------------------------------------------------------------
// Remove Input Schema (SPEC-204 T-018)
// ----------------------------------------------------------------------------

/**
 * Service input schema for removing a single media row from an accommodation gallery.
 * The row is soft-deleted and the remaining visible rows are resequenced.
 */
export const AccommodationMediaRemoveInputSchema = z.object({
    /** UUID of the parent accommodation (from URL param `/:id`). */
    accommodationId: AccommodationIdSchema,
    /** UUID of the media row to remove (from URL param `/:mediaId`). */
    mediaId: AccommodationMediaIdSchema
});

/** Inferred type for the remove-media service input. */
export type AccommodationMediaRemoveInput = z.infer<typeof AccommodationMediaRemoveInputSchema>;

// ----------------------------------------------------------------------------
// Reorder Input Schema (SPEC-204 T-019)
// ----------------------------------------------------------------------------

/**
 * HTTP payload schema for `PATCH /:id/media/reorder`.
 * The caller supplies the full ordered list of visible media UUIDs; the service
 * validates that this set matches the current visible rows exactly and then
 * applies the new `sortOrder` positions.
 */
export const AccommodationMediaReorderPayloadSchema = z.object({
    /**
     * Ordered array of `accommodation_media` UUIDs.
     * Must contain exactly the same IDs as the current visible rows — no extras,
     * no missing entries. The service rejects any mismatch with `VALIDATION_ERROR`.
     */
    orderedIds: z
        .array(AccommodationMediaIdSchema, {
            message: 'zodError.accommodation.media.reorder.orderedIds.invalid'
        })
        .min(1, { message: 'zodError.accommodation.media.reorder.orderedIds.min' })
});

/** Inferred type for the reorder payload. */
export type AccommodationMediaReorderPayload = z.infer<
    typeof AccommodationMediaReorderPayloadSchema
>;

/**
 * Service input schema for reordering an accommodation's gallery (SPEC-204 T-019).
 * Combines the URL param `accommodationId` with the ordered-ids payload.
 */
export const AccommodationMediaReorderInputSchema = z.object({
    /** UUID of the parent accommodation (from URL param `/:id`). */
    accommodationId: AccommodationIdSchema,
    /** Ordered array of visible media UUIDs. */
    orderedIds: AccommodationMediaReorderPayloadSchema.shape.orderedIds
});

/** Inferred type for the reorder service input. */
export type AccommodationMediaReorderInput = z.infer<typeof AccommodationMediaReorderInputSchema>;

// ----------------------------------------------------------------------------
// List Input Schema (SPEC-204 — GET /:id/media)
// ----------------------------------------------------------------------------

/**
 * Service input schema for listing an accommodation's media rows.
 * Supports an optional `state` filter (defaults to `'visible'`).
 */
export const AccommodationMediaListInputSchema = z.object({
    /** UUID of the parent accommodation (from URL param `/:id`). */
    accommodationId: AccommodationIdSchema,
    /**
     * Visibility state filter.
     * Defaults to `'visible'` (active gallery photos).
     * Pass `'archived'` to list photos moved out of the gallery.
     */
    state: AccommodationMediaStateSchema.optional()
});

/** Inferred type for the list-media service input. */
export type AccommodationMediaListInput = z.infer<typeof AccommodationMediaListInputSchema>;
