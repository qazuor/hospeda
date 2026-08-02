/**
 * Airbnb `metaDescription` cleanup (HOS-287)
 *
 * The `tri_angle/airbnb-rooms-urls-scraper` actor exposes a `metaDescription`
 * field that is NOT a plain blurb: it is the listing card's meta line, shaped
 * as `<scrape date> · <property type> · <real description>`, e.g.
 *
 * - `28 de jul de 2026 · Casa rural entero · Cheroga te ofrece tranquilidad...`
 * - `Jun 23, 2026 · Entire cottage · Cheroga offers you tranquility.`
 *
 * That field is the last fallback for the accommodation's short description
 * ("Descripción corta"), so the date and the type leak straight into a
 * host-facing form field. The date is pure scraping noise (it is the date of
 * the run — verified against a live one) and the type is already mapped
 * independently to `RawExtraction.type`.
 *
 * The cleanup is deliberately conservative — it only rewrites text it can
 * positively identify:
 *
 * 1. The leading date is stripped only when it opens the value AND its month is
 *    a real month name in one of the three locales the adapter requests AND it
 *    is followed by a `·` separator.
 * 2. The type segment is stripped only when a leading date was actually
 *    stripped (i.e. the value really is a meta line) AND the segment equals the
 *    item's own `propertyType`/`roomType`. Any other segment is left untouched —
 *    it could be real description text.
 *
 * When neither rule fires the input is returned unchanged.
 *
 * @module services/accommodation-import/adapters/airbnb-meta-description
 */

/**
 * Month names — abbreviated and full — for the three locales
 * {@link mapAirbnbActorLocale} can request (`es-AR`, `pt-BR`, `en`).
 *
 * Matching the month against a closed list (rather than "any word") is what
 * keeps the pattern from eating real text: `Colón 45, 3280 · Casa céntrica`
 * has the exact shape `<word> <1-2 digits>, <4 digits> ·` but `Colón` is not a
 * month, so it does not match.
 */
const MONTH_NAMES: readonly string[] = [
    // es
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'sept',
    'oct',
    'nov',
    'dic',
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'setiembre',
    'octubre',
    'noviembre',
    'diciembre',
    // pt
    'fev',
    'set',
    'out',
    'dez',
    'janeiro',
    'fevereiro',
    'março',
    'marco',
    'maio',
    'junho',
    'julho',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
    // en
    'jan',
    'apr',
    'aug',
    'dec',
    'january',
    'february',
    'march',
    'april',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december'
] as const;

/** Longest-first so `septiembre` is preferred over `sep` in the alternation. */
const MONTH_ALTERNATION = [...new Set(MONTH_NAMES)].sort((a, b) => b.length - a.length).join('|');

/**
 * Leading date shapes emitted by the actor, anchored at the start of the string
 * and required to be followed by a `·` separator.
 *
 * - `24 de jul de 2026` / `24 de julio de 2026` / `24 jul 2026` (es, pt)
 * - `Jun 23, 2026` / `June 23, 2026` (en)
 *
 * `\s` covers the non-breaking spaces Intl formatters emit between date tokens.
 * Both a real month name and the separator are mandatory, so a value that does
 * not open with a date fails to match instead of consuming real content. Leading
 * whitespace is handled by the caller's `.trim()`, not here — keeping a single
 * defence means a test can actually discriminate it.
 */
const LEADING_DATE_PATTERN = new RegExp(
    `^(?:\\d{1,2}\\s+(?:de\\s+)?(?:${MONTH_ALTERNATION})\\.?\\s+(?:de\\s+)?\\d{4}` +
        `|(?:${MONTH_ALTERNATION})\\.?\\s+\\d{1,2},?\\s+\\d{4})\\s*·\\s*`,
    'iu'
);

/** The `·` that separates meta-line segments. */
const SEGMENT_SEPARATOR = '·';

/**
 * Normalizes a label for equality comparison: lowercased, accent-stripped, with
 * every run of non-alphanumeric characters collapsed to a single space.
 *
 * Note this is ASCII-only by design: a label in a non-Latin script normalizes
 * to the empty string, which callers treat as "no match" rather than as a match
 * against another empty value.
 *
 * @param value - Raw label.
 * @returns The normalized label.
 */
const normalizeLabel = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

/**
 * Strips the scrape date — and, when it is the item's own property/room type,
 * the type segment — from an Airbnb `metaDescription`.
 *
 * @param params - Receive-object parameters.
 * @param params.metaDescription - The raw `metaDescription` from the actor.
 * @param params.propertyType - The item's `propertyType`, when present.
 * @param params.roomType - The item's `roomType`, when present.
 * @returns The cleaned text, or `null` when nothing but noise remained.
 *
 * @example
 * ```ts
 * stripAirbnbMetaDescriptionNoise({
 *     metaDescription: 'Jun 23, 2026 · Entire cottage · Cheroga offers you tranquility.',
 *     propertyType: 'Entire cottage'
 * });
 * // → 'Cheroga offers you tranquility.'
 * ```
 */
export const stripAirbnbMetaDescriptionNoise = ({
    metaDescription,
    propertyType,
    roomType
}: {
    readonly metaDescription: string;
    readonly propertyType?: string | null | undefined;
    readonly roomType?: string | null | undefined;
}): string | null => {
    const trimmed = metaDescription.trim();
    const withoutDate = trimmed.replace(LEADING_DATE_PATTERN, '');

    // No leading date ⇒ this is not a meta line. Leave the value alone: a first
    // segment matching the property type could well be real prose.
    if (withoutDate === trimmed) {
        return trimmed || null;
    }

    const typeLabels = [propertyType, roomType]
        .filter((label): label is string => typeof label === 'string' && label.trim().length > 0)
        .map(normalizeLabel);
    const isOwnType = (segment: string): boolean => {
        const normalized = normalizeLabel(segment);
        return normalized.length > 0 && typeLabels.includes(normalized);
    };

    const separatorIndex = withoutDate.indexOf(SEGMENT_SEPARATOR);

    // Meta line with no third segment (listing without a blurb): all that is
    // left is the type itself, which is not a short description.
    if (separatorIndex === -1) {
        return isOwnType(withoutDate) ? null : withoutDate.trim() || null;
    }

    if (!isOwnType(withoutDate.slice(0, separatorIndex))) {
        return withoutDate.trim() || null;
    }

    return withoutDate.slice(separatorIndex + SEGMENT_SEPARATOR.length).trim() || null;
};
