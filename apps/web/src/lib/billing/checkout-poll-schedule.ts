/**
 * @file checkout-poll-schedule.ts
 * @description Retry schedule for the checkout success-page status poll (H-78).
 *
 * Extracted from `CheckoutStatusPoller` so the timing policy is a pure function
 * that can be asserted directly, instead of being inferred from fake timers.
 *
 * Why backoff rather than the previous flat 2s interval: the flat interval
 * spent its whole budget in the first 90 seconds and then gave up, which is the
 * opposite of how the confirmation actually arrives. MercadoPago's webhook
 * usually lands in the first few seconds — worth polling fast for — but when it
 * does not, the completion path is the server-side fallback (the polling cron
 * and the preapproval linker), which operates on a scale of minutes. Backoff
 * spends attempts where they pay off: dense at the start, then stretched, so
 * the page keeps watching roughly twice as long as before while making HALF the
 * requests.
 *
 * The stretched tail also matters for the second source the poller consults:
 * `GET /users/me/subscription` is served with a 60s server-side cache, so
 * hammering it every 2s cannot surface a change any sooner than the cache
 * allows.
 */

/** Delay after the first attempt, before any growth is applied. */
export const CHECKOUT_POLL_BASE_DELAY_MS = 2000;

/** Ceiling for a single inter-attempt delay. */
export const CHECKOUT_POLL_MAX_DELAY_MS = 10_000;

/** Per-attempt growth factor applied to the base delay. */
export const CHECKOUT_POLL_GROWTH_FACTOR = 1.4;

/**
 * Attempts before the poller stops and renders its terminal state.
 *
 * 22 attempts under the schedule below spans just over three minutes of
 * wall-clock — roughly double the previous 90s budget — in 22 requests rather
 * than 45.
 */
export const CHECKOUT_POLL_MAX_ATTEMPTS = 22;

/**
 * Parameters for {@link nextPollDelayMs}.
 */
export interface NextPollDelayParams {
    /** 1-based index of the attempt that just completed. */
    readonly attempt: number;
}

/**
 * Delay to wait after a completed attempt before making the next one.
 *
 * Grows geometrically from {@link CHECKOUT_POLL_BASE_DELAY_MS} and saturates at
 * {@link CHECKOUT_POLL_MAX_DELAY_MS}. Attempts below 1 are clamped to the base
 * delay so a caller bug can never produce a zero-delay busy loop against the
 * API.
 *
 * @param params - The attempt that just completed (1-based).
 * @returns The delay in milliseconds before the next attempt.
 *
 * @example
 * ```ts
 * nextPollDelayMs({ attempt: 1 }); // 2000
 * nextPollDelayMs({ attempt: 6 }); // 10000 (saturated)
 * ```
 */
export function nextPollDelayMs({ attempt }: NextPollDelayParams): number {
    if (attempt < 1) {
        return CHECKOUT_POLL_BASE_DELAY_MS;
    }

    const grown = CHECKOUT_POLL_BASE_DELAY_MS * CHECKOUT_POLL_GROWTH_FACTOR ** (attempt - 1);

    return Math.min(Math.round(grown), CHECKOUT_POLL_MAX_DELAY_MS);
}

/**
 * Total wall-clock the poller watches for before giving up.
 *
 * Derived from the schedule rather than hardcoded, so changing the growth
 * factor or the attempt cap cannot leave a stale number behind in a comment or
 * a test.
 *
 * @returns The summed inter-attempt delays across the full attempt budget, in
 * milliseconds.
 */
export function totalPollBudgetMs(): number {
    let total = 0;

    for (let attempt = 1; attempt < CHECKOUT_POLL_MAX_ATTEMPTS; attempt += 1) {
        total += nextPollDelayMs({ attempt });
    }

    return total;
}
