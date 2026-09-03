/**
 * HTML → plain-text conversion shared by the import extractors (HOS-799).
 *
 * Two converters live here, and the difference between them is the whole point
 * of this module:
 *
 * - **{@link stripHtmlToText}** flattens everything — every run of whitespace,
 *   line breaks included, collapses to a single space. That is correct for the
 *   AI Strategy-B prompt, where paragraph structure carries no meaning and
 *   every character costs tokens.
 * - **{@link stripHtmlToParagraphText}** preserves paragraph structure by
 *   turning block-level boundaries into real line breaks before the tags are
 *   stripped. That is what the `description` candidate needs: the field is
 *   multi-paragraph, and a flattened blob welds sentences together
 *   ("…memorables!Nuestra quinta…").
 *
 * **Why a body converter exists at all (HOS-799)**: the generic adapter used to
 * source `description` exclusively from the page's SEO metadata (JSON-LD
 * `description`, `og:description`, `<meta name="description">`). Those values
 * are single-line by construction and routinely pre-truncated by the source's
 * SEO plugin, so the host inherited a flat, clipped teaser as the body of their
 * own listing. Reading the rendered page text gives the real content back.
 *
 * @module services/accommodation-import/extractors/html-text
 */

// ---------------------------------------------------------------------------
// Shared regexes
// ---------------------------------------------------------------------------

/**
 * Matches `<script>` and `<style>` elements including their content.
 * `[\s\S]*?` (lazy) rather than a greedy run, to avoid catastrophic
 * backtracking on malformed markup.
 */
const SCRIPT_STYLE_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/**
 * Matches page-chrome elements whose text is never listing content:
 * navigation, headers/footers, sidebars, forms, and embedded widgets.
 *
 * This is the mitigation for the one real risk of reading the page body — a
 * cookie banner or a nav menu landing in the host's description. It is a
 * heuristic, not a parser: deeply nested same-tag pairs can leave residue, and
 * that is acceptable because the downstream candidate is a *pre-fill* the host
 * reviews before saving, never a silent write.
 */
const PAGE_CHROME_RE =
    /<(nav|header|footer|aside|form|noscript|svg|iframe|select|button)\b[^>]{0,2000}>[\s\S]*?<\/\1\s*>/gi;

/**
 * Matches an HTML comment, including its content.
 *
 * This MUST be stripped before anything else in the pipeline — before even
 * the body-scope (HOS-1029). Two independent reasons:
 *
 * 1. {@link BODY_CONTENT_RE} matches the first LITERAL `<body` in the
 *    document. A `<head>` comment that merely mentions `<body>` in its prose
 *    (a doc comment explaining layout behaviour, for instance) anchors the
 *    scope tens of thousands of characters too early, dragging half the
 *    `<head>` — including other comments with internal ticket numbers and
 *    staging URLs — into the "content" that gets offered as the listing
 *    description.
 * 2. {@link HTML_TAG_RE} stops at the first `>`. A comment whose text
 *    contains a `>` truncates the tag match there, leaving the remainder of
 *    the comment — including the closing `-->` — as literal output text.
 */
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

/**
 * Captures the contents of `<body>`.
 *
 * Scoping to the body is not cosmetic: `<head>` holds `<title>`, and without
 * this the title text lands in the extracted "content" — enough, on a thin
 * page, for a scrap of chrome to clear the description minimum and preempt a
 * better candidate. Must run AFTER {@link HTML_COMMENT_RE} strips comments —
 * see its doc comment for why.
 */
const BODY_CONTENT_RE = /<body\b[^>]{0,2000}>([\s\S]*?)<\/body\s*>/i;

/** Matches the whole `<head>` element — the fallback when there is no `<body>`. */
const HEAD_RE = /<head\b[^>]{0,2000}>[\s\S]*?<\/head\s*>/i;

/** Matches `<br>` in any of its spellings. */
const BR_RE = /<br\b[^>]{0,200}\/?>/gi;

/**
 * Matches the CLOSING tag of a block-level element — the boundary where a
 * paragraph break belongs.
 */
