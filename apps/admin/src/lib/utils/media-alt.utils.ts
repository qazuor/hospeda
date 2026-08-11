/**
 * @file media-alt.utils.ts
 * Derives a fallback `alt` text for a newly-uploaded gallery photo from the
 * name of the entity it belongs to (accommodation / gastronomy / experience).
 *
 * Context (HOS-382 accessibility fix): the granular gallery `addMedia`
 * endpoints have no companion `updateMedia` endpoint, so `alt` can only be
 * set at creation time — there is no later edit path to backfill it. The
 * owner decided this is a deliberate PARTIAL improvement: the entity name is
 * not a descriptive caption of the photo's content, just a non-empty
 * fallback that keeps the image in the accessibility tree instead of the
 * previous `alt=""`.
 */

/**
 * Upper bound shared by every commerce-media `alt` schema
 * (`GastronomyMediaAddPayloadSchema`, `ExperienceMediaAddPayloadSchema`,
 * `AccommodationMediaAddPayloadSchema` — see `packages/schemas`). Kept as a
 * named constant here so the truncation below stays obviously in sync with
 * the Zod `.max(200)` constraint it exists to satisfy.
 */
const MEDIA_ALT_MAX_LENGTH = 200;

/**
 * Derives a safe `alt` value for a gallery photo from its parent entity's
 * display name.
 *
 * Returns `undefined` (never an invalid string) when the name is missing or
 * blank after trimming — callers should omit `alt` from the `addMedia`
 * payload in that case rather than send an empty value the API will reject
 * with a 400. A name that's too LONG is not rejected: it's truncated to
 * `MEDIA_ALT_MAX_LENGTH` so the schema's upper bound is still satisfied.
 *
 * @param entityName - The accommodation/gastronomy/experience display name,
 *   if already available to the caller (e.g. from the page's own entity
 *   query). `undefined`/`null` are accepted so call sites don't need to
 *   guard before calling.
 * @returns A trimmed, length-bounded `alt` string, or `undefined` if no
 *   valid value can be derived.
 */
export function deriveAltFromEntityName(entityName: string | null | undefined): string | undefined {
    if (!entityName) {
        return undefined;
    }

    const trimmed = entityName.trim();
    if (trimmed.length === 0) {
        return undefined;
    }

    return trimmed.length > MEDIA_ALT_MAX_LENGTH ? trimmed.slice(0, MEDIA_ALT_MAX_LENGTH) : trimmed;
}
