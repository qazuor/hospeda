/**
 * @file render-content.ts
 * @description Single-source pipeline that turns user-authored body text into
 * safe HTML for `set:html`. Used by the four detail pages whose body fields can
 * arrive as either:
 *   - markdown (the seed format today, with **bold**, ## headings, lists),
 *   - HTML emitted by the admin TipTap editor (rolling out), or
 *   - plain text (legacy rows without any markup).
 *
 * Pipeline: `marked` converts markdown into HTML and passes raw HTML through
 * untouched. The result is then handed to `sanitizeHtml` so any `<script>`,
 * `javascript:` URL, or other XSS payload that slipped through (or was hand-
 * authored inside the markdown) is stripped before it reaches the DOM.
 *
 * SECURITY: always feed the OUTPUT of this function to `set:html`. Never call
 * `set:html` on the raw `description` / `content` / `contentHtml` API fields.
 */

import { marked } from 'marked';
import { sanitizeHtml } from './sanitize-html';

/**
 * Argument bundle for {@link renderContent}.
 */
export interface RenderContentInput {
    /** Raw body field from the API — may contain markdown, HTML, or plain text. */
    readonly raw: string;
    /** Astro site origin, forwarded to `sanitizeHtml` for absolute-URL handling. */
    readonly siteOrigin: string;
}

/**
 * Convert a user-authored body field into sanitized HTML ready for `set:html`.
 *
 * Empty / non-string inputs yield an empty string so callers can use the result
 * inside a conditional template without an extra guard.
 *
 * @example
 * ```ts
 * const safeHtml = renderContent({ raw: post.content, siteOrigin });
 * // → '<p>Hola <strong>mundo</strong></p>'
 * ```
 */
export function renderContent({ raw, siteOrigin }: RenderContentInput): string {
    if (typeof raw !== 'string' || raw.length === 0) return '';
    const rendered = marked.parse(raw, {
        async: false,
        gfm: true,
        breaks: false
    }) as string;
    return sanitizeHtml({ html: rendered, siteOrigin });
}
