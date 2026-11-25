/**
 * @file chart-axis.ts
 * @description Linear value-axis ticks for the host analytics charts (HOS-2612).
 *
 * Recharts picks its own ticks, and with `allowDecimals={false}` over a small
 * integer range it ends up with uneven steps (0, 3, 6, 12). The charts count
 * whole things (views, inquiries), so the axis is built here instead: evenly
 * spaced integer ticks starting at 0 whose step is 1, 2 or 5 times a power of
 * ten.
 *
 * @module lib/chart-axis
 */

/** Evenly spaced axis ticks and the matching domain. */
export interface LinearAxis {
    /** Ticks from 0 up to the top of the domain, equally spaced. */
    readonly ticks: readonly number[];
    /** `[0, top]`, to hand to the chart's `domain`. */
    readonly domain: readonly [number, number];
}

/**
 * Builds a linear 0-based integer axis that covers `max`.
 *
 * @param input.max - Largest value the chart plots (negative or NaN count as 0).
 * @param input.targetTicks - Roughly how many intervals to aim for. @default 4
 * @returns The ticks and the domain.
 */
export function buildLinearAxis({
    max,
    targetTicks = 4
}: {
    readonly max: number;
    readonly targetTicks?: number;
}): LinearAxis {
    const safeMax = Number.isFinite(max) && max > 0 ? Math.ceil(max) : 0;
    const rawStep = Math.max(1, safeMax / targetTicks);
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const step =
        [1, 2, 5, 10]
            .map((factor) => factor * magnitude)
            .find((candidate) => candidate >= rawStep) ?? 10 * magnitude;
    const intervals = Math.max(1, Math.ceil(safeMax / step));
    const ticks = Array.from({ length: intervals + 1 }, (_, index) => index * step);
    return { ticks, domain: [0, intervals * step] };
}
