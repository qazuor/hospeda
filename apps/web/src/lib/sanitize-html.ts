/**
 * HTML sanitizer for server-side use in Astro pages.
 *
 * Uses the battle-tested `sanitize-html` library instead of custom regex
 * to prevent XSS bypass vulnerabilities. Strips all HTML tags except a safe
 * allowlist, removes dangerous attributes, and preserves safe content.
 *
 * Capabilities:
 * - Allows TipTap-rendered rich text (paragraphs, headings, lists, links, images)
 * - Allows `<figure>`/`<figcaption>` for captioned media
 * - Allows YouTube `<iframe>` embeds (whitelisted via `src` regex)
 * - Allows `data-*` attributes (used by TipTap and TOC anchors)
 * - Restricts `id` attribute values to safe slug format
 * - Adds `target="_blank"` + `rel="noopener noreferrer"` ONLY on external links
 *
 * @module sanitize-html
 */

import sanitize from 'sanitize-html';

/** SVG-related tags allowed for icon content */
const SVG_TAGS = [
    'svg',
    'path',
    'circle',
    'rect',
    'line',
    'polyline',
    'polygon',
    'g',
    'defs',
    'use',
    'title'
] as const;

/** All tags considered safe for rich-text display */
const ALLOWED_TAGS: readonly string[] = [
    // Block elements
    'p',
    'br',
    'hr',
    'div',
    'span',
    'blockquote',
    'pre',
    'code',
    // Headings
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    // Lists
    'ul',
    'ol',
    'li',
    // Inline formatting
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'sub',
    'sup',
    'mark',
    'small',
    // Links and images
    'a',
    'img',
    // Figures (captioned media)
    'figure',
    'figcaption',
    // YouTube embeds (filtered by src in transformTags)
    'iframe',
    // Tables
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    // SVG
    ...SVG_TAGS
];

/**
 * Attributes allowed on specific tags.
 *
 * The `data-*` glob in the `*` array preserves any well-named data attribute
 * on every retained tag (TipTap and the TOC slug system both use them).
 * Event-handler attributes (`onclick`, `onerror`, ...) are NEVER in this
 * list, so they are stripped regardless of source tag.
 */
const ALLOWED_ATTRIBUTES: Record<string, Array<string>> = {
    '*': ['class', 'id', 'aria-hidden', 'aria-label', 'role', 'data-*'],
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    iframe: [
        'src',
        'width',
        'height',
        'frameborder',
        'allow',
        'allowfullscreen',
        'title',
        'loading'
    ],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope'],
    svg: ['viewBox', 'viewbox', 'width', 'height', 'fill', 'stroke', 'xmlns', 'aria-hidden'],
    path: ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
    circle: ['cx', 'cy', 'r', 'fill', 'stroke'],
    rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke'],
    line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width'],
    polyline: ['points', 'fill', 'stroke'],
    polygon: ['points', 'fill', 'stroke'],
    g: ['transform', 'fill', 'stroke'],
    use: ['x', 'y', 'width', 'height']
};

/** Protocols allowed in URL-bearing attributes */
const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'] as const;

/**
 * Strict whitelist of allowed YouTube embed URLs.
 *
 * Matches the canonical embed paths only:
 *   - https://www.youtube.com/embed/<id>
 *   - https://youtube.com/embed/<id>
 *   - https://www.youtube-nocookie.com/embed/<id>
 *   - https://youtube-nocookie.com/embed/<id>
 *
 * The video id portion is restricted to `[A-Za-z0-9_-]+`. Optional query
 * strings are allowed (used for `start`, `autoplay=0`, etc.). NOTHING else
 * is permitted — any other host or scheme causes the iframe to be removed.
 */
