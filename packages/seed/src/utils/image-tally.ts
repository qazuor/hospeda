import type { ImageProcessingCounters } from './seedContext.js';

/**
 * Log level at which the image tally should be reported.
 *
 * `warn` is reserved for a run that tolerated at least one image failure, so a
 * Cloudinary degradation stands out in a CI log instead of blending into the
 * hundreds of `info` lines a seed run emits (HOS-922).
 */
export type ImageTallyLevel = 'info' | 'warn';

/**
 * Input for {@link formatImageTally}.
 */
export interface FormatImageTallyInput {
    /** Counters accumulated across the run. */
    readonly counters: ImageProcessingCounters;
}

/**
 * Output of {@link formatImageTally}.
 */
export interface FormatImageTallyOutput {
    /** The line to log, verbatim. */
    readonly message: string;
    /** The level the line should be logged at. */
    readonly level: ImageTallyLevel;
}

/**
 * Renders the end-of-run image tally and picks the level it deserves.
 *
 * A run that tolerated image failures still succeeds — that is the whole point
 * of `--allow-required-fallback` — but silently succeeding is how a sustained
 * Cloudinary degradation goes unnoticed for weeks. Whenever `failures` is above
 * zero the line is marked `tolerated` and raised to `warn`.
 *
 * `skippedPlaceholder` (HOS-1144) is reported but never raises the level: a run
 * with the image pipeline deliberately switched off is a normal CI run, not a
 * degradation, and treating it as one would make the `warn` signal meaningless
 * precisely where it is read most.
 *
 * @param input - The counters to report. See {@link FormatImageTallyInput}.
 * @returns The message and the level to log it at.
 *
 * @example
 * ```typescript
 * const { message, level } = formatImageTally({ counters });
 * if (level === 'warn') {
 *     logger.warn(message);
 * } else {
 *     logger.info(message);
 * }
 * ```
 */
export function formatImageTally(input: FormatImageTallyInput): FormatImageTallyOutput {
    const { counters } = input;
    const { uploaded, cached, failures, skippedExample, skippedPlaceholder } = counters;

    const tally = `[seed:images] tally uploaded=${uploaded} cached=${cached} failures=${failures} skippedExample=${skippedExample} skippedPlaceholder=${skippedPlaceholder}`;

    if (failures > 0) {
        return {
            message: `${tally} — ${failures} image failure(s) tolerated, the entities kept their original URLs`,
            level: 'warn'
        };
    }

    return { message: tally, level: 'info' };
}
