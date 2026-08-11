/**
 * @file jsx-tag-weights.ts
 * @description Tag-scoped `weight` extraction for one specific JSX/Astro
 * component tag (HOS-369 sprite-manifest).
 *
 * The pre-existing `apps/web/test/static-guards/icon-sprite-shipped-weights.ts`
 * already parses every literal `weight="…"` in a FILE and counts every
 * unresolvable `weight={…}` in a FILE — but it does not say WHICH tag a
 * weight belongs to, which the manifest analyzer needs (a file can render
 * several different icons at different weights). Rather than write a second
 * weight-literal regex that could silently drift from that guard's, this
 * module does exactly one new thing — carve out the substring of one JSX
 * open tag — and then hands that substring to the EXISTING
 * {@link findLiteralWeights}/{@link countDynamicWeights} functions, reused
 * verbatim. Two parsers that could disagree about what a "weight" looks like
 * is a bug generator; one parser used at two different scopes is not.
 *
 * @module scripts/icon-manifest/jsx-tag-weights
 */

import {
    countDynamicWeights,
    findLiteralWeights
} from '../../test/static-guards/icon-sprite-shipped-weights';

/**
 * Finds every JSX/Astro opening tag for `tagName` in `source` and returns
 * each tag's raw text, from `<Name` to the `>` (or `/>`) that closes it.
 *
 * Scans char-by-char tracking `{}` nesting depth and string-literal state so
 * an attribute like `weight={condition ? 'fill' : 'regular'}` — which
 * contains its own `>`-free but brace-laden expression — does not truncate
 * the tag early, and a `>` inside a quoted attribute value does not either.
 *
 * @param params.source - File contents to scan.
 * @param params.tagName - Exact JSX tag name to find (e.g. `"StarIcon"`).
 * @returns The full text of every matching opening tag, in source order.
 */
export function findJsxOpenTags({
    source,
    tagName
}: {
    readonly source: string;
    readonly tagName: string;
}): string[] {
    const tags: string[] = [];
    const openPattern = new RegExp(`<${tagName}(?=[\\s/>])`, 'g');

    for (const match of source.matchAll(openPattern)) {
        const start = match.index;
        if (start === undefined) continue;

        let i = start + match[0].length;
        let depth = 0;
        let quote: string | null = null;

        while (i < source.length) {
            const ch = source[i];
            if (quote !== null) {
                if (ch === '\\') {
                    i += 2;
                    continue;
                }
                if (ch === quote) quote = null;
            } else if (ch === '"' || ch === "'" || ch === '`') {
                quote = ch;
            } else if (ch === '{') {
                depth++;
            } else if (ch === '}') {
                depth = Math.max(0, depth - 1);
            } else if (ch === '>' && depth === 0) {
                i++;
                break;
            }
            i++;
        }

        tags.push(source.slice(start, i));
    }

    return tags;
}

/** What one JSX open tag's `weight` attribute resolved to. */
export interface TagWeightResult {
    /** Literal weight values found on this tag (normally zero or one). */
    readonly literalWeights: string[];
    /** How many unresolvable `weight={expression}` bindings this tag has. */
    readonly dynamicCount: number;
}

/**
 * Resolves the `weight` attribute of one already-extracted JSX open-tag
 * string, via the shared {@link findLiteralWeights}/{@link countDynamicWeights}
 * parsers.
 *
 * @param params.tagText - One tag's text, as returned by
 *   {@link findJsxOpenTags}.
 * @returns The literal weight(s) and/or dynamic-binding count found.
 */
export function resolveTagWeight({ tagText }: { readonly tagText: string }): TagWeightResult {
    return {
        literalWeights: findLiteralWeights({ source: tagText }).map((usage) => usage.weight),
        dynamicCount: countDynamicWeights({ source: tagText })
    };
}
