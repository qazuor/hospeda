/**
 * HTML sanitizer for server-side use in Astro pages.
 *
 * Uses the battle-tested `sanitize-html` library instead of custom regex
 * to prevent XSS bypass vulnerabilities. Strips all HTML tags except a safe
 * allowlist, removes dangerous attributes, and preserves safe content.
 *
 * For TipTap JSON content, prefer `renderTiptapContent()` which builds HTML
 * from a structured allowlist and already escapes text nodes.
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

/** Attributes allowed on specific tags */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
    '*': ['class', 'id', 'aria-hidden', 'aria-label', 'role'],
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
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
    use: ['href', 'x', 'y', 'width', 'height']
};

/** Protocols allowed in URL-bearing attributes */
const ALLOWED_SCHEMES = ['http', 'https', 'mailto'] as const;

/**
 * Sanitizes an HTML string by removing disallowed tags and dangerous attributes.
 *
 * @param params - Parameters object
 * @param params.html - Raw HTML string to sanitize
 * @returns Sanitized HTML string safe for use with `set:html`
 *
 * @example
 * ```typescript
 * const safe = sanitizeHtml({ html: '<p>Hello</p><script>alert("xss")</script>' });
 * // Returns: '<p>Hello</p>'
 * ```
 */
export function sanitizeHtml({ html }: { readonly html: string }): string {
    if (!html) return '';

    return sanitize(html, {
        allowedTags: [...ALLOWED_TAGS],
        allowedAttributes: ALLOWED_ATTRIBUTES,
        allowedSchemes: [...ALLOWED_SCHEMES],
        transformTags: {
            a: sanitize.simpleTransform('a', {
                target: '_blank',
                rel: 'noopener noreferrer'
            })
        }
    });
}
