/**
 * Content detection helpers for entitlement gating and downgrade preview.
 *
 * This module is the single source of truth for pattern-based detection of
 * rich-text (markdown) syntax and video embed URLs in accommodation description
 * fields, plus (HOS-216) the matching "neutralize" helpers that strip just the
 * gated syntax instead of rejecting the whole string. Both the
 * accommodation-entitlement middleware gates (`gateRichDescription`,
 * `gateVideoEmbed`) and the downgrade excess preview helper
 * (`computeDowngradeExcess`) import the detection functions from here so that
 * a change to the pattern set propagates to both consumers automatically; the
 * strip helpers are consumed only by the middleware gates (the downgrade
 * preview is read-only and never mutates content).
 *
 * **Why lib/ and not a service?**
 * These are pure, stateless string-inspection functions with no I/O dependency.
 * `lib/` is the established home for shared, framework-agnostic helpers inside
 * `apps/api` (see `billing-provider-error.ts`, `request-context.ts`, etc.).
 *
 * @module lib/content-detection
 */

// ---------------------------------------------------------------------------
// Markdown / rich-description patterns
// ---------------------------------------------------------------------------

/**
 * RegExp patterns that indicate markdown syntax in a description string.
 *
 * Conservative by design: plain prose that happens to contain `*` or `#` is
 * unlikely to match any of these — the patterns require structural context
 * (word boundaries, line starts, paired delimiters). Returning `false` for
 * plain text is intentional: a user without `CAN_USE_RICH_DESCRIPTION` must
 * still be able to write plain descriptions.
 *
 * Patterns:
 * - Bold (`**text**`)
 * - Italic (`*text*`, avoiding double-star bold matches)
 * - Markdown links (`[text](url)`)
 * - ATX headings (`# Heading` … `###### Heading`)
 * - Unordered list items — requires **2+ consecutive bullet lines**
 *   (`- item\n- item`, `* item\n* item`, `+ item\n+ item`)
 * - Inline code (`` `code` ``)
 *
 * HOS-216: the unordered-list pattern originally matched a SINGLE line
 * starting with `-`/`*`/`+` (`/^[-*+]\s+\S/m`). Hosts routinely write a
 * one-line plain-text amenity ("- WiFi") with no markdown intent at all,
 * so that single-line form false-positived on ordinary prose and triggered
 * the rich-content gate on ordinary PATCH requests. A real markdown list
 * needs at least two consecutive bullet lines to read as a "list" — a lone
 * bullet-prefixed line is indistinguishable from plain text and must not
 * match.
 *
 * HOS-216 follow-up: "consecutive" originally required the two bullet lines
 * to be immediately adjacent (no blank line between them), so
 * `"- WiFi\n\n- Pileta"` (a blank-line-separated list — how most markdown
 * renderers, and hosts writing multi-paragraph descriptions, actually format
 * a list) did not match and bypassed the `CAN_USE_RICH_DESCRIPTION` gate.
 * The pattern now allows one or more blank/whitespace-only lines between the
 * two bullet lines while still requiring exactly a bullet-prefixed line to
 * start and end the match — a single bullet line with no second bullet
 * anywhere after it still does not match.
 */
export const RICH_DESCRIPTION_PATTERNS: readonly RegExp[] = [
    /\*\*[^*]+\*\*/, // Bold (**text**)
    /(?:^|[^*])\*[^*\s][^*]*\*/, // Italic (*text*) — avoid matching bold's **
    /\[[^\]]+\]\([^)]+\)/, // Markdown links
    /^#{1,6}\s/m, // ATX headings
    // Unordered list — 2+ bullet lines, possibly separated by blank/whitespace-only lines (HOS-216)
    /^[-*+]\s+\S[^\n]*(?:\r?\n[ \t]*)+[-*+]\s+\S/m,
    /`[^`\n]+`/ // Inline code
];

/**
 * Returns `true` if `value` contains any markdown formatting syntax that is
 * gated by the `CAN_USE_RICH_DESCRIPTION` entitlement.
 *
 * Used by:
 * - `gateRichDescription()` middleware (request-time enforcement)
 * - `computeDowngradeExcess()` service (downgrade preview detection)
 *
 * @param value - The description string to inspect.
 * @returns `true` when markdown syntax is detected, `false` otherwise.
 *
 * @example
 * ```ts
 * containsRichDescription('**bold** text');   // true
 * containsRichDescription('plain prose');      // false
 * containsRichDescription('# Heading');        // true
 * ```
 */
export function containsRichDescription(value: string): boolean {
    return RICH_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Removes markdown formatting syntax from `value`, converting it to its
 * closest plain-text equivalent instead of rejecting the whole string.
 *
 * HOS-216: `gateRichDescription()` used to `throw` a 403 for the entire
 * request when it detected rich content the actor isn't entitled to — which
 * aborted an owner's entire accommodation PATCH (losing name/price/capacity/
 * contact changes) over a description field. This helper lets the middleware
 * neutralize only the offending markdown syntax and let the rest of the
 * request proceed, instead of discarding the whole payload.
 *
 * Markers are stripped, not the surrounding text — `**Bold**` becomes
 * `Bold`, `[link](url)` becomes `link`, `- item` becomes `item`. This is a
 * deliberate, logged relaxation of SPEC-143's original "no silent strip"
 * decision (see the `gateRichDescription` doc comment in
 * `accommodation-entitlements.ts` for the full rationale).
 *
 * @param value - The description string to neutralize.
 * @returns `value` with all markdown syntax markers removed.
 *
 * @example
 * ```ts
 * stripRichDescriptionSyntax('**Bold** text');        // 'Bold text'
 * stripRichDescriptionSyntax('- WiFi\n- Pileta');      // 'WiFi\nPileta'
 * stripRichDescriptionSyntax('plain prose');           // 'plain prose'
 * ```
 */
export function stripRichDescriptionSyntax(value: string): string {
    return value
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold (**text**) -> text
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1$2') // Italic (*text*) -> text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Markdown links -> link text
        .replace(/^#{1,6}\s+/gm, '') // ATX heading markers
        .replace(/^[-*+]\s+/gm, '') // Unordered list bullet markers
        .replace(/`([^`\n]+)`/g, '$1'); // Inline code -> code text
}

