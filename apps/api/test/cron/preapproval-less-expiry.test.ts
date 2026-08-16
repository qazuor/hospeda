/**
 * Unit tests for the preapproval-less subscription expiry rule (H-21).
 *
 * A subscription with no `mp_subscription_id` is invisible to every existing
 * reconciler — `subscription-poll` queries `/preapproval/{id}` and dunning acts
 * on charge failures reported against it — so an elapsed `current_period_end`
 * moved nothing and the row stayed `active` forever.
 *
 * These tests pin the SELECTION RULE rather than the SQL, because the rule is
 * what must not widen. Three of the exclusions below are the repo's three
 * distinct grace mechanisms (see docs/billing/grace-period-source-of-truth.md)
 * plus the complimentary status, and reaping any of them would be a worse bug
 * than the one this job fixes.
 *
 * @module test/cron/preapproval-less-expiry
 */

import { describe, expect, it } from 'vitest';
import {
    isOrphanedElapsedSubscription,
    type ReapableSubscriptionRow
} from '../../src/cron/jobs/preapproval-less-expiry.job';

/** Reference instant for every case. */
const NOW = new Date('2026-08-15T12:00:00Z');

/** The grace window the job runs with. */
const GRACE_HOURS = 6;

/** Builds a row that IS reapable, so each test can spoil exactly one thing. */
function buildRow(overrides: Partial<ReapableSubscriptionRow> = {}): ReapableSubscriptionRow {
    return {
        id: 'sub-1',
        customerId: 'cus-1',
        status: 'active',
        mpSubscriptionId: null,
        currentPeriodEnd: new Date('2026-08-07T00:00:00Z'),
        cancelAtPeriodEnd: false,
        ...overrides
    };
}

/** Applies the rule with the fixed reference instant and grace window. */
function reapable(row: ReapableSubscriptionRow): boolean {
    return isOrphanedElapsedSubscription({ row, now: NOW, graceHours: GRACE_HOURS });
}

describe('isOrphanedElapsedSubscription — the population this job reaps', () => {
    it('reaps an active subscription with no preapproval whose period elapsed', () => {
        // Arrange — the exact shape of the 3 stuck commerce rows in production
        // Act & Assert
        expect(reapable(buildRow())).toBe(true);
    });

    it('reaps a trialing subscription in the same condition', () => {
        // Arrange & Act & Assert
        expect(reapable(buildRow({ status: 'trialing' }))).toBe(true);
    });
});

describe('isOrphanedElapsedSubscription — exclusions that must never be reaped', () => {
    it('leaves a subscription that HAS a preapproval to the normal reconcilers', () => {
        // Arrange — poll and dunning own this row; acting on it would double up
        // Act & Assert
        expect(reapable(buildRow({ mpSubscriptionId: 'preapproval-abc' }))).toBe(false);
    });

    it('treats an empty-string preapproval id as present, not as missing', () => {
        // Arrange — a blank id is a data problem, not a licence to expire
        // Act & Assert
        expect(reapable(buildRow({ mpSubscriptionId: '' }))).toBe(false);
    });

    it('never reaps a complimentary subscription, which has no preapproval BY DESIGN', () => {
        // Arrange — a comp is a permanent grant created without a preapproval
        // (SPEC-262). It is the one population that looks exactly like the bug
        // and must be left alone.
        // Act & Assert
        expect(reapable(buildRow({ status: 'comp' }))).toBe(false);
    });

    it('never reaps a pending soft-cancel — that window belongs to finalize-cancelled-subs', () => {
        // Arrange — soft-cancel grace: access runs to currentPeriodEnd and the
        // finalize cron owns the flip. Two jobs acting on one row is the bug.
        // Act & Assert
        expect(reapable(buildRow({ cancelAtPeriodEnd: true }))).toBe(false);
    });

    it('never reaps a past_due subscription — that window belongs to dunning', () => {
        // Arrange & Act & Assert
        expect(reapable(buildRow({ status: 'past_due' }))).toBe(false);
    });

    it('leaves a subscription whose period has NOT elapsed', () => {
        // Arrange — the two accommodation rows in prod carry a period end a
        // century out; whatever that value means, it has not elapsed.
        // Act & Assert
        expect(reapable(buildRow({ currentPeriodEnd: new Date('2126-07-13T00:00:00Z') }))).toBe(
            false
        );
    });

    it('leaves a subscription with no period end at all', () => {
        // Arrange & Act & Assert
        expect(reapable(buildRow({ currentPeriodEnd: null }))).toBe(false);
    });
});

describe('isOrphanedElapsedSubscription — the grace window boundary', () => {
    it('does NOT reap a row still inside the grace window', () => {
        // Arrange — elapsed 1 hour ago, grace is 6
        const row = buildRow({ currentPeriodEnd: new Date(NOW.getTime() - 1 * 3600_000) });
        // Act & Assert
        expect(reapable(row)).toBe(false);
    });

    it('does NOT reap a row exactly AT the grace boundary', () => {
        // Arrange — elapsed exactly 6 hours ago. The comparison is strict, so
        // the boundary instant itself is still protected. Asserted explicitly
        // because an off-by-one here reaps a row a tick early.
        const row = buildRow({
            currentPeriodEnd: new Date(NOW.getTime() - GRACE_HOURS * 3600_000)
        });
        // Act & Assert
        expect(reapable(row)).toBe(false);
    });

    it('reaps a row one second past the grace boundary', () => {
        // Arrange
        const row = buildRow({
            currentPeriodEnd: new Date(NOW.getTime() - GRACE_HOURS * 3600_000 - 1000)
        });
        // Act & Assert
        expect(reapable(row)).toBe(true);
    });
});
