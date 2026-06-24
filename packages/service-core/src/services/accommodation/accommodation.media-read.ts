/**
 * accommodation.media-read.ts
 *
 * Async read-side glue that loads `accommodation_media` rows and attaches the
 * composed `Media` shape onto accommodation entities (SPEC-204, T-013).
 *
 * Phase 2 (P2) read switch:
 *  - `featuredImage`, `gallery`, and `archivedGallery` are now READ from the
 *    relational table via {@link composeAccommodationMedia}.
 *  - `videos` continue to be carried from the JSONB `media.videos` (D1 decision).
 *  - Writes still go to BOTH stores (write-both stays on until P3), so the JSONB
 *    column remains consistent for the raw-JSONB readers not yet migrated
 *    (search cover-image, bookmark enrichment, billing limit/downgrade) — those
 *    move to the table in P3 (T-024 cutover).
 *
 * Both helpers use the batch finder `findByAccommodations` (one `IN` query) so
 * list/search composition does not incur an N+1.
 *
 * Empty-composition fidelity: when an accommodation has no photos and no videos,
 * the composed object is `{}`. To avoid a `null → {}` shape drift that would
 * break the T-015 golden shape-stability test, the original `media` value is
 * preserved in that case.
 *
 * Fail-hard contract: a DB error from `findByAccommodations` propagates (no catch,
 * no JSONB fallback). In P2 the relational table is the read source of truth, so a
 * failure to read it SHOULD surface rather than silently serve a stale JSONB blob.
 *
 * Scope (T-013): only the standard service read chokepoints route through these
 * helpers — `_afterGetByField` (getById/slug/name/adminGetById), `_afterList`,
 * `_afterSearch`, and `getSummary`. Read paths that bypass those hooks and still
 * read JSONB directly are DEFERRED to P3 (T-024 cutover), and are safe in P2
 * because write-both keeps the JSONB column in sync:
 *   - `getByDestination`, `getByOwner`, `getTopRated`, `getTopRatedByDestination`
 *     (build their response without the list hooks).
 *   - raw-JSONB readers outside this service: search cover-image, bookmark
 *     enrichment, billing limit/downgrade services.
 *
 * @module accommodation.media-read
 */

import type { AccommodationMediaModel, DrizzleClient } from '@repo/db';
import type { Accommodation, AccommodationMedia } from '@repo/schemas';
import { composeAccommodationMedia } from './accommodation.media-compose';

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

/**
 * Returns the entity with its `media` rebuilt from the supplied rows, preserving
 * the original `media` value when there is nothing to compose (see module note).
 */
function withComposedMedia<T extends Accommodation>(
    entity: T,
    rows: readonly AccommodationMedia[]
): T {
    const composed = composeAccommodationMedia({ rows, currentMedia: entity.media });
    const hasContent = Object.keys(composed).length > 0;
    return { ...entity, media: hasContent ? composed : entity.media } as T;
}

// ---------------------------------------------------------------------------
// Public attach helpers
// ---------------------------------------------------------------------------

/**
 * Loads the media rows for a single accommodation and attaches the composed
 * `Media` shape. No-op for `null` (single-read miss).
 *
 * @param input.entity     - The accommodation (or `null`).
 * @param input.mediaModel - The `accommodation_media` model.
 * @param input.tx         - Optional active transaction client.
 */
export async function attachComposedMedia<T extends Accommodation>(input: {
    entity: T | null;
    mediaModel: AccommodationMediaModel;
    tx?: DrizzleClient;
}): Promise<T | null> {
    const { entity, mediaModel, tx } = input;
    if (!entity) return entity;
    const grouped = await mediaModel.findByAccommodations({ accommodationIds: [entity.id], tx });
    return withComposedMedia(entity, grouped.get(entity.id) ?? []);
}

/**
 * Loads the media rows for a list of accommodations in a single batch query and
 * attaches the composed `Media` shape to each. No-op for an empty list.
 *
 * @param input.items      - The accommodation list.
 * @param input.mediaModel - The `accommodation_media` model.
 * @param input.tx         - Optional active transaction client.
 */
export async function attachComposedMediaList<T extends Accommodation>(input: {
    items: readonly T[];
    mediaModel: AccommodationMediaModel;
    tx?: DrizzleClient;
}): Promise<T[]> {
    const { items, mediaModel, tx } = input;
    if (!items || items.length === 0) return [...items];
    const grouped = await mediaModel.findByAccommodations({
        accommodationIds: items.map((i) => i.id),
        tx
    });
    return items.map((item) => withComposedMedia(item, grouped.get(item.id) ?? []));
}
