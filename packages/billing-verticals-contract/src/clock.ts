/**
 * The clock interface (contract §5, item 5; AC:B1:17).
 *
 * The production code of BOTH halves (billing and verticals) reads the time
 * only through this interface, never from the system directly. It lives here
 * because this is the one package both halves already import; importing it is
 * never crossing (GUARD:G14 does not change).
 *
 * No implementation lives in this package:
 * - the real one (the system time) is injected by the composition root of
 *   `apps/api`;
 * - the adjustable one, for tests, lives in `@repo/test-clock`, which no
 *   production build imports.
 */
export interface Clock {
    /**
     * The current instant, as this clock sees it.
     *
     * @returns A fresh `Date`; mutating it never moves the clock
     */
    now(): Date;
}
