/**
 * Reading and rewriting the five `utm_*` query parameters of a URL (HOS-2679).
 *
 * {@link withUtm} only ever ADDS a closed-vocabulary combination, and refuses to
 * touch a URL that already carries one. An operator editing a manual QR code's
 * campaign needs the other two operations — read what is there, and replace it —
 * over free text, without disturbing anything else in the URL. That is what this
 * module does, and the reason it works on the raw query string rather than on
 * `URLSearchParams`: re-serialising through `URLSearchParams` re-encodes EVERY
 * parameter (`%20` becomes `+`, `~` becomes `%7E`, `a=b=c` becomes `a=b%3Dc`), so
 * editing `utm_campaign` would silently rewrite a tracking id the operator never
 * touched.
 *
 * The rules, all pinned by `test/attribution-utm-query.test.ts`:
 *
 * - Only the five keys in {@link UTM_PARAM_KEYS} are ever read or written. Every
 *   other parameter keeps its exact bytes and its position.
 * - Keys match case-insensitively (`UTM_Source` is `utm_source`), as {@link withUtm}
 *   does; a rewritten key is written in lower case.
 * - On write, the FIRST occurrence of a key is replaced in place and any later
 *   duplicate is dropped. A key the URL does not carry is appended after the
 *   existing parameters, in {@link UTM_PARAM_KEYS} order.
 * - An empty (or whitespace-only) value, or `null`, REMOVES the key. A key absent
 *   from the patch is left exactly as it is.
 * - Values are written with `encodeURIComponent`, and read back with `+` decoded as
 *   a space (the `application/x-www-form-urlencoded` reading every analytics tool
 *   applies). A malformed escape is returned raw rather than throwing.
 * - The fragment (`#...`) is preserved byte for byte.
 *
 * @module attribution/utm-query
 */

/** The five UTM parameters, in the order a rewrite appends missing ones. */
export const UTM_PARAM_KEYS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term'
] as const;

/** One of the five UTM parameter names. */
export type UtmParamKey = (typeof UTM_PARAM_KEYS)[number];

/** The five UTM values of a URL; `null` for a parameter the URL does not carry. */
export type UtmQueryValues = Readonly<Record<UtmParamKey, string | null>>;

/**
 * A rewrite request: for each key present, the new value. `null`, `''` or a
 * whitespace-only string removes the parameter; an absent key is left untouched.
 */
export type UtmQueryPatch = Readonly<Partial<Record<UtmParamKey, string | null>>>;

const UTM_KEY_SET: ReadonlySet<string> = new Set(UTM_PARAM_KEYS);

/** The URL split into the three parts a rewrite treats differently. */
interface SplitUrl {
    readonly base: string;
    /** The query WITHOUT its leading `?`; `null` when the URL has no `?` at all. */
    readonly query: string | null;
    /** The fragment WITH its leading `#`, or `''`. */
    readonly hash: string;
}

function splitUrl(url: string): SplitUrl {
    const hashIndex = url.indexOf('#');
    const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
    const queryIndex = beforeHash.indexOf('?');
    if (queryIndex === -1) {
        return { base: beforeHash, query: null, hash };
    }
    return {
        base: beforeHash.slice(0, queryIndex),
        query: beforeHash.slice(queryIndex + 1),
        hash
    };
}

/** Form-decodes one query component, falling back to the raw text when malformed. */
function decodeComponent(raw: string): string {
    const spaced = raw.replace(/\+/g, ' ');
    try {
        return decodeURIComponent(spaced);
    } catch {
        return spaced;
    }
}

/** The canonical UTM key a raw query segment names, or `null` for any other segment. */
function utmKeyOf(segment: string): UtmParamKey | null {
    const equalsIndex = segment.indexOf('=');
    const rawName = equalsIndex === -1 ? segment : segment.slice(0, equalsIndex);
    const name = decodeComponent(rawName).toLowerCase();
    return UTM_KEY_SET.has(name) ? (name as UtmParamKey) : null;
}

