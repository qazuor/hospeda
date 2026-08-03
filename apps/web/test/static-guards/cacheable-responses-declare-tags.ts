/**
 * @file cacheable-responses-declare-tags.ts
 * @description Detector used by the guard of the same name (HOS-369 W1-1).
 *
 * Split from the test file so the detection rules can themselves be tested on
 * synthetic sources. A guard that is never shown to FAIL is a guard nobody
 * knows works.
 *
 * @module test/static-guards/cacheable-responses-declare-tags
 */

/** How a source file was classified with respect to shared-cache eligibility. */
export type CacheControlVerdict =
    | { readonly kind: 'none' }
    | { readonly kind: 'private' }
    | { readonly kind: 'cacheable'; readonly values: readonly string[] };

/**
 * Strip comments so prose cannot be mistaken for code.
 *
 * All THREE comment forms are removed. The HTML form is the one that gets
 * forgotten (HOS-379) and it is the one `.astro` templates use, which is
 * exactly where a page explains its caching in prose.
 *
 * @param params.source - Raw file contents.
 * @returns The source with block, line and HTML comments blanked out.
 */
export function stripComments({ source }: { readonly source: string }): string {
    return source
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/gm, '$1');
}

/**
 * Every place a source file writes the `Cache-Control` header, in either of the
 * two shapes this app uses: `headers.set('Cache-Control', <value>)` and a
 * `{ 'Cache-Control': <value> }` entry in a `Response` init.
 */
const CACHE_CONTROL_WRITE =
    /['"]Cache-Control['"]\s*[,:]\s*(`[^`]*`|'[^']*'|"[^"]*"|[A-Za-z_$][\w$.]*)/g;

/** Anything that produces cache tags for the response being written. */
const TAG_PRODUCERS: ReadonlyArray<RegExp> = [
    /\bapplyCacheHeaders\s*\(/,
    /\bdeclareCacheTags\s*\(/,
    /\bserializeCacheTags\s*\(/,
    /['"]Cache-Tag['"]/,
    /\bCACHE_TAG_HEADER_NAME\b/
];

/**
 * Whether a `Cache-Control` value makes a response eligible for the shared
 * cache. Mirrors `src/lib/cache/response-cache.ts`'s `isEdgeCacheableControl`,
 * intentionally duplicated rather than imported: the guard must keep working if
 * that module is renamed or refactored, which is precisely when a mistake is
 * most likely.
 *
 * @param params.value - The literal written next to the header name.
 * @returns `true` when the value declares shared cacheability.
 */
function isCacheableValue({ value }: { readonly value: string }): boolean {
    const isLiteral = /^['"`]/.test(value);
    // A non-literal value (identifier or call result) is opaque to a static
    // scan. "I cannot tell" resolves to "police it" — the opposite default is
    // how a fail-open hides inside an escape hatch.
    if (!isLiteral) return true;

    const lowered = value.toLowerCase();
    if (lowered.includes('private') || lowered.includes('no-store')) return false;
    return lowered.includes('public') || lowered.includes('s-maxage');
}

/**
 * Classify a source file by what it does to `Cache-Control`.
 *
 * A non-literal value (an identifier or call result) is classified as
 * `cacheable`, not skipped. The guard cannot see through it, and the safe
 * reading of "I could not tell" is "assume it needs a tag" — the opposite
 * default is how a fail-open hides in an escape hatch.
 *
 * @param params.source - Raw file contents.
 * @returns The verdict, carrying the offending values when cacheable.
 */
export function classifyCacheControl({ source }: { readonly source: string }): CacheControlVerdict {
    const code = stripComments({ source });
    const values: string[] = [];
    let sawWrite = false;

    for (const match of code.matchAll(CACHE_CONTROL_WRITE)) {
        sawWrite = true;
        const value = match[1] ?? '';
        if (isCacheableValue({ value })) values.push(value);
    }

    if (values.length > 0) return { kind: 'cacheable', values };
    return sawWrite ? { kind: 'private' } : { kind: 'none' };
}

/**
 * Whether a source file produces cache tags for the response it caches.
 *
 * @param params.source - Raw file contents.
 * @returns `true` when at least one tag producer is present.
 */
export function producesCacheTags({ source }: { readonly source: string }): boolean {
    const code = stripComments({ source });
    return TAG_PRODUCERS.some((pattern) => pattern.test(code));
}

/**
 * The guard's whole rule: a file that declares a response shared-cacheable must
 * also produce the tags that purge it.
 *
 * @param params.source - Raw file contents.
 * @returns `true` when the file violates the rule.
 */
export function violatesTagRule({ source }: { readonly source: string }): boolean {
    return classifyCacheControl({ source }).kind === 'cacheable' && !producesCacheTags({ source });
}
