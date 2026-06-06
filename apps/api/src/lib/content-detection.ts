/**
 * Content detection helpers for entitlement gating and downgrade preview.
 *
 * This module is the single source of truth for pattern-based detection of
 * rich-text (markdown) syntax and video embed URLs in accommodation description
 * fields. Both the accommodation-entitlement middleware gates
 * (`gateRichDescription`, `gateVideoEmbed`) and the downgrade excess preview
 * helper (`computeDowngradeExcess`) import from here so that a change to the
 * pattern set propagates to both consumers automatically.
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
 * - Unordered list items (`- item`, `* item`, `+ item`)
 * - Inline code (`` `code` ``)
 */
export const RICH_DESCRIPTION_PATTERNS: readonly RegExp[] = [
    /\*\*[^*]+\*\*/, // Bold (**text**)
    /(?:^|[^*])\*[^*\s][^*]*\*/, // Italic (*text*) — avoid matching bold's **
    /\[[^\]]+\]\([^)]+\)/, // Markdown links
    /^#{1,6}\s/m, // ATX headings
    /^[-*+]\s+\S/m, // Unordered list items
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
 */
export const VIDEO_EMBED_PATTERNS: readonly RegExp[] = [
    /\bhttps?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[\w-]+/i,
    /\bhttps?:\/\/(?:www\.)?vimeo\.com\/\d+/i,
    /\bhttps?:\/\/(?:www\.)?dailymotion\.com\/video\/[\w-]+/i
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
