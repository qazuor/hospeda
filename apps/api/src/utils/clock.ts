/**
 * The clock of `apps/api` (AC:B1:17, contract §5 item 5).
 *
 * The production code of both halves (billing and verticals) reads the time
 * only through the `Clock` interface of `@repo/billing-verticals-contract`.
 * The composition root (`initApp` in `src/app.ts`) injects which one: the
 * system time in production, the adjustable clock of `@repo/test-clock` in
 * tests. This module holds the real implementation and the injected instance;
 * it never imports the test package.
 */
import type { Clock } from '@repo/billing-verticals-contract';

/** The real clock: the system time. Injected by the composition root in production. */
export const systemClock: Clock = Object.freeze({
    now: (): Date => new Date()
});

let injectedClock: Clock | undefined;

/**
 * Injects the clock the app reads. Called by the composition root only.
 *
 * @param input.clock - The clock to read from now on
 * @throws TypeError when `clock` has no `now` function
 */
export function injectClock(input: { readonly clock: Clock }): void {
    if (typeof input.clock?.now !== 'function') {
        throw new TypeError('injectClock: clock must be an object with now(): Date');
    }
    injectedClock = input.clock;
}

/**
 * The clock the composition root injected. Code that needs the time reads it
 * from here (or receives it from the root), never from the system directly.
 *
 * @returns The injected clock
 * @throws Error when no composition root injected one: failing loud beats a
 *   silent fallback to the system time, which an adjustable clock cannot move
 */
export function getClock(): { readonly clock: Clock } {
    if (injectedClock === undefined) {
        throw new Error('getClock: no clock injected; the composition root (initApp) injects it');
    }
    return { clock: injectedClock };
}
