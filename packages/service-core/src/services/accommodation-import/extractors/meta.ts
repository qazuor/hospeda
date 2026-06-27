/**
 * Meta / OpenGraph Extractor (SPEC-222)
 *
 * Extracts structured data from `<meta>` tags embedded in raw HTML using
 * regex only — no DOM parser, no cheerio, no jsdom.
 *
 * Two distinct extraction strategies are exposed:
 *
 * - **{@link extractOpenGraph}** — Open Graph (`og:*`) meta tags plus a small
 *   set of well-known non-OG meta tags (`name="description"`,
 *   `name="geo.position"`, `name="ICBM"`).  Fields tagged as either
 *   `'opengraph'` or `'meta'` depending on origin.
 *
 * - **{@link stripHtmlToText}** — Strips scripts, styles, and all HTML tags
 *   from raw HTML, collapses whitespace, and truncates to a caller-specified
 *   character limit.  Used by the AI Strategy-B fallback extractor.
 *
 * @module services/accommodation-import/extractors/meta
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Source tag for a field value pulled from an Open Graph `<meta property="og:*">` tag.
 */
type OgSource = 'opengraph';

/**
 * Source tag for a field value pulled from a plain `<meta name="...">` tag.
 */
type MetaSource = 'meta';

/**
 * A single extracted meta field with its tagged source.
 */
export interface TaggedField<S extends OgSource | MetaSource = OgSource | MetaSource> {
    /** The raw extracted value string. */
    readonly value: string;
    /** Which meta extraction method produced this value. */
    readonly source: S;
}

/**
 * Result bag returned by {@link extractOpenGraph}.
 *
 * Fields sourced from `<meta property="og:*">` carry `source: 'opengraph'`.
 * Fields sourced from `<meta name="description">` or geo meta tags carry
 * `source: 'meta'`.
 *
 * All fields are optional — the page may not carry every tag.
 */
export interface OgResult {
    /**
     * `og:title` — the page's Open Graph title.
     * Source: `'opengraph'`.
     */
    readonly title?: TaggedField<OgSource>;

    /**
     * `og:description` — the page's Open Graph description.
     * Source: `'opengraph'`.
     */
    readonly ogDescription?: TaggedField<OgSource>;

    /**
     * `og:image` — the primary Open Graph image URL.
     * Source: `'opengraph'`.
     */
    readonly image?: TaggedField<OgSource>;

    /**
     * `og:url` — the canonical URL declared in Open Graph metadata.
     * Source: `'opengraph'`.
     */
    readonly ogUrl?: TaggedField<OgSource>;

    /**
     * `<meta name="description">` — the standard HTML meta description.
     * Distinct from `og:description`; used as a lower-priority fallback.
     * Source: `'meta'`.
     */
    readonly metaDescription?: TaggedField<MetaSource>;

    /**
     * Geographic position extracted from `<meta name="geo.position">` or
     * `<meta name="ICBM">` (both use the `lat;long` format).
     *
     * Parsed into `lat` and `long` string fields to match the project's
     * `CoordinatesSchema`. Present only when a valid `lat;long` pair is found.
     * Source: `'meta'`.
     */
    readonly geoPosition?: {
        readonly lat: string;
        readonly long: string;
        readonly source: MetaSource;
    };
}

// ---------------------------------------------------------------------------
// Regex helpers
// ---------------------------------------------------------------------------

/**
 * Matches a `<meta>` tag that carries a `property` attribute (for OG tags).
 *
 * Attribute order is intentionally not assumed — `content` may appear before
 * `property`.  We capture the full opening tag and extract attributes
 * individually from the capture via {@link extractAttr}.
 *
 * Flags: `gi` — case-insensitive, global.
 */
const META_PROPERTY_TAG_RE = /<meta\b([^>]*?)\/?>/gi;

/**
 * Extracts the value of a named attribute from an attribute string.
 *
 * Handles:
 * - Double-quoted:  `attr="value"`
 * - Single-quoted:  `attr='value'`
 * - Unquoted:       `attr=value` (stops at whitespace or `>`)
 *
 * @param attrs - The raw attribute string from inside a tag.
 * @param name - The attribute name to look up (case-insensitive).
 * @returns The attribute value, or `undefined` when absent.
 */
