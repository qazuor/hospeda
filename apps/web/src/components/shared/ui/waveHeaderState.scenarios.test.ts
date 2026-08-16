/**
 * @file waveHeaderState.scenarios.test.ts
 * @description End-to-end scenario tests for the wave header's scroll pipeline
 * (H-47, smoke agosto 2026).
 *
 * The unit tests in `waveHeaderState.test.ts` cover each pure function on its
 * own: {@link computeScrollDelta}, {@link coalesceScrollSource} and
 * {@link nextWaveHeaderState}. That is necessary but NOT sufficient — H-47 was
 * a defect in how the three COMPOSE with the caller's animation-frame latch,
 * and every one of those unit tests stayed green through both halves of it:
 *
 *  1. `resize` fed the direction accumulator (resize CORRUPTS the axis).
 *  2. `resize` claimed the frame and discarded the scroll behind it, so the
 *     frame evaluated with a `0` delta (resize STARVES the axis).
 *
 * Both produce the same user-visible symptom — a header that never collapses —
 * and neither is visible from a single-function assertion. These tests replay
 * realistic EVENT SEQUENCES through the same latch the component implements,
 * so the composition itself is under test.
 *
 * Why this matters on mobile specifically: a desktop browser essentially never
 * fires `resize` mid-scroll, while a real phone's dynamic URL bar shows/hides
 * on nearly every scroll tick. `RESIZE_PER_SCROLL` below encodes that.
 */

import { describe, expect, it } from 'vitest';
import {
    coalesceScrollSource,
    computeScrollDelta,
    DEFAULT_WAVE_HEADER_CONFIG,
    nextWaveHeaderState,
    type WaveHeaderScrollSource,
    type WaveHeaderState
} from './waveHeaderState';

/** One browser event arriving at the component's listeners. */
interface ScrollEvent {
    readonly source: WaveHeaderScrollSource;
    /** `window.scrollY` at the moment the event is handled. */
    readonly scrollY: number;
}

interface RunSequenceResult {
    readonly state: WaveHeaderState;
    readonly accumulator: number;
    /** Number of frames actually evaluated (events are coalesced per frame). */
    readonly framesEvaluated: number;
}

/**
 * Replays a list of events through the exact pipeline `WaveHeader.astro`
 * implements: events landing in the same animation frame are coalesced into a
 * single evaluation, whose source is resolved by `coalesceScrollSource`.
 *
 * @param params - The event list and how many events share one frame.
 * @param params.events - Events in arrival order.
 * @param params.eventsPerFrame - How many consecutive events the browser
 *   collapses into one rAF callback. `1` models a desktop-ish tick where every
 *   event gets its own frame.
 * @returns Final state, accumulator and the number of frames evaluated.
 */
function runSequence({
    events,
    eventsPerFrame
}: {
    readonly events: readonly ScrollEvent[];
    readonly eventsPerFrame: number;
}): RunSequenceResult {
    let state: WaveHeaderState = 'expanded';
    let accumulator = 0;
    let prevScrollY = 0;
    let framesEvaluated = 0;

    for (let i = 0; i < events.length; i += eventsPerFrame) {
        const frame = events.slice(i, i + eventsPerFrame);
        const first = frame[0];
        if (first === undefined) continue;

        // The latch: the first event claims the frame, later ones in the same
        // frame only get to upgrade its source.
        let source = first.source;
        for (const event of frame.slice(1)) {
            source = coalesceScrollSource({ pending: source, incoming: event.source });
        }

        // `evaluate` reads window.scrollY when the frame runs, i.e. the latest
        // value — the last event's position, not the claiming event's.
        const last = frame[frame.length - 1];
        const scrollY = last === undefined ? first.scrollY : last.scrollY;

        const delta = computeScrollDelta({ source, scrollY, prevScrollY });
        prevScrollY = scrollY;

        const result = nextWaveHeaderState({
            scrollY,
            delta,
            accumulator,
            currentState: state,
            config: DEFAULT_WAVE_HEADER_CONFIG,
            lockedCompact: false,
            reducedMotion: false
        });

        state = result.state;
        accumulator = result.accumulator;
        framesEvaluated += 1;
    }

    return { state, accumulator, framesEvaluated };
}

