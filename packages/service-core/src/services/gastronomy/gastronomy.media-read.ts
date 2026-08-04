/**
 * gastronomy.media-read.ts
 *
 * Async read-side glue that loads `gastronomy_media` rows and attaches the
 * composed `Media` shape onto gastronomy entities (HOS-372).
 *
 * Mirrors `accommodation.media-read.ts` field-for-field, delegating the pure
 * composition step to the SHARED `composeCommerceMedia` helper (unlike
 * accommodation, which has its own dedicated composer — see
 * `commerce-media-compose.ts` for why one function serves both commerce
 * verticals).
 *
 * Both helpers use the batch finder `findByGastronomies` (one `IN` query) so
 * list/search composition does not incur an N+1.
 *
 * Empty-composition fidelity: when a listing has no photos and no videos, the
 * composed object is `{}`. To avoid a `null → {}` shape drift, the original
 * `media` value is preserved in that case (mirrors accommodation).
 *
 * Fail-hard contract: a DB error from `findByGastronomies` propagates (no catch,
 * no JSONB fallback) — the relational table is the read source of truth.
 *
 * Videos come from the entity's own `videos` column, NOT from the media rows:
 * a video is an external YouTube/Vimeo URL rather than an uploaded asset, so it
 * was never migrated to the relational table (HOS-372).
 *
 * @module gastronomy.media-read
 */

import type { DrizzleClient, GastronomyMediaModel } from '@repo/db';
import type { Gastronomy, GastronomyMedia } from '@repo/schemas';
import { composeCommerceMedia } from '../commerce/commerce-media-compose';

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

/**
 * Returns the entity with its `media` rebuilt from the supplied rows, preserving
 * the original `media` value when there is nothing to compose (see module note).
 */
function withComposedGastronomyMedia<T extends Gastronomy>(
    entity: T,
    rows: readonly GastronomyMedia[]
): T {
    const composed = composeCommerceMedia({ rows, videos: entity.videos });
    const hasContent = Object.keys(composed).length > 0;
    return { ...entity, media: hasContent ? composed : entity.media } as T;
}

// ---------------------------------------------------------------------------
// Public attach helpers
// ---------------------------------------------------------------------------

/**
 * Loads the media rows for a single gastronomy listing and attaches the
 * composed `Media` shape. No-op for `null` (single-read miss).
 *
 * @param input.entity     - The gastronomy listing (or `null`).
 * @param input.mediaModel - The `gastronomy_media` model.
 * @param input.tx         - Optional active transaction client.
 */
export async function attachComposedGastronomyMedia<T extends Gastronomy>(input: {
    entity: T | null;
    mediaModel: GastronomyMediaModel;
    tx?: DrizzleClient;
}): Promise<T | null> {
    const { entity, mediaModel, tx } = input;
    if (!entity) return entity;
    const grouped = await mediaModel.findByGastronomies({ gastronomyIds: [entity.id], tx });
    return withComposedGastronomyMedia(entity, grouped.get(entity.id) ?? []);
}

/**
 * Loads the media rows for a list of gastronomy listings in a single batch query
 * and attaches the composed `Media` shape to each. No-op for an empty list.
 *
 * @param input.items      - The gastronomy listing array.
 * @param input.mediaModel - The `gastronomy_media` model.
 * @param input.tx         - Optional active transaction client.
 */
export async function attachComposedGastronomyMediaList<T extends Gastronomy>(input: {
    items: readonly T[];
    mediaModel: GastronomyMediaModel;
    tx?: DrizzleClient;
}): Promise<T[]> {
    const { items, mediaModel, tx } = input;
    if (!items || items.length === 0) return [...items];
    const grouped = await mediaModel.findByGastronomies({
        gastronomyIds: items.map((i) => i.id),
        tx
    });
    return items.map((item) => withComposedGastronomyMedia(item, grouped.get(item.id) ?? []));
}