function extractAttr(attrs: string, name: string): string | undefined {
    const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*?)"|'([^']*?)'|([^\\s>'"]+))`, 'i');
    const m = pattern.exec(attrs);
    if (m === null) {
        return undefined;
    }
    // One of the three capture groups will be defined.
    return (m[1] ?? m[2] ?? m[3] ?? '').trim();
}

/**
 * Parses a `lat;long` or `lat,long` geo string into `{ lat, long }`.
 *
 * Returns `undefined` when the string is absent, malformed, or either
 * coordinate is not a finite number.
 *
 * @param raw - The raw geo string (e.g. `"-34.6037;-58.3816"`).
 * @returns Typed coordinate pair or `undefined`.
 */
function parseGeoPosition(raw: string | undefined): { lat: string; long: string } | undefined {
    if (raw === undefined || raw.length === 0) {
        return undefined;
    }

    // Accept both semicolon (geo.position / ICBM standard) and comma separators.
    const sep = raw.includes(';') ? ';' : ',';
    const parts = raw.split(sep);
    if (parts.length < 2) {
        return undefined;
    }

    const latRaw = parts[0]?.trim() ?? '';
    const lonRaw = parts[1]?.trim() ?? '';

    const lat = Number(latRaw);
    const lon = Number(lonRaw);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return undefined;
    }

    return { lat: latRaw, long: lonRaw };
}

// ---------------------------------------------------------------------------
// extractOpenGraph
// ---------------------------------------------------------------------------

/**
 * Extracts Open Graph metadata and selected other `<meta>` tag content from
 * raw HTML.
 *
 * **Fields extracted:**
 *
 * | Tag | Key | Source tag |
 * |-----|-----|-----------|
 * | `<meta property="og:title">` | `title` | `'opengraph'` |
 * | `<meta property="og:description">` | `ogDescription` | `'opengraph'` |
 * | `<meta property="og:image">` | `image` | `'opengraph'` |
 * | `<meta property="og:url">` | `ogUrl` | `'opengraph'` |
 * | `<meta name="description">` | `metaDescription` | `'meta'` |
 * | `<meta name="geo.position">` or `<meta name="ICBM">` | `geoPosition` | `'meta'` |
 *
 * Attribute order within `<meta>` tags is tolerated — `property` and
 * `content` may appear in either order.
 *
 * This function never throws.  Missing tags simply result in absent fields.
 *
 * @param input - Object containing the raw HTML string to inspect.
 * @returns Partial bag of extracted meta fields; all fields are optional.
 *
 * @example
 * ```ts
 * const result = extractOpenGraph({ html: pageHtml });
 * if (result.title) {
 *   console.log('OG title:', result.title.value); // source === 'opengraph'
 * }
 * if (result.metaDescription) {
 *   console.log('Meta description:', result.metaDescription.value); // source === 'meta'
 * }
 * ```
 */
export function extractOpenGraph(input: { readonly html: string }): OgResult {
    const { html } = input;

    const result: {
        title?: TaggedField<OgSource>;
        ogDescription?: TaggedField<OgSource>;
        image?: TaggedField<OgSource>;
        ogUrl?: TaggedField<OgSource>;
        metaDescription?: TaggedField<MetaSource>;
        geoPosition?: { lat: string; long: string; source: MetaSource };
    } = {};

    META_PROPERTY_TAG_RE.lastIndex = 0;

    // Iterate all <meta> tags. Avoid assigning inside the while condition
    // (biome noAssignInExpressions) by using an explicit for loop.
    for (;;) {
        const match = META_PROPERTY_TAG_RE.exec(html);
        if (match === null) {
            break;
        }

        const attrs = match[1];
        if (attrs === undefined) {
            continue;
        }

        const content = extractAttr(attrs, 'content');
        if (content === undefined || content.length === 0) {
            continue;
        }

        // ── Open Graph: `property="og:*"` ──────────────────────────────────
        const property = extractAttr(attrs, 'property')?.toLowerCase();

        if (property !== undefined) {
            switch (property) {
                case 'og:title':
                    if (result.title === undefined) {
                        result.title = { value: content, source: 'opengraph' };
                    }
                    break;
                case 'og:description':
                    if (result.ogDescription === undefined) {
                        result.ogDescription = { value: content, source: 'opengraph' };
                    }
                    break;
                case 'og:image':
                    if (result.image === undefined) {
                        result.image = { value: content, source: 'opengraph' };
                    }
                    break;
                case 'og:url':
                    if (result.ogUrl === undefined) {
                        result.ogUrl = { value: content, source: 'opengraph' };
                    }
                    break;
                default:
                    break;
            }
        }

        // ── Standard meta: `name="..."` ────────────────────────────────────
        const name = extractAttr(attrs, 'name')?.toLowerCase();

        if (name !== undefined) {
            switch (name) {
                case 'description':
                    if (result.metaDescription === undefined) {
                        result.metaDescription = { value: content, source: 'meta' };
                    }
                    break;
                case 'geo.position':
                case 'icbm':
                    if (result.geoPosition === undefined) {
                        const coords = parseGeoPosition(content);
                        if (coords !== undefined) {
                            result.geoPosition = { ...coords, source: 'meta' };
                        }
                    }
                    break;
                default:
                    break;
            }
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// stripHtmlToText
// ---------------------------------------------------------------------------

/**
 * Regex to match `<script>` and `<style>` elements (including their content).
 * Using `[\s\S]*?` to avoid greedy catastrophic backtracking.
 */
const SCRIPT_STYLE_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/**
 * Regex to strip all remaining HTML tags after scripts/styles are removed.
 */
const HTML_TAG_RE = /<[^>]{0,5000}>/g;

/**
 * Regex to collapse any run of whitespace (spaces, tabs, newlines) into a
 * single space.
 */
const WHITESPACE_RE = /\s+/g;

/**
 * Converts raw HTML to a plain-text string suitable for AI-assisted
 * extraction (Strategy-B fallback in SPEC-222).
 *
 * **Processing steps:**
 * 1. Remove all `<script>` and `<style>` blocks (including their content).
 * 2. Strip all remaining HTML tags.
 * 3. Decode a small set of common HTML entities (`&amp;`, `&lt;`, `&gt;`,
 *    `&quot;`, `&#39;`, `&nbsp;`).
 * 4. Collapse runs of whitespace (spaces, newlines, tabs) into a single space.
 * 5. Trim leading/trailing whitespace.
 * 6. Truncate to `maxChars` characters.
 *
 * This function never throws.  An empty or whitespace-only input returns an
 * empty string.
 *
 * @param input - Object containing the raw HTML and the character limit.
 * @returns Plain-text representation of the page content, truncated to
 *   `maxChars`.
 *
 * @example
 * ```ts
 * const text = stripHtmlToText({ html: pageHtml, maxChars: 4000 });
 * // text is now suitable for sending to an AI model
 * ```
 */
