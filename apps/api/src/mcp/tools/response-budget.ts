/**
 * @file response-budget.ts
 * @description Response-size budget shared by every MCP tool (HOS-2335 spec
 * §5.3).
 *
 * The exact client limits are undocumented (spec §11 U-1), so these are
 * proposed values tuned during the staging smoke. They are constants, never
 * literals inside tools, and never environment variables.
 */

/** Maximum serialized size of one tool result, in characters. */
export const MCP_RESULT_MAX_CHARS = 24_000;

/** Maximum length of a free-text excerpt inside a list result, in characters. */
export const MCP_TEXT_EXCERPT_CHARS = 600;

/** Maximum `pageSize` of a paginated list tool. */
export const MCP_LIST_MAX_PAGE_SIZE = 20;

/** Target p95 handler latency on staging data, in milliseconds. */
export const MCP_HANDLER_P95_TARGET_MS = 3000;

/** Marker appended to a truncated excerpt. */
const ELLIPSIS = '…';

/** Result of {@link excerptText}. */
export interface ExcerptResult {
    /** The text, cut to at most `maxChars` characters (ellipsis included). */
    readonly text: string;
    /** `true` when the original was longer than `maxChars`. */
    readonly truncated: boolean;
}

/**
 * Cuts free text to an excerpt. Never splits a surrogate pair.
 *
 * @param params.text - The full text
 * @param params.maxChars - Limit; defaults to {@link MCP_TEXT_EXCERPT_CHARS}. Below 1 yields `''`
 * @returns The excerpt and whether anything was cut
 *
 * @example
 * ```typescript
 * const { text, truncated } = excerptText({ text: review.text });
 * ```
 */
export function excerptText({
    text,
    maxChars = MCP_TEXT_EXCERPT_CHARS
}: {
    readonly text: string;
    readonly maxChars?: number;
}): ExcerptResult {
    if (maxChars < 1) {
        return { text: '', truncated: text.length > 0 };
    }
    if (text.length <= maxChars) {
        return { text, truncated: false };
    }
    let end = Math.max(0, maxChars - ELLIPSIS.length);
    const last = text.charCodeAt(end - 1);
    if (end > 0 && last >= 0xd800 && last <= 0xdbff) {
        end -= 1;
    }
    return { text: `${text.slice(0, end)}${ELLIPSIS}`, truncated: true };
}

/**
 * Measures a result the way it travels: its JSON-serialized length.
 *
 * @param params.value - The tool result
 * @returns Serialized length in characters
 */
export function measureResultChars({ value }: { readonly value: unknown }): number {
    return JSON.stringify(value)?.length ?? 0;
}

/**
 * Tells whether a result fits the response budget.
 *
 * @param params.value - The tool result
 * @param params.maxChars - Limit; defaults to {@link MCP_RESULT_MAX_CHARS}
 * @returns `true` when the serialized result is within the limit
 */
export function isWithinResultBudget({
    value,
    maxChars = MCP_RESULT_MAX_CHARS
}: {
    readonly value: unknown;
    readonly maxChars?: number;
}): boolean {
    return measureResultChars({ value }) <= maxChars;
}
