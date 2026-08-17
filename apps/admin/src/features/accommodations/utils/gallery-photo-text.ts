/**
 * Builds the PATCH body for a photo's text metadata (HOS-388).
 *
 * Pure on purpose: every rule that makes this endpoint's contract work lives
 * here rather than inside a dialog, so it can be exercised without a DOM.
 *
 * Three rules, and each exists because getting it wrong is silent:
 *
 *  1. **Only changed fields travel.** The server leaves omitted keys untouched,
 *     so sending every field on every save would overwrite a value another
 *     moderator changed between the dialog opening and the save.
 *  2. **An emptied field becomes `null`, never `''`.** `null` is the endpoint's
 *     "clear this" signal. An empty string is a stored value: it reads as "this
 *     photo HAS an alt" to every consumer that checks presence, while announcing
 *     nothing to a screen reader — strictly worse than no alt at all, because it
 *     also suppresses any fallback.
 *  3. **Whitespace-only counts as empty.** Otherwise a stray space produces a
 *     technically-present alt with the same effect as (2).
 *
 * @module features/accommodations/utils/gallery-photo-text
 */

/** The text fields a moderator may correct on an existing photo. */
export interface PhotoTextValues {
    readonly caption: string;
    readonly description: string;
    readonly alt: string;
}

/** The PATCH body: only changed keys, `null` meaning "clear it". */
export type PhotoTextPatch = Partial<Record<keyof PhotoTextValues, string | null>>;

/** The stored row's text, as returned by the API (absent columns are nullish). */
export interface StoredPhotoText {
    readonly caption?: string | null;
    readonly description?: string | null;
    readonly alt?: string | null;
}

/** The three editable keys, in display order. */
export const PHOTO_TEXT_FIELDS = ['alt', 'caption', 'description'] as const;

/** Normalises a stored value into the string a text input should show. */
export function toFormValue(stored: string | null | undefined): string {
    return stored ?? '';
}

/** Seeds the form from a stored row. */
export function toFormValues(stored: StoredPhotoText): PhotoTextValues {
    return {
        caption: toFormValue(stored.caption),
        description: toFormValue(stored.description),
        alt: toFormValue(stored.alt)
    };
}

/**
 * Builds the minimal PATCH body for a save.
 *
 * @param stored - The row as it currently is on the server.
 * @param next - What the form holds now.
 * @returns Only the fields that changed, with emptied ones as `null`. An empty
 * object means nothing changed — the caller should skip the request entirely,
 * since the endpoint rejects an empty body as a VALIDATION_ERROR rather than
 * answering a silent 200.
 */
export function buildPhotoTextPatch({
    stored,
    next
}: {
    readonly stored: StoredPhotoText;
    readonly next: PhotoTextValues;
}): PhotoTextPatch {
    const patch: Record<string, string | null> = {};

    for (const field of PHOTO_TEXT_FIELDS) {
        const trimmed = next[field].trim();
        const nextValue = trimmed.length > 0 ? trimmed : null;
        const storedValue = stored[field] ?? null;

        // Compare against the stored value normalised the same way, so
        // re-saving an untouched field is a no-op rather than a write.
        const storedNormalised =
            typeof storedValue === 'string' && storedValue.trim().length > 0
                ? storedValue.trim()
                : null;

        if (nextValue !== storedNormalised) {
            patch[field] = nextValue;
        }
    }

    return patch;
}

/** Whether a patch would actually change anything. */
export function isEmptyPatch(patch: PhotoTextPatch): boolean {
    return Object.keys(patch).length === 0;
}
