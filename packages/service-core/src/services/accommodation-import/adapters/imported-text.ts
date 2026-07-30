/**
 * Imported description/summary normalisation (HOS-286)
 *
 * Turns a provider's free-text listing description into the two accommodation
 * text fields, respecting BOTH ends of their schema bounds:
 *
 * | Field         | min | max  |
 * |---------------|-----|------|
 * | `summary`     |  10 |  300 |
 * | `description` |  30 | 2000 |
 *
 * Both bounds matter, for different reasons:
 *
 * - **Over the max** the import draft schema silently DROPS the candidate
 *   (`AccommodationImportDraftSchema.summary` is `.max(300)`), so an
 *   untruncated summary arrives as an empty field — the original bug.
 * - **Under the min** the candidate survives the permissive draft schema and
 *   pre-fills the creation form, which then refuses to submit against
 *   `AccommodationCreateDraftHttpSchema`. A one-line seller description
 *   ("Consultar por WhatsApp.") would hand the host a form they cannot save
 *   and did not fill in themselves. Below the min we emit nothing and let the
 *   host write the field.
 *
 * Kept out of the adapter so the rules are unit-testable directly and reusable
 * by any other provider whose description is a single blob of text.
 *
 * @module services/accommodation-import/adapters/imported-text
 */

/**
 * Character bounds of `AccommodationSchema.description`.
 * A pre-fill outside these is worse than no pre-fill at all — see the module
 * header.
 */
const DESCRIPTION_MIN_CHARS = 30;
const DESCRIPTION_MAX_CHARS = 2000;

/** Character bounds of `AccommodationSchema.summary` ("Descripción corta"). */
const SUMMARY_MIN_CHARS = 10;
const SUMMARY_MAX_CHARS = 300;

/** Matches a run of whitespace that surrounds a single line break. */
const LINE_BREAK_WITH_PADDING_RE = /[^\S\n]*\n[^\S\n]*/g;

/** Matches three or more consecutive line breaks. */
const EXCESS_NEWLINES_RE = /\n{3,}/g;

/** Matches runs of spaces/tabs (but not line breaks). */
const INLINE_WHITESPACE_RE = /[^\S\n]+/g;

/** Matches any run of whitespace, including line breaks. */
const ANY_WHITESPACE_RE = /\s+/g;

/** Highest UTF-16 code unit that can start a surrogate pair. */
const HIGH_SURROGATE_START = 0xd800;
const HIGH_SURROGATE_END = 0xdbff;

/**
 * Drops a trailing lone high surrogate, if any.
 *
 * A hard character cut can land between the two code units of an astral
 * character (an emoji), leaving an unpaired surrogate that encodes to U+FFFD
 * once stored. Cheaper and clearer than converting the whole string to a
 * code-point array for a case that only arises on the no-whitespace fallback
 * path.
 *
 * @param text - Possibly surrogate-split string.
 * @returns The string with any trailing lone high surrogate removed.
 */
function dropDanglingSurrogate(text: string): string {
    const lastUnit = text.charCodeAt(text.length - 1);
    return lastUnit >= HIGH_SURROGATE_START && lastUnit <= HIGH_SURROGATE_END
        ? text.slice(0, -1)
        : text;
}

/**
 * Truncates `text` to at most `maxChars` characters, cutting on a word boundary
 * and appending a single ellipsis so the host can see it was shortened.
 *
 * Falls back to a hard (surrogate-safe) cut when the retained slice contains no
 * whitespace at all — one very long token — so the cap always holds.
 *
 * @param input - The text to shorten and its inclusive character ceiling.
 * @returns `text` unchanged when it already fits, otherwise the truncated form.
 *
 * @example
 * ```ts
 * truncateAtWordBoundary({ text: 'uno dos tres', maxChars: 8 }); // 'uno dos…'
 * ```
 */
export function truncateAtWordBoundary(input: {
    readonly text: string;
    readonly maxChars: number;
}): string {
    const { text, maxChars } = input;
    if (text.length <= maxChars) {
        return text;
    }
    // Reserve one character for the ellipsis.
    const slice = text.slice(0, maxChars - 1);
    const lastSpace = slice.lastIndexOf(' ');
    const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : dropDanglingSurrogate(slice);
    return `${cut.trimEnd()}…`;
}

/**
 * Normalises a provider's raw plain-text description into the long-form
 * `description` candidate.
 *
 * Collapses runs of spaces/tabs, caps consecutive blank lines at one, trims,
 * and truncates to the schema max. Paragraph breaks are preserved — the
 * accommodation description is a multi-paragraph field.
 *
 * @param input - The provider's raw plain-text description.
 * @returns The normalised description, or `null` when it is blank or too short
 *   to satisfy the accommodation schema's minimum.
 *
 * @example
 * ```ts
 * toDescriptionText({ plainText: 'Consultar.' }); // null — under the 30-char min
 * ```
 */
export function toDescriptionText(input: { readonly plainText: string }): string | null {
    // Order matters: strip the padding AROUND each line break first, otherwise
    // the inline-whitespace pass leaves a space between consecutive breaks and
    // `\n{3,}` can never match.
    const normalised = input.plainText
        .replace(/\r\n?/g, '\n')
        .replace(LINE_BREAK_WITH_PADDING_RE, '\n')
        .replace(EXCESS_NEWLINES_RE, '\n\n')
        .replace(INLINE_WHITESPACE_RE, ' ')
        .trim();

    const description = truncateAtWordBoundary({
        text: normalised,
        maxChars: DESCRIPTION_MAX_CHARS
    });

    // Checked AFTER truncation, exactly like `toSummaryText`. The word-boundary
    // cut falls back to the LAST space inside the window, so a short opener
    // followed by a long space-free run ("Ver <2200-char URL>", or a `=====`
    // separator rule) collapses to a handful of characters — well under the
    // 30-char minimum, and pre-filled into a field the host never touched.
    return description.length < DESCRIPTION_MIN_CHARS ? null : description;
}

/**
 * Derives the short `summary` candidate from the same raw plain-text
 * description: flattens it to a single line and truncates it on a word
 * boundary.
 *
 * Providers like MercadoLibre expose no dedicated short-description field, so
 * the summary is derived rather than left empty. The host reviews and edits it
 * in the creation form before saving.
 *
 * @param input - The provider's raw plain-text description.
 * @returns The derived summary, or `null` when it is blank or too short to
 *   satisfy the accommodation schema's minimum.
 */
export function toSummaryText(input: { readonly plainText: string }): string | null {
    const singleLine = input.plainText.replace(ANY_WHITESPACE_RE, ' ').trim();

    const summary = truncateAtWordBoundary({
        text: singleLine,
        maxChars: SUMMARY_MAX_CHARS
    });

    // Checked AFTER truncation: a long run with no whitespace truncates down to
    // a couple of characters, which would fail the schema minimum on save.
    return summary.length < SUMMARY_MIN_CHARS ? null : summary;
}
