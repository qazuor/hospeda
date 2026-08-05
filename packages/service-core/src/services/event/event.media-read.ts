/**
 * event.media-read.ts
 *
 * Async read-side glue that loads `event_media` rows and attaches the composed
 * `Media` shape onto event entities (HOS-390).
 *
 * Mirrors `gastronomy.media-read.ts` field-for-field, delegating the pure
 * composition step to {@link composeContentMedia}.
 *
 * Both helpers use the batch finder `findByEvents` (one `IN` query) so
 * list/search composition does not incur an N+1.
 *
 * ## Deliberate divergence from the accommodation/gastronomy molde
 *
 * Those helpers preserve the entity's ORIGINAL `media` whenever the composed
 * object comes out empty, purely to avoid a `null → {}` shape drift. Copying
 * that rule here would be a bug, because unlike theirs the `events.media` JSONB
 * column is NOT dropped and still holds the pre-HOS-390 photo blob:
 *
 * - An author who deletes every photo leaves zero relational rows, the
 *   composition comes out empty, and the fallback would resurrect the stale blob
 *   gallery they just deleted.
 * - Worse, whether that happened would depend on whether the event has VIDEOS:
 *   with videos the composed object is non-empty (`{ videos }`) and the photos
 *   vanish; without videos it is empty and they come back.
 *
 * So the rows are authoritative for photos, full stop — an emptied gallery stays
 * empty. The only thing preserved is a `null`/`undefined` `media` with nothing
 * to compose, which keeps the shape from drifting to `{}` for an event that never
 * had any media at all.
 *
 * The corollary is the deploy gate: until the `0037-hos-390-content-media-to-relational`
 * seed data-migration has run, events have no rows and therefore no photos. That
 * migration MUST be applied before this switch reaches an environment.
 *
 * Fail-hard contract: a DB error from `findByEvents` propagates (no catch, no
 * JSONB fallback) — the relational table is the read source of truth for photos.
 *
 * Videos come from the event's own `media.videos` blob, NOT from the media rows:
 * a video is an external YouTube/Vimeo URL rather than an uploaded asset, so it
 * was never migrated to the relational table (SPEC-204 D1 / HOS-390).
 *
 * @module event.media-read
 */

import type { DrizzleClient, EventMediaModel } from '@repo/db';
import type { Event, EventMedia } from '@repo/schemas';
import { composeContentMedia } from '../media/content-media-compose';

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

/**
 * Returns the event with its `media` rebuilt from the supplied rows.
 *
 * The composed value ALWAYS wins — see the module note for why falling back to
 * the entity's own `media` on an empty composition would resurrect deleted
 * photos from the legacy blob. The single exception keeps an event that has no
 * media at all from drifting `null`/`undefined` to `{}`.
 */
function withComposedEventMedia<T extends Event>(entity: T, rows: readonly EventMedia[]): T {
    const composed = composeContentMedia({ rows, videos: entity.media?.videos });
    if (entity.media == null && Object.keys(composed).length === 0) return entity;
    return { ...entity, media: composed } as T;
}

// ---------------------------------------------------------------------------
// Public attach helpers
// ---------------------------------------------------------------------------

/**
 * Loads the media rows for a single event and attaches the composed `Media`
 * shape. No-op for `null` (single-read miss).
 *
 * @param input.entity     - The event (or `null`).
 * @param input.mediaModel - The `event_media` model.
 * @param input.tx         - Optional active transaction client.
 */
export async function attachComposedEventMedia<T extends Event>(input: {
    entity: T | null;
    mediaModel: EventMediaModel;
    tx?: DrizzleClient;
}): Promise<T | null> {
    const { entity, mediaModel, tx } = input;
    if (!entity) return entity;
    const grouped = await mediaModel.findByEvents({ eventIds: [entity.id], tx });
    return withComposedEventMedia(entity, grouped.get(entity.id) ?? []);
}

/**
 * Loads the media rows for a list of events in a single batch query and attaches
 * the composed `Media` shape to each. No-op for an empty list.
 *
 * @param input.items      - The event array.
 * @param input.mediaModel - The `event_media` model.
 * @param input.tx         - Optional active transaction client.
 */
export async function attachComposedEventMediaList<T extends Event>(input: {
    items: readonly T[];
    mediaModel: EventMediaModel;
    tx?: DrizzleClient;
}): Promise<T[]> {
    const { items, mediaModel, tx } = input;
    // `!items` covers undefined/null, which a caller can reach when a model
    // stub or an error path yields a result object with no `items` key —
    // spreading it (as the gastronomy molde does) throws a TypeError instead.
    if (!items || items.length === 0) return items ? [...items] : [];
    const grouped = await mediaModel.findByEvents({ eventIds: items.map((i) => i.id), tx });
    return items.map((item) => withComposedEventMedia(item, grouped.get(item.id) ?? []));
}
