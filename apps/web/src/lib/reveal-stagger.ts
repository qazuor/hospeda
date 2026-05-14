/**
 * @file reveal-stagger.ts
 * @description Stagger-delay helper for [data-reveal] elements in grids.
 *
 * Provides a single source of truth for stagger timing across sections so
 * grids never accumulate delays past a tasteful cap (the last card should
 * land shortly after the first, not 1.5s later).
 */

interface RevealDelayInput {
    readonly index: number;
    readonly step?: number;
    readonly max?: number;
}

/**
 * Compute a capped stagger delay in milliseconds.
 *
 * Defaults: 60ms per step, 360ms cap. The cap matters more than the step:
 * with `--duration-reveal` at 450ms, the last visible element finishes at
 * most ~810ms after the first one starts.
 *
 * @example
 * ```astro
 * <div data-reveal="up" style={`transition-delay: ${revealDelay({ index: i })}ms`}>
 * ```
 */
export function revealDelay({ index, step = 60, max = 360 }: RevealDelayInput): number {
    if (index <= 0) return 0;
    return Math.min(index * step, max);
}