/** Builds a sustained downward scroll, `steps` ticks of `stepPx` each. */
function downwardScroll({
    steps,
    stepPx,
    from = 0
}: {
    readonly steps: number;
    readonly stepPx: number;
    readonly from?: number;
}): readonly ScrollEvent[] {
    return Array.from({ length: steps }, (_, i) => ({
        source: 'scroll' as const,
        scrollY: from + (i + 1) * stepPx
    }));
}

/**
 * Interleaves a `resize` BEFORE every scroll event, modelling a real phone
 * whose dynamic URL bar collapses/expands on nearly every scroll tick. The
 * resize reports the same scrollY as the scroll it precedes.
 */
function withMobileUrlBarNoise(events: readonly ScrollEvent[]): readonly ScrollEvent[] {
    return events.flatMap((event) => [
        { source: 'resize' as const, scrollY: event.scrollY },
        event
    ]);
}

describe('wave header scroll pipeline — end-to-end scenarios (H-47)', () => {
    it('collapses to hidden on a sustained downward scroll (desktop baseline)', () => {
        // 20 ticks x 40px = 800px, well past COMPACT_AT (64) and HIDE_DELTA (280).
        const result = runSequence({
            events: downwardScroll({ steps: 20, stepPx: 40 }),
            eventsPerFrame: 1
        });

        expect(result.state).toBe('hidden');
    });

    it('still collapses on mobile, where a resize precedes every scroll tick', () => {
        // THE H-47 SCENARIO. Same gesture as above, but each scroll is preceded
        // by a resize, and both land in the SAME frame — so the resize claims
        // the frame every single time. Before the fix this either poisoned the
        // accumulator (half 1) or starved it to a 0 delta (half 2); either way
        // the header never reached `hidden`, which is exactly what the owner
        // reported seeing on a real phone while desktop worked fine.
        const result = runSequence({
            events: withMobileUrlBarNoise(downwardScroll({ steps: 20, stepPx: 40 })),
            eventsPerFrame: 2
        });

        expect(result.state).toBe('hidden');
    });

    it('reaches the same state on mobile as on desktop for the same gesture', () => {
        // The invariant that actually matters: URL-bar noise is not user input,
        // so its presence must not change where the header ends up. Asserting
        // the two runs agree is stronger than asserting a hardcoded state,
        // because it stays meaningful if the thresholds are ever retuned.
        const gesture = downwardScroll({ steps: 20, stepPx: 40 });

        const desktop = runSequence({ events: gesture, eventsPerFrame: 1 });
        const mobile = runSequence({
            events: withMobileUrlBarNoise(gesture),
            eventsPerFrame: 2
        });

        expect(mobile.state).toBe(desktop.state);
        expect(mobile.accumulator).toBe(desktop.accumulator);
    });

    it('never moves the header on resize-only traffic, however much scrollY jumps', () => {
        // The mirror invariant. A phone rotating, or the URL bar collapsing
        // while the user's finger is still, must not collapse the header —
        // and the `scrollY` a resize reports can be wildly out of step with
        // the true position (the documented dynamic-toolbar quirk that made
        // H-47 possible in the first place).
        const noise: readonly ScrollEvent[] = [
            { source: 'resize', scrollY: 400 },
            { source: 'resize', scrollY: 60 },
            { source: 'resize', scrollY: 900 },
            { source: 'resize', scrollY: 120 },
            { source: 'resize', scrollY: 700 }
        ];

        const result = runSequence({ events: noise, eventsPerFrame: 1 });

        // The position axis still settles (scrollY 700 is past COMPACT_AT), but
        // the direction axis must not have advanced at all.
        expect(result.accumulator).toBe(0);
        expect(result.state).not.toBe('hidden');
    });

    it('reveals again on a sustained upward scroll, even under URL-bar noise', () => {
        // Down far enough to hide, then back up past REVEAL_DELTA (24).
        const down = downwardScroll({ steps: 20, stepPx: 40 });
        const up: readonly ScrollEvent[] = Array.from({ length: 6 }, (_, i) => ({
            source: 'scroll' as const,
            scrollY: 800 - (i + 1) * 40
        }));

        const result = runSequence({
            events: withMobileUrlBarNoise([...down, ...up]),
            eventsPerFrame: 2
        });

        // Reveals as `compact`, never straight back to `expanded` (HOS-84).
        expect(result.state).toBe('compact');
    });
});
