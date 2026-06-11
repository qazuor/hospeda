/**
 * T-010: Static guard — e2e helper subscription statuses are valid enum members.
 *
 * AC-1.4: The subscription statuses that Group A e2e helpers write directly into
 * the DB must be:
 *   (a) valid SubscriptionStatusEnum values (not fictional strings), and
 *   (b) consistent with what the production crons produce for the same lifecycle
 *       transition (so the helpers accurately simulate the post-cron state).
 *
 * This test has zero runtime dependencies (no DB, no servers, no network) —
 * it is a purely static/compile-time guard executed by Vitest.
 *
 * Production cron behaviour being asserted against:
 *   - trial-expiry cron + trial.service.ts `blockExpiredTrials`:
 *     expired trials are finalized via `billing.subscriptions.cancel()` which
 *     sets status → 'cancelled'.
 *   - finalize-cancelled-subs cron:
 *     soft-cancelled subs whose `current_period_end <= now()` are flipped to
 *     status 'cancelled'.
 *
 * @see apps/api/src/cron/jobs/trial-expiry.ts
 * @see apps/api/src/services/trial.service.ts (blockExpiredTrials)
 * @see apps/api/src/cron/jobs/finalize-cancelled-subs.ts
 * @see apps/e2e/tests/host/host-04-cancellation-grace.spec.ts
 * @see apps/e2e/tests/host/host-07b-subscription-required.spec.ts
 * @see apps/e2e/tests/host/host-03-trial-expired.spec.ts
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

describe('T-010: e2e helper subscription statuses guard (AC-1.4)', () => {
    /**
     * Status written by host-04-cancellation-grace and host-07b-subscription-required
     * helpers: a subscription whose period has ended and whose access must be blocked.
     * Both specs SET status = 'cancelled' directly in the DB to simulate post-cron state.
     */
    const HOST_04_07B_LAPSED_TERMINAL_STATUS = 'cancelled' as const;

    /**
     * Status written by host-03-trial-expired helper: the subscription is
     * `trialing` but `trial_end_date` has been pushed into the past by
     * `forceTrialExpired()`. This is the *pre-cron* window state that the
     * date-aware publish gate (isSubscriptionLive / checkEligibility) already
     * blocks — the cron hasn't run yet to flip it to 'cancelled'. It intentionally
     * stays 'trialing' to exercise the date-aware gate rather than the terminal
     * status gate.
     */
    const HOST_03_PRE_CRON_WINDOW_STATUS = 'trialing' as const;

    it("'cancelled' is a valid SubscriptionStatusEnum member", () => {
        // Arrange
        const validValues = Object.values(SubscriptionStatusEnum) as string[];

        // Act + Assert
        expect(validValues).toContain(HOST_04_07B_LAPSED_TERMINAL_STATUS);
    });

    it("'trialing' is a valid SubscriptionStatusEnum member", () => {
        // Arrange
        const validValues = Object.values(SubscriptionStatusEnum) as string[];

        // Act + Assert
        expect(validValues).toContain(HOST_03_PRE_CRON_WINDOW_STATUS);
    });

    it('lapsed-terminal status used by host-04/07b helpers equals the enum value crons produce', () => {
        // Arrange: the cron path is:
        //   trial-expiry → blockExpiredTrials → billing.subscriptions.cancel() → 'cancelled'
        //   finalize-cancelled-subs → sets status 'cancelled'
        // Both crons produce SubscriptionStatusEnum.CANCELLED.

        // Act + Assert: the string the helpers write must equal the enum member.
        // If someone renames the enum value, this guard will catch the drift.
        expect(HOST_04_07B_LAPSED_TERMINAL_STATUS).toBe(SubscriptionStatusEnum.CANCELLED);
    });

    it('host-03 intentionally uses pre-cron trialing window state, not the terminal status', () => {
        // Arrange: host-03 uses 'trialing' (not 'cancelled') because it exercises the
        // date-aware gate (isSubscriptionLive detects trial_end in the past) rather than
        // the terminal-status gate. The cron that would flip it to 'cancelled' has not
        // run yet in this scenario.

        // Act + Assert: trialing is NOT the terminal (cancelled) status.
        expect(HOST_03_PRE_CRON_WINDOW_STATUS).not.toBe(SubscriptionStatusEnum.CANCELLED);
        expect(HOST_03_PRE_CRON_WINDOW_STATUS).toBe(SubscriptionStatusEnum.TRIALING);
    });
});
