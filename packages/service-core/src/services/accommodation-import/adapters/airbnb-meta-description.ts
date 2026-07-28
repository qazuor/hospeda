/**
 * Airbnb `metaDescription` cleanup (HOS-287)
 *
 * The `tri_angle/airbnb-rooms-urls-scraper` actor exposes a `metaDescription`
 * field that is NOT a plain blurb: it is the listing card's meta line, shaped
 * as `<scrape date> · <property type> · <real description>`, e.g.
 *
 * - `24 de jul de 2026 · Casa rural entero · Cheroga te ofrece tranquilidad...`
 * - `Jun 23, 2026 · Entire cottage · Cheroga offers you tranquility.`
 *
 * That field is the last fallback for the accommodation's short description
 * ("Descripción corta"), so the date and the type leak straight into a
 * host-facing form field. The date is pure scraping noise and the type is
 * already mapped independently to `RawExtraction.type`.
 *
 * The cleanup is deliberately conservative — it only rewrites text it can
 * positively identify:
 *
 * 1. The leading date is stripped only when it matches a known date shape
 *    anchored at the very start AND is followed by a `·` separator.
 * 2. The type segment is stripped only when a leading date was actually
 *    stripped (i.e. the value really is a meta line) AND the segment equals
 *    the item's own `propertyType`/`roomType`. Any other second segment is
 *    left untouched — it could be real description text.
 *
 * When neither rule fires the input is returned unchanged.
 */

/**
 * Leading date shapes emitted by the actor, anchored at the start of the string
 * and required to be followed by a `·` separator.
 *
 * - `24 de jul de 2026` / `24 de julio de 2026` (es, pt)
 * - `Jun 23, 2026` / `June 23, 2026` (en)
 *
 * Every quantifier is bounded by literal text, so a value that does not open
 * with a date simply fails to match instead of consuming real content.
 */
const LEADING_DATE_PATTERN = /^(?:\d{1,2} de \p{L}+\.? de \d{4}|\p{L}+\.? \d{1,2},? \d{4})\s*·\s*/u;

/** The `·` separator between meta-line segments, with its surrounding spaces. */
const SEGMENT_SEPARATOR_PATTERN = /\s*·\s*/;

/**
 * Normalizes a label for equality comparison: lowercased, accent-stripped, with
 * every run of non-alphanumeric characters collapsed to a single space.
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
    const withoutDate = metaDescription.replace(LEADING_DATE_PATTERN, '');

    // No leading date ⇒ this is not a meta line. Leave the value alone: a
    // second segment matching the property type could well be real prose.
    if (withoutDate === metaDescription) {
        return metaDescription.trim() || null;
    }

    const separator = SEGMENT_SEPARATOR_PATTERN.exec(withoutDate);
    if (!separator) {
        return withoutDate.trim() || null;
    }

    const candidate = normalizeLabel(withoutDate.slice(0, separator.index));
    const typeLabels = [propertyType, roomType]
        .filter((label): label is string => typeof label === 'string' && label.trim().length > 0)
        .map(normalizeLabel);

    if (candidate.length === 0 || !typeLabels.includes(candidate)) {
        return withoutDate.trim() || null;
    }

    return withoutDate.slice(separator.index + separator[0].length).trim() || null;
};
