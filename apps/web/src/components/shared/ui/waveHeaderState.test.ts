/**
 * @file waveHeaderState.test.ts
 * @description Tests for the pure wave header scroll state machine (HOS-84
 * T-003). Covers the position axis (expanded/compact hysteresis), the
 * direction axis (compact/hidden accumulator thresholds), the anti-jitter
 * dead-zone reset on direction flip (AC-3), and the two overrides
 * (`lockedCompact`, `reducedMotion`).
 */

import { describe, expect, it } from 'vitest';
import type { WaveHeaderStateConfig } from './waveHeaderState';
import {
    coalesceScrollSource,
    computeScrollDelta,
    DEFAULT_WAVE_HEADER_CONFIG,
    nextWaveHeaderState
} from './waveHeaderState';

const config: WaveHeaderStateConfig = DEFAULT_WAVE_HEADER_CONFIG;

describe('nextWaveHeaderState', () => {
    describe('position axis — expanded', () => {
        it('returns expanded when scrollY is at or below EXPAND_AT', () => {
            for (const scrollY of [0, config.EXPAND_AT]) {
                const result = nextWaveHeaderState({
                    scrollY,
                    delta: 0,
                    accumulator: 0,
                    currentState: 'compact',
                    config,
                    lockedCompact: false,
                    reducedMotion: false
                });
                expect(result.state).toBe('expanded');
                expect(result.accumulator).toBe(0);
            }
        });

        it('resets the accumulator to 0 when returning to expanded', () => {
            const result = nextWaveHeaderState({
                scrollY: 0,
                delta: -50,
                accumulator: 40,
                currentState: 'hidden',
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            expect(result.state).toBe('expanded');
            expect(result.accumulator).toBe(0);
        });
    });

    describe('position axis — hysteresis band', () => {
        it('holds expanded while scrollY is between EXPAND_AT and COMPACT_AT', () => {
            const result = nextWaveHeaderState({
                scrollY: 50,
                delta: 10,
                accumulator: 0,
                currentState: 'expanded',
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            expect(result.state).toBe('expanded');
            expect(result.accumulator).toBe(0);
        });

        it('transitions expanded to compact once scrollY reaches COMPACT_AT', () => {
            const result = nextWaveHeaderState({
                scrollY: config.COMPACT_AT,
                delta: 20,
                accumulator: 0,
                currentState: 'expanded',
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            expect(result.state).toBe('compact');
        });

        it('holds compact when scrollY dips back below COMPACT_AT without reaching EXPAND_AT', () => {
            const result = nextWaveHeaderState({
                scrollY: 50,
                delta: -10,
                accumulator: 0,
                currentState: 'compact',
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            expect(result.state).toBe('compact');
        });
    });

    describe('direction axis — compact to hidden', () => {
        it('stays compact while accumulated downward delta is below HIDE_DELTA', () => {
            const first = nextWaveHeaderState({
                scrollY: 200,
                delta: 10,
                accumulator: 0,
                currentState: 'compact',
                config,
                lockedCompact: false,
                reducedMotion: false
            });
            expect(first.state).toBe('compact');
            expect(first.accumulator).toBe(10);

            const second = nextWaveHeaderState({
                scrollY: 210,
                delta: 10,
                accumulator: first.accumulator,
                currentState: first.state,
                config,
                lockedCompact: false,
                reducedMotion: false
            });
            expect(second.state).toBe('compact');
            expect(second.accumulator).toBe(20);
        });

        it('transitions to hidden once accumulated downward delta reaches HIDE_DELTA', () => {
            const delta = 10;
            const result = nextWaveHeaderState({
                scrollY: config.COMPACT_AT + config.HIDE_DELTA,
                delta,
                accumulator: config.HIDE_DELTA - delta,
                currentState: 'compact',
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            expect(result.state).toBe('hidden');
            expect(result.accumulator).toBe(config.HIDE_DELTA);
        });

        it('never hides while scrollY has not comfortably cleared COMPACT_AT', () => {
            const result = nextWaveHeaderState({
                scrollY: config.COMPACT_AT - 1,
                delta: 30,
                accumulator: 0,
                currentState: 'compact',
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            expect(result.state).toBe('compact');
        });
    });

    describe('direction axis — hidden to compact (reveal)', () => {
        it('stays hidden while accumulated upward delta has not reached -REVEAL_DELTA', () => {
            const result = nextWaveHeaderState({
                scrollY: 200,
                delta: -10,
                accumulator: 0,
                currentState: 'hidden',
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            expect(result.state).toBe('hidden');
            expect(result.accumulator).toBe(-10);
        });

        it('transitions to compact once accumulated upward delta reaches -REVEAL_DELTA', () => {
            const result = nextWaveHeaderState({
                scrollY: 180,
                delta: -10,
                accumulator: -15,
                currentState: 'hidden',
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            expect(result.state).toBe('compact');
            expect(result.accumulator).toBe(-25);
        });

        it('never goes straight from hidden to expanded via the direction axis', () => {
            const result = nextWaveHeaderState({
                scrollY: 180,
                delta: -100,
                accumulator: -30,
                currentState: 'hidden',
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            // Large upward delta clears REVEAL_DELTA, but scrollY is still well
            // above EXPAND_AT, so the result must be compact, never expanded.
            expect(result.state).toBe('compact');
        });

        it('goes from hidden to expanded only via the position axis reaching EXPAND_AT', () => {
            const result = nextWaveHeaderState({
                scrollY: config.EXPAND_AT,
                delta: -100,
                accumulator: -30,
                currentState: 'hidden',
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            expect(result.state).toBe('expanded');
        });
    });

    describe('anti-jitter dead zone (HOS-84 AC-3) — accumulator resets on direction flip', () => {
        it('resets the accumulator instead of summing across a direction reversal', () => {
            // Step 1: scroll down, accumulate 15 (below HIDE_DELTA=24).
            const step1 = nextWaveHeaderState({
                scrollY: 200,
                delta: 15,
                accumulator: 0,
                currentState: 'compact',
                config,
                lockedCompact: false,
                reducedMotion: false
            });
            expect(step1.state).toBe('compact');
            expect(step1.accumulator).toBe(15);

            // Step 2: tiny scroll up — direction flips. Accumulator resets to -2
            // (NOT 15 - 2 = 13).
            const step2 = nextWaveHeaderState({
                scrollY: 198,
                delta: -2,
                accumulator: step1.accumulator,
                currentState: step1.state,
                config,
                lockedCompact: false,
                reducedMotion: false
            });
            expect(step2.state).toBe('compact');
            expect(step2.accumulator).toBe(-2);

            // Step 3: scroll down again — direction flips back. Accumulator
            // resets to 15 (NOT the naive running sum 15 - 2 + 15 = 28, which
            // would have crossed HIDE_DELTA=24 and incorrectly hidden the header).
            const step3 = nextWaveHeaderState({
                scrollY: 213,
                delta: 15,
                accumulator: step2.accumulator,
                currentState: step2.state,
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            expect(step3.accumulator).toBe(15);
            expect(step3.state).toBe('compact');
        });

        it('sums same-direction deltas without resetting', () => {
            // Two same-direction deltas that together clear HIDE_DELTA; the point
            // is that they SUM (accumulator reaches HIDE_DELTA) rather than reset.
            const d1 = Math.ceil(config.HIDE_DELTA / 2);
            const d2 = config.HIDE_DELTA - d1; // d1 + d2 === HIDE_DELTA
            const baseY = config.COMPACT_AT + config.HIDE_DELTA;

            const step1 = nextWaveHeaderState({
                scrollY: baseY,
                delta: d1,
                accumulator: 0,
                currentState: 'compact',
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            const step2 = nextWaveHeaderState({
                scrollY: baseY + d2,
                delta: d2,
                accumulator: step1.accumulator,
                currentState: step1.state,
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            expect(step2.accumulator).toBe(config.HIDE_DELTA);
            expect(step2.state).toBe('hidden');
        });
    });

    describe('lockedCompact override', () => {
        it('always returns compact regardless of scrollY, delta, or currentState', () => {
            const result = nextWaveHeaderState({
                scrollY: 0,
                delta: -500,
                accumulator: 99,
                currentState: 'hidden',
                config,
                lockedCompact: true,
                reducedMotion: false
            });

            expect(result.state).toBe('compact');
            expect(result.accumulator).toBe(0);
        });

        it('takes priority over reducedMotion and the position axis', () => {
            const result = nextWaveHeaderState({
                scrollY: 500,
                delta: 500,
                accumulator: 0,
                currentState: 'expanded',
                config,
                lockedCompact: true,
                reducedMotion: true
            });

            expect(result.state).toBe('compact');
        });
    });

    describe('reducedMotion override', () => {
        it('suppresses hidden and collapses the result to compact', () => {
            const result = nextWaveHeaderState({
                scrollY: 220,
                delta: 10,
                accumulator: 20,
                currentState: 'compact',
                config,
                lockedCompact: false,
                reducedMotion: true
            });

            expect(result.state).toBe('compact');
        });

        it('still allows expanded and the hysteresis band to work normally', () => {
            const expanded = nextWaveHeaderState({
                scrollY: 0,
                delta: -10,
                accumulator: 0,
                currentState: 'compact',
                config,
                lockedCompact: false,
                reducedMotion: true
            });
            expect(expanded.state).toBe('expanded');

            const held = nextWaveHeaderState({
                scrollY: 50,
                delta: 10,
                accumulator: 0,
                currentState: 'expanded',
                config,
                lockedCompact: false,
                reducedMotion: true
            });
            expect(held.state).toBe('expanded');
        });
    });

    describe('delta === 0 no-op', () => {
        it('leaves the accumulator unchanged and does not alter the state', () => {
            const result = nextWaveHeaderState({
                scrollY: 200,
                delta: 0,
                accumulator: 10,
                currentState: 'compact',
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            expect(result.state).toBe('compact');
            expect(result.accumulator).toBe(10);
        });

        it('does not reset an existing accumulator to 0', () => {
            const result = nextWaveHeaderState({
                scrollY: 200,
                delta: 0,
                accumulator: -10,
                currentState: 'hidden',
                config,
                lockedCompact: false,
                reducedMotion: false
            });

            expect(result.state).toBe('hidden');
            expect(result.accumulator).toBe(-10);
        });
    });
});

describe('computeScrollDelta', () => {
    // Regression test for H-47 (smoke agosto 2026): the wave-header's `resize`
    // listener fed a `scrollY - prevScrollY` delta into the SAME direction-axis
    // accumulator as genuine scroll events. On desktop `resize` almost never
    // fires mid-scroll, so this was invisible; on a real mobile device the URL
    // bar shows/hides on every scroll tick, firing `resize` dozens of times
    // during one continuous downward scroll. If a resize-driven read of
    // `window.scrollY` is even slightly out of step with the true scroll
    // position (a documented mobile dynamic-toolbar quirk), that noise flows
    // straight into the accumulator and can reset the compact→hidden countdown
    // or bounce the state back toward `expanded` mid-gesture — the header
    // then never finishes a transition before being interrupted again.
    // `computeScrollDelta` is the fix: a `resize` source NEVER contributes to
    // the direction axis, only `scroll` does.
    it('returns 0 for a resize source, regardless of the scrollY change', () => {
        expect(computeScrollDelta({ source: 'resize', scrollY: 340, prevScrollY: 40 })).toBe(0);
        expect(computeScrollDelta({ source: 'resize', scrollY: 0, prevScrollY: 500 })).toBe(0);
    });

    it('returns the signed scrollY difference for a scroll source', () => {
        expect(computeScrollDelta({ source: 'scroll', scrollY: 140, prevScrollY: 100 })).toBe(40);
        expect(computeScrollDelta({ source: 'scroll', scrollY: 60, prevScrollY: 100 })).toBe(-40);
        expect(computeScrollDelta({ source: 'scroll', scrollY: 100, prevScrollY: 100 })).toBe(0);
    });
});

describe('coalesceScrollSource', () => {
    // Second half of the H-47 fix. The caller coalesces every event in one
    // animation frame into a single evaluation (an rAF `ticking` latch), so a
    // frame is claimed by whichever event fires FIRST. Forcing resize deltas to
    // 0 (above) stops resize from CORRUPTING the direction axis, but on its own
    // it lets resize STARVE it: on mobile, where the URL bar fires `resize` on
    // nearly every scroll tick, a resize that wins the race to claim the frame
    // would discard the genuine scroll following it in the same frame, evaluate
    // with delta 0, and leave the accumulator stuck — the header would never
    // reach `hidden`, which is the very symptom H-47 reports. Both failure
    // modes produce the same broken header, so the fix is only complete if a
    // scroll anywhere in the frame wins the frame.
    it('upgrades a pending resize frame to scroll when a real scroll lands in it', () => {
        expect(coalesceScrollSource({ pending: 'resize', incoming: 'scroll' })).toBe('scroll');
    });

    it('never downgrades a pending scroll frame back to resize', () => {
        expect(coalesceScrollSource({ pending: 'scroll', incoming: 'resize' })).toBe('scroll');
    });

    it('keeps the source unchanged when both events agree', () => {
        expect(coalesceScrollSource({ pending: 'scroll', incoming: 'scroll' })).toBe('scroll');
        expect(coalesceScrollSource({ pending: 'resize', incoming: 'resize' })).toBe('resize');
    });
});
