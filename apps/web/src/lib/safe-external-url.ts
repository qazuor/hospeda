/**
 * @file safe-external-url.ts
 * @description Scheme allow-list for user-authored outbound links.
 */

/**
 * The only two schemes that may reach an `href` built from user-authored input.
 *
 * An allow-list, not a deny-list: blocking `javascript:` and `data:` by name
 * invites the next scheme nobody thought of (`vbscript:`, `blob:`, whatever a
 * future engine adds). Anything not named here is refused.
 */
const ALLOWED_PROTOCOLS: readonly string[] = ['http:', 'https:'];

/**
 * Highest code point the HTML parser discards before it reads a URL's scheme.
 *
 * `"\u0001javascript:alert(1)"` reaches the browser as `javascript:alert(1)`,
 * so those bytes have to be stripped here too — otherwise a check on the raw
 * string disagrees with what the browser will actually navigate to.
 * `String.trim()` alone is not enough: it drops whitespace but leaves
 * `\u0001`-`\u0008`.
 *
 * Done with a code-point scan rather than a regex character class on purpose:
 * a regex would need literal control characters in the source, which is both a
 * lint violation and a thing that silently corrupts on copy/paste.
 */
const MAX_IGNORED_LEADING_CODE_POINT = 0x20;

/**
 * Strips the leading bytes an HTML parser would ignore, so the scheme this
 * function inspects is the scheme the browser will act on.
 *
 * @param value - Raw candidate string.
 * @returns The value without its ignorable prefix.
 */
function stripIgnorableLeadingChars(value: string): string {
    let start = 0;
    while (start < value.length && value.charCodeAt(start) <= MAX_IGNORED_LEADING_CODE_POINT) {
        start += 1;
    }
    return value.slice(start);
}

/**
 * Returns the URL when it is safe to place in an outbound `href`, or
 * `undefined` when it is not. Callers must omit the link entirely on
 * `undefined` — never fall back to the raw value.
 *
 * ## Why schema validation is not enough
 *
 * `z.string().url()` does **not** restrict the scheme. Verified empirically
 * against this repo's Zod version: `javascript:alert(1)`,
 * `data:text/html,<script>…</script>` and `vbscript:msgbox(1)` all parse as
 * valid URLs. A field typed `z.string().url()` is therefore still a stored-XSS
 * sink the moment it is rendered into an `href`, and the type gives a false
 * sense of safety precisely because it looks like validation.
 *
 * This matters most where the value is authored by an end user rather than by
 * staff: an accommodation's contact website and social links (H-118) are
 * written by the host in the editor and published with no review in between.
 *
 * @param value - Candidate URL, typically straight from the API payload.
 * @returns The trimmed URL when its scheme is http/https, otherwise `undefined`.
 *
 * @example
 * ```ts
 * resolveSafeExternalUrl('https://cheroga.com.ar'); // 'https://cheroga.com.ar'
 * resolveSafeExternalUrl('javascript:alert(1)');    // undefined
 * ```
 */
export function resolveSafeExternalUrl(value: string | null | undefined): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const candidate = stripIgnorableLeadingChars(value).trim();
    if (candidate.length === 0) {
        return undefined;
    }

    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch {
        // Relative and protocol-relative values land here; neither is an
        // external link whose destination we can vouch for.
        return undefined;
    }

    return ALLOWED_PROTOCOLS.includes(parsed.protocol.toLowerCase()) ? candidate : undefined;
}
