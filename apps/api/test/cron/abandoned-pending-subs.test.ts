/**
 * Unit tests for the abandoned-pending-subs cron job (SPEC-126 D6).
 *
 * Covers:
 * - Constants (TTL, lock key, status sets) so they don't drift from the
 *   `/start-paid` route's expiresAt and from sibling cron lock keys.
 * - Job definition shape (name, schedule, enabled, timeout).
 *
 * Handler-against-real-DB coverage is out of scope for unit tests — the
 * meaningful regression risks (wrong TTL, wrong terminal status, wrong
 * lock key) are guarded by the constant assertions below.
 *
 * @module test/cron/abandoned-pending-subs
 */

import { describe, expect, it } from 'vitest';
import {
    _internals,
    abandonedPendingSubsJob
} from '../../src/cron/jobs/abandoned-pending-subs.job';

describe('abandoned-pending-subs internals', () => {
    it('reserves advisory lock key 1006 (no overlap with sibling crons)', () => {
        // Sibling keys: 1003 dunning, 1004 trial-expiry, 1005 trial-pre-end-notif.
        // Drift would let two jobs share a lock and starve each other.
        expect(_internals.ADVISORY_LOCK_KEY).toBe(1006);
    });

    it('uses a 30-minute TTL matching the start-paid route expiresAt', () => {
        // The /start-paid response advertises a 30min expiresAt window;
        // this cron must use the same value or the front and the reaper
        // disagree about when a sub is abandoned.
        expect(_internals.PENDING_PROVIDER_TTL_MS).toBe(30 * 60 * 1000);
    });

    it('matches both qzpay-vocabulary and Hospeda-vocabulary pending statuses', () => {
        expect(_internals.PENDING_STATUSES).toContain('incomplete');
        expect(_internals.PENDING_STATUSES).toContain('pending_provider');
    });

    it('writes incomplete_expired (qzpay vocabulary) as the terminal status', () => {
        // The polling endpoint maps incomplete_expired -> Hospeda ABANDONED
        // at the response boundary, so we keep the qzpay vocabulary at
        // rest to stay consistent with rows written by qzpay-core.
        expect(_internals.ABANDONED_STATUS).toBe('incomplete_expired');
    });
});

describe('abandonedPendingSubsJob definition', () => {
    it('is registered with the expected name', () => {
        expect(abandonedPendingSubsJob.name).toBe('abandoned-pending-subs');
    });

    it('runs hourly at minute 0', () => {
        expect(abandonedPendingSubsJob.schedule).toBe('0 * * * *');
    });

    it('is enabled by default', () => {
        expect(abandonedPendingSubsJob.enabled).toBe(true);
    });

    it('uses a 2-minute timeout (single bulk UPDATE)', () => {
        expect(abandonedPendingSubsJob.timeoutMs).toBe(2 * 60 * 1000);
    });
});