const BLOCK_END_RE =
    /<\/(?:p|div|section|article|main|li|ul|ol|dl|dd|dt|h[1-6]|blockquote|pre|tr|table|figure|figcaption)\s*>/gi;

/** Matches any remaining HTML tag. Bounded to avoid pathological backtracking. */
const HTML_TAG_RE = /<[^>]{0,5000}>/g;

/** Matches any run of whitespace, line breaks included. */
const ANY_WHITESPACE_RE = /\s+/g;

/** Matches runs of spaces/tabs but NOT line breaks. */
const INLINE_WHITESPACE_RE = /[^\S\n]+/g;

/** Matches a run of whitespace that surrounds a single line break. */
const LINE_BREAK_WITH_PADDING_RE = /[^\S\n]*\n[^\S\n]*/g;

/** Matches three or more consecutive line breaks. */
const EXCESS_NEWLINES_RE = /\n{3,}/g;

/** The HTML entities worth decoding for plain-text extraction. */
const HTML_ENTITY_RE = /&(?:amp|lt|gt|quot|#39|nbsp);/g;

// ---------------------------------------------------------------------------
// Entity decoding
// ---------------------------------------------------------------------------

/**
 * Decodes the small set of HTML entities that matter for plain-text extraction,
 * in a SINGLE pass.
 *
 * The single pass is load-bearing, not a micro-optimisation: a chained replace
 * that handled `&amp;` first would turn `&amp;lt;` into `&lt;` and then into
 * `<`, double-decoding attacker-controlled markup (the CodeQL double-unescape
 * finding). One pass decodes exactly one level.
 *
 * @param text - Text possibly containing HTML entities.
 * @returns The text with the known entities decoded one level.
 *
 * @example
 * ```ts
 * decodeHtmlEntities('a &amp;lt; b'); // 'a &lt; b' — one level, not '<'
 * ```
 */
export function decodeHtmlEntities(text: string): string {
    return text.replace(HTML_ENTITY_RE, (entity) => {
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
}

// ---------------------------------------------------------------------------
// stripHtmlToText — flattening converter (AI Strategy-B)
// ---------------------------------------------------------------------------

/**
 * Converts raw HTML to a single-line plain-text string suitable for
 * AI-assisted extraction (Strategy B).
 *
 * Removes HTML comments FIRST (HOS-1029), then `<script>`/`<style>` blocks,
 * strips all remaining tags, decodes common entities, collapses EVERY run of
 * whitespace (line breaks included) into a single space, trims, and
 * truncates to `maxChars`.
 *
 * Never throws. Empty or whitespace-only input returns an empty string.
 *
 * @param input - The raw HTML and the character ceiling.
 * @returns Flattened plain text, truncated to `maxChars`.
 *
 * @example
 * ```ts
 * const text = stripHtmlToText({ html: pageHtml, maxChars: 4000 });
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

    HTML_COMMENT_RE.lastIndex = 0;
    let text = html.replace(HTML_COMMENT_RE, ' ');

    SCRIPT_STYLE_RE.lastIndex = 0;
    text = text.replace(SCRIPT_STYLE_RE, ' ');

    HTML_TAG_RE.lastIndex = 0;
    text = text.replace(HTML_TAG_RE, ' ');

    text = decodeHtmlEntities(text);

    ANY_WHITESPACE_RE.lastIndex = 0;
    text = text.replace(ANY_WHITESPACE_RE, ' ').trim();

    return text.length <= maxChars ? text : text.slice(0, maxChars);
}

// ---------------------------------------------------------------------------
// stripHtmlToParagraphText — structure-preserving converter (HOS-799)
// ---------------------------------------------------------------------------

/**
 * Converts raw HTML to plain text while PRESERVING paragraph structure.
 *
 * **Pipeline:**
 * 0. Remove HTML comments (HOS-1029) — BEFORE anything else, including the
 *    body-scope. See {@link HTML_COMMENT_RE} for why the ordering is load-bearing.
 * 1. Scope to `<body>` (falls back to stripping `<head>` when there is none).
 * 2. Remove `<script>` / `<style>` blocks and their content.
 * 3. Remove page chrome (`<nav>`, `<header>`, `<footer>`, `<aside>`, `<form>`,
 *    …) so menus and cookie banners never reach the host's description.
 * 4. Turn `<br>` and every block-level CLOSING tag into a line break — this
 *    step is what separates this function from {@link stripHtmlToText}, and it
 *    must run BEFORE the generic tag strip or the boundaries are gone.
 * 5. Strip the remaining tags.
 * 6. Decode common entities.
 * 7. Collapse spaces/tabs (but NOT line breaks), strip the padding around each
 *    break, and cap consecutive breaks at one blank line.
 * 8. Trim and truncate to `maxChars`.
 *
 * Never throws. Empty or whitespace-only input returns an empty string.
 *
 * @param input - The raw HTML and the character ceiling.
 * @returns Plain text with paragraph breaks preserved, truncated to `maxChars`.
 *
 * @example
 * ```ts
 * stripHtmlToParagraphText({ html: '<p>Uno</p><p>Dos</p>', maxChars: 100 });
 * // 'Uno\n\nDos'
 * ```
 */
export function stripHtmlToParagraphText(input: {
    readonly html: string;
    readonly maxChars: number;
}): string {
    const { html, maxChars } = input;

    if (html.length === 0) {
        return '';
    }

    // Step 0 — remove HTML comments FIRST, before the body-scope or anything
    // else (HOS-1029). See HTML_COMMENT_RE's doc comment: a <head> comment
    // that merely mentions "<body>" in its prose would otherwise anchor the
    // scope tens of thousands of characters too early.
    HTML_COMMENT_RE.lastIndex = 0;
    const withoutComments = html.replace(HTML_COMMENT_RE, ' ');

    // Step 1 — scope to <body>. Falls back to stripping <head> when the markup
    // has no explicit body element (fragments, malformed pages).
    const bodyMatch = BODY_CONTENT_RE.exec(withoutComments);
    const scoped = bodyMatch?.[1] ?? withoutComments.replace(HEAD_RE, ' ');

    // Step 2 — drop scripts and styles.
    SCRIPT_STYLE_RE.lastIndex = 0;
    let text = scoped.replace(SCRIPT_STYLE_RE, ' ');

    // Step 3 — drop page chrome.
    PAGE_CHROME_RE.lastIndex = 0;
    text = text.replace(PAGE_CHROME_RE, ' ');

    // Step 4 — block boundaries become line breaks, BEFORE the tag strip.
    //
    // `<br>` is a break WITHIN a paragraph, so it emits one newline; a block
    // close ends a paragraph, so it emits two. Emitting two (rather than one,
    // and letting the source's own indentation supply the second) is what makes
    // the output independent of how the page was formatted: pretty-printed and
    // minified markup must yield the same paragraphs. The `\n{3,}` cap below
    // collapses any pile-up.
    BR_RE.lastIndex = 0;
    text = text.replace(BR_RE, '\n');
    BLOCK_END_RE.lastIndex = 0;
    text = text.replace(BLOCK_END_RE, '\n\n');

    // Step 5 — strip whatever markup is left.
    HTML_TAG_RE.lastIndex = 0;
    text = text.replace(HTML_TAG_RE, ' ');

    // Step 6 — decode entities.
    text = decodeHtmlEntities(text);

    // Step 7 — normalise whitespace WITHOUT touching the breaks we just made.
    // Order matters: strip the padding around each break first, otherwise the
    // inline pass leaves a space between consecutive breaks and `\n{3,}` can
    // never match.
    text = text
        .replace(/\r\n?/g, '\n')
        .replace(LINE_BREAK_WITH_PADDING_RE, '\n')
        .replace(EXCESS_NEWLINES_RE, '\n\n')
        .replace(INLINE_WHITESPACE_RE, ' ')
        .trim();

    // Step 8 — truncate.
    return text.length <= maxChars ? text : text.slice(0, maxChars);
}
