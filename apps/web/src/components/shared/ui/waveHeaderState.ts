/**
 * @file waveHeaderState.ts
 * @description Pure, framework-free scroll state machine for the shared wave
 * header component (HOS-84). Computes the header's visual state
 * (`expanded` | `compact` | `hidden`) from the current scroll position and
 * scroll delta, with NO DOM access — the caller (an Astro inline `<script>`)
 * owns `window.scrollY` reads and class toggling; this module only owns the
 * decision logic, so it can be unit tested without a browser.
 *
 * Two independent axes drive the decision, evaluated in strict priority order:
 *
 * 1. **Overrides** (`lockedCompact`, `reducedMotion`) — highest priority.
 * 2. **Position axis** — `scrollY` vs `EXPAND_AT` / `COMPACT_AT`, with a
 *    hysteresis band between the two thresholds where the current state is
 *    held rather than re-derived from scratch. This is what stops the header
 *    from oscillating expanded/compact right at a single crossing line.
 * 3. **Direction axis** — accumulated same-direction scroll delta vs
 *    `HIDE_DELTA` / `REVEAL_DELTA`, only evaluated once the position axis has
 *    settled on `compact` or `hidden` (never while `expanded`).
 *
 * The direction axis's accumulator resets to the new delta whenever the
 * scroll direction flips, instead of continuing to sum signed deltas. This is
 * the anti-jitter "dead zone" fix for HOS-84 AC-3: without it, a user
 * oscillating near a threshold (e.g. a trackpad micro-bounce) can cross a
 * hide/reveal threshold via the NET of two opposite movements even though
 * neither movement alone was a sustained scroll in one direction.
 */

/**
 * Visual state of the wave header.
 *
 * - `expanded` — full header with breadcrumbs, shown near the top of the page.
 * - `compact` — condensed header, shown once scrolled comfortably past the top.
 * - `hidden` — header slides fully off-screen while scrolling down; reappears
 *   as `compact` (never straight back to `expanded`) on a sustained scroll up.
 */
export type WaveHeaderState = 'expanded' | 'compact' | 'hidden';

/**
 * Tunable thresholds for the wave header state machine. All values are
 * expressed in CSS pixels and MUST be non-negative; `COMPACT_AT` must be
 * greater than `EXPAND_AT` to leave a hysteresis band, and `HIDE_DELTA` /
 * `REVEAL_DELTA` should be large enough to absorb incidental scroll jitter.
 */
export interface WaveHeaderStateConfig {
    /** At or below this `scrollY`, the header is always `expanded`. */
    readonly EXPAND_AT: number;
    /** At or above this `scrollY`, an `expanded` header becomes `compact`. */
    readonly COMPACT_AT: number;
    /** Accumulated downward delta required for `compact` → `hidden`. */
    readonly HIDE_DELTA: number;
    /** Accumulated upward delta (magnitude) required for `hidden` → `compact`. */
    readonly REVEAL_DELTA: number;
}

/**
 * Default thresholds for the wave header state machine, matching the values
 * previously hardcoded in `WaveHeader.astro`'s inline script (HOS-84).
 */
export const DEFAULT_WAVE_HEADER_CONFIG: WaveHeaderStateConfig = {
    EXPAND_AT: 8,
    COMPACT_AT: 96,
    HIDE_DELTA: 24,
    REVEAL_DELTA: 24
};

/**
 * Input for a single evaluation step of {@link nextWaveHeaderState}.
 *
 * Callers are expected to keep `accumulator` and `currentState` from the
 * previous call's {@link NextWaveHeaderStateResult} and feed them back in on
 * the next scroll/resize tick, alongside a freshly read `scrollY` and the
 * `delta` since the previous read.
 */
