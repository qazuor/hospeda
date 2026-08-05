import { z } from 'zod';
import {
    BaseContentMediaSchema,
    ContentMediaAddPayloadSchema,
    ContentMediaReorderPayloadSchema,
    ContentMediaStateSchema
} from '../../../common/content-media.schema.js';
import { EventIdSchema, EventMediaIdSchema } from '../../../common/id.schema.js';

/**
 * Zod schema for a single row in the `event_media` table (HOS-390).
 *
 * The row shape lives in {@link BaseContentMediaSchema}; this adds only the two
 * fields that are specific to events — its own id and the parent FK.
 *
 * Scope (mirrors SPEC-204 D1): this table covers the event's gallery, its
 * featured image, and archived rows. **Videos stay in the `events.media` JSONB
 * column** — they have no per-row state to track and no gallery ordering.
 *
 * @see packages/db/src/schemas/event/event_media.dbschema.ts — the table
 * @see packages/schemas/src/common/content-media.schema.ts — the shared row shape
 */
export const EventMediaSchema = BaseContentMediaSchema.extend({
    /** UUID primary key for this media row. */
    id: EventMediaIdSchema,
    /** UUID of the parent event (FK → events.id, ON DELETE CASCADE). */
    eventId: EventIdSchema
});

/**
 * Type inferred from `EventMediaSchema`.
 *
 * Structurally compatible with `SelectEventMedia` (the Drizzle-inferred type) so
 * `BaseModelImpl<EventMedia>` typechecks without casts.
 */
export type EventMedia = z.infer<typeof EventMediaSchema>;

// ----------------------------------------------------------------------------
// Command Input Schemas (HOS-390 step 3)
// ----------------------------------------------------------------------------
//
// Field-level rules live in the shared `ContentMedia*PayloadSchema` objects —
// posts and events differ ONLY in the name of the parent FK, so duplicating the
// payload shape per entity would be three copies of the same rules to keep in
// sync. Each entity re-exports the shared payload under its own name so route
// handlers and clients import an event-specific symbol.

/** HTTP payload for `POST /events/:id/media`. Alias of the shared content payload. */
export const EventMediaAddPayloadSchema = ContentMediaAddPayloadSchema;
/** Inferred type for the add-media payload. */
export type EventMediaAddPayload = z.infer<typeof EventMediaAddPayloadSchema>;

/**
 * Full service input for `addEventMedia`.
 * Combines the URL param `eventId` with the photo payload.
 */
export const EventMediaAddInputSchema = z.object({
    /** UUID of the parent event (from URL param `/:id`). */
    eventId: EventIdSchema,
    /** Photo payload received from the caller. */
    media: EventMediaAddPayloadSchema
});
/** Inferred type for the full add-media service input. */
export type EventMediaAddInput = z.infer<typeof EventMediaAddInputSchema>;

/** HTTP payload for `PATCH /events/:id/media/reorder`. */
export const EventMediaReorderPayloadSchema = ContentMediaReorderPayloadSchema;
/** Inferred type for the reorder payload. */
export type EventMediaReorderPayload = z.infer<typeof EventMediaReorderPayloadSchema>;

/** Service input for reordering an event gallery. */
export const EventMediaReorderInputSchema = z.object({
    /** UUID of the parent event (from URL param `/:id`). */
    eventId: EventIdSchema,
    /** Ordered array of visible media UUIDs. */
    orderedIds: EventMediaReorderPayloadSchema.shape.orderedIds
});
/** Inferred type for the reorder service input. */
export type EventMediaReorderInput = z.infer<typeof EventMediaReorderInputSchema>;

/** Service input for removing a single photo from an event gallery. */
export const EventMediaRemoveInputSchema = z.object({
    /** UUID of the parent event (from URL param `/:id`). */
    eventId: EventIdSchema,
    /** UUID of the media row to remove (from URL param `/:mediaId`). */
    mediaId: EventMediaIdSchema
});
/** Inferred type for the remove-media service input. */
export type EventMediaRemoveInput = z.infer<typeof EventMediaRemoveInputSchema>;

/** Service input for listing an event's media rows. */
export const EventMediaListInputSchema = z.object({
    /** UUID of the parent event (from URL param `/:id`). */
    eventId: EventIdSchema,
    /**
     * Visibility state filter. Defaults to `'visible'` (active gallery).
     * Pass `'archived'` to list photos moved out of the gallery.
     */
    state: ContentMediaStateSchema.optional()
});
/** Inferred type for the list-media service input. */
export type EventMediaListInput = z.infer<typeof EventMediaListInputSchema>;

/**
 * Service input for promoting an event photo to the featured image.
 *
 * DB invariants (extras carril 033, mirroring SPEC-204 T-003): at most ONE
 * featured row per event (partial unique index) and a featured photo can never
 * be `state = 'archived'` (CHECK constraint).
 */
export const EventMediaSetFeaturedInputSchema = z.object({
    /** UUID of the parent event (from URL param `/:id`). */
    eventId: EventIdSchema,
    /** UUID of the media row to promote as featured (from URL param `/:mediaId`). */
    mediaId: EventMediaIdSchema
});
/** Inferred type for the set-featured service input. */
export type EventMediaSetFeaturedInput = z.infer<typeof EventMediaSetFeaturedInputSchema>;

// ----------------------------------------------------------------------------
// Command Output Schemas
// ----------------------------------------------------------------------------

/** Single-row output envelope for add-media / set-featured responses. */
export const EventMediaSingleOutputSchema = z.object({
    media: EventMediaSchema
});
/** Inferred type for a single-media response. */
export type EventMediaSingleOutput = z.infer<typeof EventMediaSingleOutputSchema>;

/** List output envelope for `GET /events/:id/media` and reorder responses. */
export const EventMediaListOutputSchema = z.object({
    media: z.array(EventMediaSchema)
});
/** Inferred type for a media list response. */
export type EventMediaListOutput = z.infer<typeof EventMediaListOutputSchema>;
