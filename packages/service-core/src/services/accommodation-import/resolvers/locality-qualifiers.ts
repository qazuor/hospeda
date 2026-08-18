/**
 * Accommodation Import — trailing locality qualifiers (HOS-346)
 *
 * Listing sites hand over `"Colón, Entre Ríos"` rather than a clean city name,
 * and the substring search finds nothing for it: no catalog name contains that
 * whole string. The province written there is not noise — it is the single
 * most useful signal in the payload, because six of the 22 catalog cities have
 * a homonym in another province.
 *
 * ## What this is NOT
 *
 * This is not an address parser. Positional parsing is exactly what produced
 * `"San José, Colón, Entre Ríos"` → Colón across five rounds of adversarial
 * review (PR #2529): in Entre Ríos, 7 of the 22 catalog cities are ALSO
 * department names, and the Argentine address order is
 * `city, department, province`. Any rule that reaches for "the segment before
 * the province" picks the department.
 *
 * So this strips a trailing segment ONLY when that segment is an item of a
 * closed list — a province, a country, or a bare postal code — and never
 * interprets what is left. The caller then requires the remainder to match a
 * catalog name EXACTLY, so no new single-wrong-row path appears:
 *
 * - `"Colón, Entre Ríos"`             → `Colón` + province, an exact hit.
 * - `"Caseros, Buenos Aires, 1678"`   → `Caseros` + a province that DENIES.
 * - `"San José, Colón, Entre Ríos"`   → `San José, Colón`, which is not a
 *                                       catalog name, so nothing resolves.
 *
 * The postal code matters on its own: the previous attempt stopped its scan at
 * the number and never reached the province, which is how a Buenos Aires
 * listing pre-filled Caseros (Entre Ríos).
 *
 * @module services/accommodation-import/resolvers/locality-qualifiers
 */

import { normalizeLocalityKey } from './locality-aliases.js';

/**
 * Argentine provinces, normalized, plus the spellings payloads actually use.
 *
 * A closed list on purpose: an unknown trailing segment is left in place, which
 * makes the remainder fail to match rather than silently resolving something.
 */
const PROVINCE_TERMS: ReadonlySet<string> = new Set([
    'buenos aires',
    'ciudad autonoma de buenos aires',
    'capital federal',
    'caba',
    'catamarca',
    'chaco',
    'chubut',
    'cordoba',
    'corrientes',
    'entre rios',
    'formosa',
    'jujuy',
    'la pampa',
    'la rioja',
    'mendoza',
    'misiones',
    'neuquen',
    'rio negro',
    'salta',
    'san juan',
    'san luis',
    'santa cruz',
    'santa fe',
    'santiago del estero',
    'tierra del fuego',
    'tucuman'
]);

/** Country spellings that appear at the end of a scraped address. */
const COUNTRY_TERMS: ReadonlySet<string> = new Set([
    'argentina',
    'republica argentina',
    'ar',
    'arg',
    'brasil',
    'brazil',
    'uruguay',
    'chile',
    'paraguay',
    'bolivia'
]);

/** A bare postal code: digits, optionally with a leading province letter (CPA). */
const POSTAL_CODE_RE = /^[a-z]?\d{4}[a-z]{0,3}$/;

/** Result of {@link splitLocalityQualifiers}. */
export interface LocalityQualifiers {
    /** The locality with trailing qualifiers removed. May be empty. */
    readonly locality: string;
    /** The province found among the trailing qualifiers, verbatim, if any. */
    readonly region?: string;
    /** Whether anything was actually stripped. */
    readonly stripped: boolean;
}

/**
 * Strips trailing province / country / postal-code segments from a scraped
 * locality and reports the province it found.
 *
 * Only TRAILING segments are considered, and only ones present in a closed
 * list. The remaining text is returned untouched — this function never decides
 * which part of it is "the city".
 *
 * @param raw - Raw scraped locality string.
 * @returns The remainder plus the province found, if any.
 *
 * @example
 * ```ts
 * splitLocalityQualifiers('Caseros, Buenos Aires, 1678');
 * // { locality: 'Caseros', region: 'Buenos Aires', stripped: true }
 *
 * splitLocalityQualifiers('San José, Colón, Entre Ríos');
 * // { locality: 'San José, Colón', region: 'Entre Ríos', stripped: true }
 * ```
 */
export function splitLocalityQualifiers(raw: string): LocalityQualifiers {
    const segments = raw
        .split(',')
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);

    if (segments.length === 0) {
        return { locality: raw.trim(), stripped: false };
    }

    let region: string | undefined;
    let end = segments.length;

    // Walk backwards while the trailing segment is a known qualifier. The FIRST
    // province met walking backwards is the outermost one, which is the one a
    // well-formed address carries.
    while (end > 0) {
        const segment = segments[end - 1];
        if (segment === undefined) break;
        const key = normalizeLocalityKey(segment);

        if (POSTAL_CODE_RE.test(key.replace(/\s+/g, ''))) {
            end -= 1;
            continue;
        }
        if (COUNTRY_TERMS.has(key)) {
            end -= 1;
            continue;
        }
        if (PROVINCE_TERMS.has(key)) {
            region ??= segment;
            end -= 1;
            continue;
        }
        break;
    }

    const remainder = segments.slice(0, end).join(', ');
    return {
        locality: remainder,
        ...(region === undefined ? {} : { region }),
        stripped: end < segments.length
    };
}
