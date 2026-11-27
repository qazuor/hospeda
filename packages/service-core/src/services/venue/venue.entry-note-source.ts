/**
 * The venue `entryNote` as a translation source (HOS-2658, AC-25, spec §8.6).
 *
 * `entryNoteI18n` has no plain column: its `es` is the Spanish SOURCE and its
 * `en` / `pt` are translation pairs owned by the single translation writer.
 * A nightInfo save therefore writes ONLY `es` from the body — the body's
 * `en` / `pt` are ignored, so a stale form can never clobber a MANUAL pair.
 *
 * The write itself is atomic on the current row
 * (`VenueModel.buildEntryNoteSourceUpdate`): `en` / `pt` are read by the UPDATE,
 * never from a snapshot taken earlier in the request, so a manual correction
 * committed between that snapshot and the UPDATE survives (DL-9).
 *
 * @module services/venue/venue.entry-note-source
 */

/**
 * Resolves the Spanish `entryNote` source an update writes.
 *
 * @param input - Object with `body`, the request's `entryNoteI18n` value.
 * @returns Object with `es`: `undefined` when the body does not carry an object
 *   (absent or `null` passes through untouched), otherwise the body's `es`
 *   (`''` when it is not a string).
 */
export function resolveVenueEntryNoteSource({ body }: { readonly body: unknown }): {
    readonly es?: string;
} {
    if (body === null || typeof body !== 'object') {
        return {};
    }
    const es = (body as { es?: unknown }).es;
    return { es: typeof es === 'string' ? es : '' };
}
