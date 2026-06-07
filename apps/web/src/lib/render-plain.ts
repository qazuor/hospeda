/**
 * @file render-plain.ts
 * @description Text-node sink for plain-text fields. Sibling of `renderContent`
 * (which is the markdown-to-HTML pipeline used by `set:html`); this helper is
 * the plain-text pipeline for **plain text interpolation** (NO `set:html`).
 *
 * SPEC-187 FR-2 / PD-2 / PD-6:
 *  - Used to render `accommodation.description` on the public detail page.
 *  - HTML-escapes the input so a hostile string like `<script>alert(1)</script>`
 *    becomes literal text.
 *  - Does NOT interpret markdown. A `**bold**` round-trips as the literal
 *    characters, exactly as the user typed them.
 *  - Returns an empty string for empty / non-string input so callers can use
 *    the result in a conditional template without an extra guard.
 *
 * The exported `STRIP_MARKDOWN_REGEX_SET` mirrors the regex list in
 * `apps/api/src/utils/entitlement-filter.ts` (PD-1 source of truth) so a
 * divergence between the JS strip and the P0 PL/pgSQL strip is caught at
 * unit-test time.
 */

/**
 * Argument bundle for {@link renderPlain}.
 */
export interface RenderPlainInput {
    /** Raw plain-text body field from the API. May contain markdown-like
     *  characters, HTML tags, or any other content — the helper does not
     *  interpret it. */
    readonly raw: string;
}

/**
 * Render a plain-text body field as an HTML-escaped text node.
 *
 * The returned string is safe to interpolate as a text child in Astro / JSX
 * (`{renderPlain(...)}`); it MUST NOT be piped into `set:html`. For fields
 * that contain markdown, use `renderContent` from `@/lib/render-content`
 * instead.
 *
 * @example
 * ```ts
 * // Astro:
 * <p>{renderPlain({ raw: accommodation.description })}</p>
 * ```
 */
export function renderPlain({ raw }: RenderPlainInput): string {
    if (typeof raw !== 'string' || raw.length === 0) return '';
    return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Canonical marker set used by the P0 PL/pgSQL strip migration
 * (`packages/db/src/migrations/0008_strip_accommodation_description_markdown.sql`).
 * This is the JS-side mirror so `entitlement-filter.ts#stripMarkdown` and
 * the SQL `strip_markdown()` function can be kept in lockstep.
 *
 * Source of truth: `apps/api/src/utils/entitlement-filter.ts:188-199`
 * (PD-1 — spec defect resolved by reusing the JS regex set verbatim).
 */
export const STRIP_MARKDOWN_REGEX_SET: readonly RegExp[] = [
    /\*\*(.+?)\*\*/g, // **bold**
    /\*(.+?)\*/g, // *italic*
    /\[(.+?)\]\(.+?\)/g, // [text](url)
    /^#+\s+/gm, // # heading
    /^[-*+]\s+/gm, // - list
    /`(.+?)`/g, // `code`
    /^>\s+/gm, // > quote
    /~~(.+?)~~/g, // ~~strikethrough~~
    /!\[(.+?)\]\(.+?\)/g // ![alt](url)
];
