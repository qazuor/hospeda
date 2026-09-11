/**
 * media-text-patch.ts
 *
 * The one place that turns a validated text-metadata PATCH input into the
 * column patch a media model writes (HOS-1036).
 *
 * Five entities now expose the same endpoint — accommodation (HOS-388), post,
 * event, gastronomy and experience — and all five depend on the SAME
 * three-state rule, which is easy to get subtly wrong per copy:
 *
 * - a field that is `undefined` (omitted from the body) must NOT appear in the
 *   patch at all, so the existing column value survives;
 * - a field that is `null` must appear, so the column is CLEARED;
 * - a field with a value must appear, replacing the column.
 *
 * Spreading the whole payload into the patch instead would write `undefined`
 * over every omitted column — which Drizzle happily serializes as `NULL` on an
 * explicit `set` — turning "fix the alt text" into "erase the caption".
 *
 * @module media-text-patch
 */

/** The four text columns a media metadata PATCH may touch, plus nothing else. */
export interface MediaTextPatchInput {
    readonly caption?: string | null;
    readonly description?: string | null;
    readonly alt?: string | null;
    readonly attribution?: unknown;
}

/**
 * Build the column patch for a media text-metadata update.
 *
 * Only the keys the caller actually supplied are present in the result, so an
 * omitted field is never written. The result is intentionally NOT typed as the
 * media row: `attribution` is a JSONB column whose Drizzle type differs per
 * table, and each caller casts it once at its own `model.update` call.
 *
 * @param input - The parsed update input (URL params may be present; they are ignored).
 * @returns A patch object containing only the supplied text columns.
 */
export function buildMediaTextPatch(input: MediaTextPatchInput): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    if (input.caption !== undefined) patch.caption = input.caption;
    if (input.description !== undefined) patch.description = input.description;
    if (input.alt !== undefined) patch.alt = input.alt;
    if (input.attribution !== undefined) patch.attribution = input.attribution;
    return patch;
}