// ---------------------------------------------------------------------------
// Video embed URL patterns
// ---------------------------------------------------------------------------

/**
 * RegExp patterns that match video embed URLs in a description string.
 *
 * Covers the major providers that Hospeda explicitly gates:
 * - YouTube (`youtube.com/...` and `youtu.be/...` short links)
 * - Vimeo (`vimeo.com/<id>`)
 * - Dailymotion (`dailymotion.com/video/<id>`)
 *
 * Conservative by design: a plain mention of "youtube" in prose without a URL
 * does NOT match — all patterns require the `https?://` scheme prefix.
 *
 * The YouTube path segment (`[\w/-]+`) also allows an internal `/` so
 * multi-segment paths like `/embed/<id>` match in full, not just their first
 * segment. Each pattern also consumes a trailing query string / fragment
 * (`(?:[?#][\w&=%~+/-]*)?`), e.g. `?v=abc123&list=xyz` on a YouTube `watch`
 * URL. Without this, `stripVideoEmbeds` only removed the base URL and left
 * the query string behind as visible junk in the neutralized description
 * (the actual embed id lives in `?v=`, so leaving it also defeats the point
 * of stripping the embed in the first place).
 *
 * HOS-216 regression fix: the query/fragment tail used to be `[^\s]*`
 * (anything up to the next whitespace), which is too greedy when a host
 * pastes a URL with no trailing space — `?v=abc123).Es buenisimo` or
 * `?t=30s,altamente recomendado` — it consumed the closing markdown paren,
 * sentence punctuation, and even the next word. The tail is now restricted
 * to characters that actually appear in a real query string / fragment
 * (`\w`, `&`, `=`, `%`, `~`, `+`, `/`, `-`), which stops the match at `)`,
 * `]`, `,`, `.`, `!`, `?`, quotes, and whitespace — the exact characters
 * that terminate a sentence or close a markdown construct. `.` is
 * deliberately excluded even though it can appear in query values: a real
 * query almost never *ends* in a bare `.`, but plain prose constantly does
 * (`...?v=abc123. Buenísimo!`), so excluding it trades "one stray `.` left
 * behind" for "never eating the start of the next sentence".
 */
export const VIDEO_EMBED_PATTERNS: readonly RegExp[] = [
    /\bhttps?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[\w/-]+(?:[?#][\w&=%~+/-]*)?/i,
    /\bhttps?:\/\/(?:www\.)?vimeo\.com\/\d+(?:[?#][\w&=%~+/-]*)?/i,
    /\bhttps?:\/\/(?:www\.)?dailymotion\.com\/video\/[\w-]+(?:[?#][\w&=%~+/-]*)?/i
];

/**
 * Returns `true` if `value` contains a recognised video embed URL that is
 * gated by the `CAN_EMBED_VIDEO` entitlement.
 *
 * Used by:
 * - `gateVideoEmbed()` middleware (request-time enforcement)
 * - `computeDowngradeExcess()` service (downgrade preview detection)
 *
 * @param value - The description string to inspect.
 * @returns `true` when a video embed URL is detected, `false` otherwise.
 *
 * @example
 * ```ts
 * containsVideoEmbed('Watch at https://youtube.com/watch?v=abc');  // true
 * containsVideoEmbed('Check out youtube for videos');              // false
 * containsVideoEmbed('https://vimeo.com/123456');                  // true
 * ```
 */
export function containsVideoEmbed(value: string): boolean {
    return VIDEO_EMBED_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Removes recognised video embed URLs from `value`, collapsing the leftover
 * whitespace instead of rejecting the whole string.
 *
 * HOS-216: mirrors {@link stripRichDescriptionSyntax} — `gateVideoEmbed()`
 * uses this to neutralize only the video-URL portion of `description` when
 * the actor lacks `CAN_EMBED_VIDEO`, instead of throwing a 403 that aborts
 * the entire PATCH request. See the `gateVideoEmbed` doc comment in
 * `accommodation-entitlements.ts` for the full policy rationale.
 *
 * @param value - The description string to neutralize.
 * @returns `value` with all recognised video embed URLs removed.
 *
 * @example
 * ```ts
 * stripVideoEmbeds('Watch: https://youtube.com/watch?v=abc'); // 'Watch:'
 * stripVideoEmbeds('plain prose');                             // 'plain prose'
 * ```
 */
export function stripVideoEmbeds(value: string): string {
    let result = value;
    for (const pattern of VIDEO_EMBED_PATTERNS) {
        const globalPattern = new RegExp(
            pattern.source,
            pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
        );
        result = result.replace(globalPattern, '');
    }
    return result
        .replace(/[ \t]+\n/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}
