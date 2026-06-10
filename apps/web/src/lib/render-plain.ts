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
 * Canonical marker set used by the PL/pgSQL strip migrations
 * (`packages/db/src/migrations/0008_strip_accommodation_description_markdown.sql`
 * and the follow-up `0011_restrip_accommodation_description_markdown.sql`).
 * This is the JS-side mirror so `entitlement-filter.ts#stripMarkdown` and
 * the SQL `strip_markdown()` function can be kept in lockstep (PD-1).
 *
 * Source of truth: the `stripMarkdown` function in
 * `apps/api/src/utils/entitlement-filter.ts`. The ORDER and rules here MUST
 * match that function byte-for-byte in observable output. In particular:
 *  - underscore emphasis (`__bold__`, `_italic_`) is stripped (SPEC-187 follow-up);
 *  - the image rule runs BEFORE the link rule (so `![alt](url)` -> `alt`);
 *  - a trailing `\n{3,}` -> `\n\n` collapse keeps JS output equal to SQL.
 *
 * Replacement chars per index (applied in this order by callers / the test):
 *  0:$1 1:$1 2:$1 3:$1 4:$1 5:$1 6:$1 7:$1 8:'' 9:'' 10:'' 11:'\n\n'
 */
export const STRIP_MARKDOWN_REGEX_SET: readonly RegExp[] = [
    /\*\*(.+?)\*\*/g, // **bold**
    /\*(.+?)\*/g, // *italic*
    /__(.+?)__/g, // __bold__
    /_(.+?)_/g, // _italic_
    /~~(.+?)~~/g, // ~~strikethrough~~
    /`(.+?)`/g, // `code`
    /!\[(.+?)\]\(.+?\)/g, // ![alt](url) — BEFORE links
    /\[(.+?)\]\(.+?\)/g, // [text](url)
    /^#+\s+/gm, // # heading
    /^[-*+]\s+/gm, // - list
    /^>\s+/gm, // > quote
    /\n{3,}/g // collapse 3+ newlines -> \n\n
];

/**
 * Web-side mirror of `apps/api/src/utils/entitlement-filter.ts#stripMarkdown`.
 *
 * Applies {@link STRIP_MARKDOWN_REGEX_SET} in canonical order and MUST produce
 * the same observable output as the JS source-of-truth function and the SQL
 * `strip_markdown()` migrations (PD-1 lockstep). The first eight rules replace
 * with the captured inner text (`$1`); headings / bullets / blockquotes are
 * removed (`''`); the final rule collapses `\n{3,}` to `\n\n`. Output is
 * trimmed.
 *
 * This is the strip half of the pipeline. `renderPlain` is the escape half and
 * is what the public detail page actually calls; this helper exists so a unit
 * test can pin the web mirror against the API source of truth without copying
 * the regex chain.
 *
 * @param raw - Text with potential markdown markers.
 * @returns Plain text with markers removed.
 */
export function stripMarkdownPlain(raw: string): string {
    if (typeof raw !== 'string' || raw.length === 0) return '';
    return raw
        .replace(STRIP_MARKDOWN_REGEX_SET[0], '$1')
        .replace(STRIP_MARKDOWN_REGEX_SET[1], '$1')
        .replace(STRIP_MARKDOWN_REGEX_SET[2], '$1')
        .replace(STRIP_MARKDOWN_REGEX_SET[3], '$1')
        .replace(STRIP_MARKDOWN_REGEX_SET[4], '$1')
        .replace(STRIP_MARKDOWN_REGEX_SET[5], '$1')
        .replace(STRIP_MARKDOWN_REGEX_SET[6], '$1')
        .replace(STRIP_MARKDOWN_REGEX_SET[7], '$1')
        .replace(STRIP_MARKDOWN_REGEX_SET[8], '')
        .replace(STRIP_MARKDOWN_REGEX_SET[9], '')
        .replace(STRIP_MARKDOWN_REGEX_SET[10], '')
        .replace(STRIP_MARKDOWN_REGEX_SET[11], '\n\n')
        .trim();
}