const YOUTUBE_EMBED_REGEX =
    /^https:\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)\/embed\/[A-Za-z0-9_-]+(?:\?[^"'<>\s]*)?$/;

/**
 * Allowed format for `id` attributes.
 *
 * Restricts ids to typical kebab-/snake-case slugs (must start with a letter,
 * up to 128 word/dash chars). Rejects values containing colons, slashes,
 * spaces, or anything that could be interpreted as a URI / scheme.
 */
const SAFE_ID_REGEX = /^[A-Za-z][\w-]{0,128}$/;

/** Matches any `data-*` attribute name we are willing to keep. */
const SAFE_DATA_ATTR_REGEX = /^data-[a-z][a-z0-9-]*$/i;

/**
 * Determines whether a link `href` points to an external origin.
 *
 * Considered NON-external (no `target="_blank"`):
 *   - relative urls (`/foo`, `./foo`, `../foo`, `foo.html`)
 *   - in-page anchors (`#section`)
 *   - `mailto:` and `tel:`
 *   - absolute http(s) urls whose origin matches `siteOrigin`
 *
 * Considered external (gets `target="_blank"` + `rel`):
 *   - any other absolute http(s) url
 *
 * If `siteOrigin` is not provided we conservatively treat all absolute http(s)
 * urls as external (the historical behavior).
 */
function isExternalLink(href: string, siteOrigin?: string): boolean {
    if (!href) return false;

    if (href.startsWith('#')) return false;
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;

    // Relative paths and protocol-less hrefs.
    if (
        href.startsWith('/') ||
        href.startsWith('./') ||
        href.startsWith('../') ||
        !/^[a-z][a-z0-9+.-]*:/i.test(href)
    ) {
        return false;
    }

    if (!siteOrigin) return true;
    try {
        const url = new URL(href);
        const site = new URL(siteOrigin);
        return url.origin !== site.origin;
    } catch {
        return true;
    }
}

/**
 * Scrubs attributes that survived the allowlist but fail our format checks.
 *
 * - `id`: must match SAFE_ID_REGEX (slug-style). Otherwise the attribute is
 *   removed (the element itself is preserved).
 * - `data-*`: must match SAFE_DATA_ATTR_REGEX. Otherwise removed. Names that
 *   look like event handlers (`data-onclick`) are NOT removed by this rule —
 *   they're plain data attributes and inert in HTML — but a separate filter
 *   will only keep names that follow the regex.
 */
function scrubUnsafeAttributes(attribs: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [name, value] of Object.entries(attribs)) {
        if (name === 'id') {
            if (typeof value === 'string' && SAFE_ID_REGEX.test(value)) {
                out[name] = value;
            }
            continue;
        }
        if (name.startsWith('data-')) {
            if (SAFE_DATA_ATTR_REGEX.test(name)) {
                out[name] = value;
            }
            continue;
        }
        out[name] = value;
    }
    return out;
}

/**
 * Sanitizes an HTML string by removing disallowed tags and dangerous attributes.
 *
 * @param params - Parameters object
 * @param params.html - Raw HTML string to sanitize
 * @param params.siteOrigin - Optional origin (e.g. `https://hospeda.com.ar`)
 *   used to distinguish internal vs external links. When provided, links that
 *   match this origin are kept "in place" (no `target="_blank"`). When omitted,
 *   ALL absolute http(s) links are treated as external (legacy behavior).
 * @returns Sanitized HTML string safe for use with `set:html`
 *
 * @example
 * ```typescript
 * const safe = sanitizeHtml({
 *   html: '<p>Hello</p><script>alert("xss")</script>',
 *   siteOrigin: 'https://hospeda.com.ar',
 * });
 * // Returns: '<p>Hello</p>'
 * ```
 */
export function sanitizeHtml({
    html,
    siteOrigin
}: {
    readonly html: string;
    readonly siteOrigin?: string;
}): string {
    if (!html) return '';

    return sanitize(html, {
        allowedTags: [...ALLOWED_TAGS],
        allowedAttributes: ALLOWED_ATTRIBUTES,
        allowedSchemes: [...ALLOWED_SCHEMES],
        // Belt-and-suspenders host filter; the per-iframe transformer below
        // additionally enforces the full URL pattern.
        allowedIframeHostnames: [
            'www.youtube.com',
            'youtube.com',
            'www.youtube-nocookie.com',
            'youtube-nocookie.com'
        ],
        transformTags: {
            // Wildcard transformer runs on every retained tag AFTER the
            // allowlist has filtered attributes. We use it to scrub `id`
            // values and `data-*` names that are syntactically suspicious.
            '*': (tagName, attribs) => ({
                tagName,
                attribs: scrubUnsafeAttributes(attribs)
            }),
            a: (tagName, attribs) => {
                // Always reset target/rel to whatever our policy dictates by
                // excluding them from the spread before reapplying based on the
                // sanitized href.
                const {
                    target: _droppedTarget,
                    rel: _droppedRel,
                    ...rest
                } = scrubUnsafeAttributes({ ...attribs });
                const next: Record<string, string> = { ...rest };

                if (typeof next.href === 'string' && isExternalLink(next.href, siteOrigin)) {
                    next.target = '_blank';
                    next.rel = 'noopener noreferrer';
                }
                return { tagName, attribs: next };
            },
            iframe: (tagName, attribs) => {
                const cleaned = scrubUnsafeAttributes(attribs);
                const src = typeof cleaned.src === 'string' ? cleaned.src : '';
                if (!YOUTUBE_EMBED_REGEX.test(src)) {
                    // Use a tag that is NOT in `allowedTags` so the
                    // element is discarded entirely (no empty stub left).
                    return { tagName: 'discard-iframe', attribs: {} };
                }
                return { tagName, attribs: cleaned };
            }
        }
    });
}
