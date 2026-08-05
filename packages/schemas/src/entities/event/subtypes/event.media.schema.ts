import type { z } from 'zod';
import { BaseContentMediaSchema } from '../../../common/content-media.schema.js';
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
