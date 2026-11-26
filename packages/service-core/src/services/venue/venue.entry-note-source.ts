/**
 * The venue `entryNote` as a translation source (HOS-2658, AC-25, spec §8.6).
 *
 * `entryNoteI18n` has no plain column: its `es` is the Spanish SOURCE and its
 * `en` / `pt` are translation pairs owned by the single translation writer.
 * A nightInfo save therefore writes `es` from the body and keeps the STORED
 * `en` / `pt` — the body's `en` / `pt` are ignored, so a stale form can never
 * clobber a MANUAL pair.
 *
 * @module services/venue/venue.entry-note-source
 */

/** The stored or written shape of `entryNoteI18n`. */
export type VenueEntryNoteI18n = { readonly es: string; readonly en: string; readonly pt: string };

/**
 * Resolves the `entryNoteI18n` value an update persists.
 *
 * @param input - The body value and the stored value.
 * @returns Object with `patch`: `{}` when the body does not carry an object
 *   (absent or `null` passes through untouched), otherwise `{ entryNoteI18n }`
 *   with `es` from the body and `en` / `pt` from the stored row (`''` when absent).
 */
export function resolveVenueEntryNoteSourcePatch({
    body,
    stored
}: {
    readonly body: unknown;
    readonly stored?: Partial<VenueEntryNoteI18n> | null;
}): { readonly patch: { readonly entryNoteI18n?: VenueEntryNoteI18n } } {
    if (body === null || typeof body !== 'object') {
        return { patch: {} };
    }
    const es = (body as { es?: unknown }).es;
    return {
        patch: {
            entryNoteI18n: {
                es: typeof es === 'string' ? es : '',
                en: stored?.en ?? '',
                pt: stored?.pt ?? ''
            }
        }
    };
}