export function stripHtmlToText(input: {
    readonly html: string;
    readonly maxChars: number;
}): string {
    const { html, maxChars } = input;

    if (html.length === 0) {
        return '';
    }

    // Step 1 — remove script and style blocks.
    SCRIPT_STYLE_RE.lastIndex = 0;
    let text = html.replace(SCRIPT_STYLE_RE, ' ');

    // Step 2 — strip remaining HTML tags.
    HTML_TAG_RE.lastIndex = 0;
    text = text.replace(HTML_TAG_RE, ' ');

    // Step 3 — decode common HTML entities in a single pass so that a sequence
    // like "&amp;lt;" is decoded to "&lt;" (one level) rather than to "<"
    // (double-decode).  A chained replace with &amp; first would convert
    // "&amp;lt;" → "&lt;" → "<", which is incorrect (CodeQL double-unescape fix).
    text = text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => {
        switch (entity) {
            case '&lt;':
                return '<';
            case '&gt;':
                return '>';
            case '&quot;':
                return '"';
            case '&#39;':
                return "'";
            case '&nbsp;':
                return ' ';
            default:
                return '&'; // &amp;
        }
    });

    // Step 4 & 5 — collapse whitespace and trim.
    WHITESPACE_RE.lastIndex = 0;
    text = text.replace(WHITESPACE_RE, ' ').trim();

    // Step 6 — truncate.
    return text.length <= maxChars ? text : text.slice(0, maxChars);
}
