/**
 * @file reveal-stagger.ts
 * @description Stagger-delay helper for [data-reveal] elements in grids.
 *
 * Provides a single source of truth for stagger timing across sections so
 * grids never accumulate delays past a tasteful cap (the last card should
 * land shortly after the first, not 1.5s later).
 *
 * Emits `data-stagger-index` + `data-stagger-step` attributes consumed by
 * the CSS map in `apps/web/src/styles/css-var-themes.css`. Replaces the
 * previous `style="transition-delay: Xms"` inline pattern (SPEC-046
 * GAP-046-09a — inline style= triggers `style-src-attr` CSP violations).
 */

interface RevealStaggerInput {
    /** Position of the element in the staggered sequence (0-based). */
    readonly index: number;
    /**
     * Step size in milliseconds. Must match one of the values supported by
     * the CSS map (60 / 80 / 100). Defaults to 60 — the gentle cadence used
     * by tag/category lists.
     */
    readonly step?: 60 | 80 | 100;
    /**
     * Maximum effective index. Anything beyond is clamped so the tail of a
     * long grid lands at a fixed delay instead of accumulating. Defaults to
     * 6 (matches the CSS map's 0..6 coverage).
     */
    readonly max?: number;
}

/**
 * Data attribute pair returned by `revealStagger()`. Spread directly into
 * an Astro element to apply the stagger.
 */
export interface RevealStaggerAttrs {
    readonly 'data-stagger-index': number;
    readonly 'data-stagger-step': '60' | '80' | '100';
}

/**
 * Compute the stagger data-attrs for a `[data-reveal]` grid element.
 *
 * @param input - index + optional step (60/80/100) and max cap.
 * @returns Spreadable `data-stagger-index` / `data-stagger-step` attrs.
 *
 * @example
 * ```astro
 * <div data-reveal="up" {...revealStagger({ index: i })}>
 * ```
 */
export function revealStagger({
    index,
    step = 60,
    max = 6
}: RevealStaggerInput): RevealStaggerAttrs {
    const clamped = Math.min(Math.max(index, 0), max);
    return {
        'data-stagger-index': clamped,
        'data-stagger-step': String(step) as '60' | '80' | '100'
    };
}