/** The decoded value of a raw `name=value` segment (`''` for a bare `name`). */
function segmentValue(segment: string): string {
    const equalsIndex = segment.indexOf('=');
    return equalsIndex === -1 ? '' : decodeComponent(segment.slice(equalsIndex + 1));
}

/** `null` for a value that means "remove", the trimmed value otherwise. */
function normaliseValue(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

/**
 * Reads the five UTM parameters of a URL.
 *
 * Absolute or base-relative URLs both work: nothing here parses the origin. When a
 * key appears more than once, the FIRST occurrence wins, which is what
 * `URLSearchParams.get` (and therefore every analytics tool reading it) answers.
 *
 * @param input.url - The URL to read.
 * @returns One entry per UTM key, `null` where the URL does not carry it.
 *
 * @example
 * ```ts
 * readUtmParams({ url: 'https://x.test/?utm_campaign=verano%202026&a=1' });
 * // { utm_source: null, utm_medium: null, utm_campaign: 'verano 2026', utm_content: null, utm_term: null }
 * ```
 */
export function readUtmParams(input: { readonly url: string }): UtmQueryValues {
    const values: Record<UtmParamKey, string | null> = {
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_content: null,
        utm_term: null
    };
    const { query } = splitUrl(input.url);
    if (query === null || query === '') return values;

    for (const segment of query.split('&')) {
        if (segment === '') continue;
        const key = utmKeyOf(segment);
        if (key !== null && values[key] === null) {
            values[key] = segmentValue(segment);
        }
    }
    return values;
}

/**
 * Returns `url` with the UTM parameters named in `utm` replaced, added or removed,
 * and every other byte of the URL left where it was. See the module header for the
 * exact rules.
 *
 * @param input.url - The URL to rewrite.
 * @param input.utm - For each key present, the new value (`null`/empty removes it).
 * @returns The rewritten URL. A URL left with no parameters at all loses its `?`.
 *
 * @example
 * ```ts
 * rewriteUtmParams({
 *     url: 'https://x.test/p?ref=a&utm_campaign=old#top',
 *     utm: { utm_campaign: 'verano', utm_source: 'flyer' }
 * });
 * // 'https://x.test/p?ref=a&utm_campaign=verano&utm_source=flyer#top'
 * ```
 */
export function rewriteUtmParams(input: {
    readonly url: string;
    readonly utm: UtmQueryPatch;
}): string {
    const { base, query, hash } = splitUrl(input.url);
    const patchKeys = UTM_PARAM_KEYS.filter((key) => Object.hasOwn(input.utm, key));
    if (patchKeys.length === 0) return input.url;

    const pending = new Map<UtmParamKey, string | null>(
        patchKeys.map((key) => [key, normaliseValue(input.utm[key])])
    );
    const written = new Set<UtmParamKey>();
    const segments: string[] = [];

    for (const segment of query === null ? [] : query.split('&')) {
        const key = segment === '' ? null : utmKeyOf(segment);
        if (key === null || !pending.has(key)) {
            // Not ours to touch — including empty segments, so `a=1&&b=2` survives.
            segments.push(segment);
            continue;
        }
        if (written.has(key)) continue; // a later duplicate of a key already rewritten
        written.add(key);
        const value = pending.get(key) ?? null;
        if (value !== null) segments.push(`${key}=${encodeURIComponent(value)}`);
    }

    for (const key of patchKeys) {
        if (written.has(key)) continue;
        const value = pending.get(key) ?? null;
        if (value !== null) segments.push(`${key}=${encodeURIComponent(value)}`);
    }

    const newQuery = segments.join('&');
    if (newQuery === '') {
        // Removing the last parameter drops the `?`; a URL that had a bare `?` and
        // no change to make already returned above.
        return `${base}${hash}`;
    }
    return `${base}?${newQuery}${hash}`;
}
