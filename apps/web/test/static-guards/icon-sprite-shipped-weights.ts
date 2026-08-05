/**
 * @file icon-sprite-shipped-weights.ts
 * @description Pure detector behind the `thin`/`light` guard (HOS-369 W3-6).
 *
 * Split from the test so the matcher can be exercised on synthetic strings —
 * that is what makes it possible to prove the guard is not vacuous without
 * temporarily breaking `src/`.
 *
 * @module test/static-guards/icon-sprite-shipped-weights
 */

/**
 * Every literal form in which a `weight` can be handed to an icon in this app:
 * a JSX/Astro attribute (`weight="thin"`), an expression container
 * (`weight={'thin'}`), or an object property (`weight: 'thin'`).
 *
 * The capture group is the weight name, so the caller can report WHICH weight
 * it found rather than only that something matched.
 */
const WEIGHT_LITERAL_PATTERN =
    /weight\s*(?:=\s*\{?\s*|:\s*)['"]([a-z]+)['"]|weight\s*=\s*["']([a-z]+)["']/g;

/**
 * One `weight="…"` occurrence found in a file.
 */
export interface WeightUsage {
    /** The weight name, e.g. `thin`. */
    readonly weight: string;
    /** 1-based line the occurrence starts on. */
    readonly line: number;
}

/**
 * Finds every literal `weight` assignment in a source file.
 *
 * @param params.source - File contents.
 * @returns Every literal weight it names, with line numbers.
 */
export function findLiteralWeights({ source }: { readonly source: string }): WeightUsage[] {
    const found: WeightUsage[] = [];

    for (const match of source.matchAll(WEIGHT_LITERAL_PATTERN)) {
        const weight = match[1] ?? match[2];
        if (weight === undefined) continue;
        found.push({
            weight,
            line: source.slice(0, match.index).split('\n').length
        });
    }

    return found;
}

/**
 * Counts the `weight={expression}` call sites a static scan CANNOT resolve.
 *
 * Exported so the guard can state its own blind spot in numbers instead of
 * claiming a coverage it does not have.
 *
 * @param params.source - File contents.
 * @returns How many dynamic `weight={…}` bindings the file contains.
 */
export function countDynamicWeights({ source }: { readonly source: string }): number {
    return [...source.matchAll(/weight\s*=\s*\{(?!\s*['"])/g)].length;
}
