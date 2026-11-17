/**
 * @file refresh-subscription-card.ts
 * @description Defers a full-page reload so the server-rendered subscription card re-reads its real state.
 */

/** Options for {@link scheduleSubscriptionRefresh}. */
export interface ScheduleSubscriptionRefreshOptions {
    /** Milliseconds the success message stays visible before the reload. Defaults to 2500. */
    readonly delayMs?: number;
}

/**
 * Schedule one full-page reload after the action's success message has been
 * visible for `delayMs`.
 *
 * The subscription card is server-rendered and the page is session-blind-safe,
 * so reloading is the smallest refresh that leaves the page contract untouched.
 * RO-RO: receives an options object and returns nothing.
 *
 * @param options - Reload delay in milliseconds (defaults to 2500).
 */
export function scheduleSubscriptionRefresh({
    delayMs = 2500
}: ScheduleSubscriptionRefreshOptions): void {
    window.setTimeout(() => window.location.reload(), delayMs);
}