export interface NextWaveHeaderStateInput {
    /** Current `window.scrollY`. Must be `>= 0`. */
    readonly scrollY: number;
    /** Signed difference between this and the previous `scrollY` read (positive = scrolling down). */
    readonly delta: number;
    /** Running same-direction delta accumulator carried over from the previous evaluation. */
    readonly accumulator: number;
    /** The header's state as of the previous evaluation. */
    readonly currentState: WaveHeaderState;
    /** Thresholds driving the state machine. */
    readonly config: WaveHeaderStateConfig;
    /**
     * When `true`, pins the header to `compact` unconditionally (used by the
     * mobile fullscreen map view). Takes priority over every other input.
     */
    readonly lockedCompact: boolean;
    /**
     * When `true`, suppresses the `hidden` state (`prefers-reduced-motion`).
     * Any transition that would otherwise produce `hidden` collapses to
     * `compact` instead; `expanded` and the hysteresis band are unaffected.
     */
    readonly reducedMotion: boolean;
}

/**
 * Result of a single {@link nextWaveHeaderState} evaluation.
 */
export interface NextWaveHeaderStateResult {
    /** The header's state after this evaluation. */
    readonly state: WaveHeaderState;
    /** Updated accumulator to pass back in as `accumulator` on the next call. */
    readonly accumulator: number;
}

/**
 * Updates the direction-axis accumulator for a single scroll delta.
 *
 * Same-direction deltas (or the very first delta, when the accumulator is
 * still `0`) are summed. A delta whose sign differs from the current
 * accumulator's sign resets the accumulator to that delta instead of summing
 * — this is the anti-jitter dead-zone guard (HOS-84 AC-3): a direction
 * reversal always starts counting fresh in the new direction rather than
 * carrying over any of the previous direction's progress.
 *
 * @param accumulator - Running same-direction delta accumulator.
 * @param delta - Signed scroll delta for this tick.
 * @returns The updated accumulator.
 */
function updateAccumulator(accumulator: number, delta: number): number {
    if (delta === 0) {
        return accumulator;
    }

    const sameDirection = accumulator === 0 || Math.sign(accumulator) === Math.sign(delta);
    return sameDirection ? accumulator + delta : delta;
}

/**
 * Computes the next wave header state from the current scroll position,
 * scroll delta, and previous state. Pure function — no DOM access, no
 * side effects, safe to unit test in isolation from any browser or
 * framework runtime.
 *
 * @param input - Current scroll reading, previous state, and configuration.
 * @returns The next state plus the updated accumulator to feed back on the
 * following call.
 *
 * @example
 * ```ts
 * let state: WaveHeaderState = 'expanded';
 * let accumulator = 0;
 *
 * const result = nextWaveHeaderState({
 *   scrollY: 120,
 *   delta: 40,
 *   accumulator,
 *   currentState: state,
 *   config: DEFAULT_WAVE_HEADER_CONFIG,
 *   lockedCompact: false,
 *   reducedMotion: false,
 * });
 * state = result.state;         // 'compact'
 * accumulator = result.accumulator;
 * ```
 */
export function nextWaveHeaderState(input: NextWaveHeaderStateInput): NextWaveHeaderStateResult {
    const { scrollY, delta, accumulator, currentState, config, lockedCompact, reducedMotion } =
        input;

    if (lockedCompact) {
        return { state: 'compact', accumulator: 0 };
    }

    if (scrollY <= config.EXPAND_AT) {
        return { state: 'expanded', accumulator: 0 };
    }

    // Position axis: hysteresis hold. An `expanded` header only becomes
    // `compact` once scrollY clears COMPACT_AT; any other current state is
    // held as-is (subject to the direction axis below).
    const baselineState: WaveHeaderState =
        currentState === 'expanded'
            ? scrollY >= config.COMPACT_AT
                ? 'compact'
                : 'expanded'
            : currentState;

    if (baselineState === 'expanded') {
        // Still inside the hysteresis band below COMPACT_AT — no direction axis
        // applies while expanded.
        return { state: 'expanded', accumulator: 0 };
    }

    const nextAccumulator = updateAccumulator(accumulator, delta);

    let resultState: WaveHeaderState = baselineState;

    if (
        baselineState === 'compact' &&
        nextAccumulator >= config.HIDE_DELTA &&
        scrollY >= config.COMPACT_AT
    ) {
        resultState = 'hidden';
    } else if (baselineState === 'hidden' && nextAccumulator <= -config.REVEAL_DELTA) {
        resultState = 'compact';
    }

    if (reducedMotion && resultState === 'hidden') {
        resultState = 'compact';
    }

    return { state: resultState, accumulator: nextAccumulator };
}
