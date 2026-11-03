/**
 * @file track-timers.ts
 * @description Test helper that records the timers a component schedules with
 * `window.setTimeout` and the ones it cancels with `window.clearTimeout`, so a
 * test can assert that nothing the component created is still pending once it
 * is unmounted (BETA-215).
 *
 * Call it inside a test, take a `baseline` with `mark()` BEFORE the action under
 * test, and count only timers created after it with `pendingSince`, so timers
 * scheduled by anything else (React, libraries, earlier steps) never count.
 * The spies are removed by `vi.restoreAllMocks()` in the caller's `afterEach`.
 */

import { vi } from 'vitest';

/** Handle returned by {@link trackTimers}. */
export interface TimerTracker {
    /** Returns a baseline: timers scheduled from now on are "new". */
    readonly mark: () => number;
    /** New (since `baseline`) timers with the given delay that were never cleared. */
    readonly pendingSince: (args: {
        readonly baseline: number;
        readonly delay: number;
    }) => readonly number[];
}

/**
 * Starts recording `window.setTimeout` / `window.clearTimeout` calls.
 *
 * @returns A {@link TimerTracker} bound to the spies installed by this call.
 */
export function trackTimers(): TimerTracker {
    const scheduled: { readonly id: number; readonly delay: number }[] = [];
    const cleared = new Set<number>();
    const realSet = window.setTimeout.bind(window);
    const realClear = window.clearTimeout.bind(window);
    vi.spyOn(window, 'setTimeout').mockImplementation(((
        handler: TimerHandler,
        delay?: number,
        ...args: unknown[]
    ) => {
        const id = realSet(handler, delay, ...args);
        scheduled.push({ id, delay: delay ?? 0 });
        return id;
    }) as typeof window.setTimeout);
    vi.spyOn(window, 'clearTimeout').mockImplementation(((id?: number) => {
        if (id !== undefined) cleared.add(id);
        realClear(id);
    }) as typeof window.clearTimeout);
    return {
        mark: () => scheduled.length,
        pendingSince: ({ baseline, delay }) =>
            scheduled
                .slice(baseline)
                .filter((timer) => timer.delay === delay && !cleared.has(timer.id))
                .map((timer) => timer.id)
    };
}
