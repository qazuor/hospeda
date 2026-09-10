/**
 * Unit tests for the drift-reconcile SELECTION RULE and the provider-read
 * failure classifier (HOS-914).
 *
 * Two things are pinned here, and they are the two ways this job can do harm:
 *
 * 1. **The population.** Every exclusion below is a row some OTHER sweep owns,
 *    or a row that must never be compared against MercadoPago at all. Widening
 *    the rule means two crons acting on one subscription, which is the disease
 *    this reconciler was written not to spread.
 * 2. **The failure classification.** "MercadoPago says this is dead" and
 *    "MercadoPago has never heard of this" are different facts. Collapsing them
 *    is how a partner who paid in cash loses their service.
 *
 * @module test/cron/subscription-drift-reconcile
 */

import { describe, expect, it } from 'vitest';
import {
    classifyProviderReadFailure,
    DRIFT_TOLERANCE_MINUTES,
    type DriftCandidateRow,
    isDriftReconcileCandidate
} from '../../src/cron/jobs/subscription-drift-reconcile.job';

/** Reference instant for every case. */
const NOW = new Date('2026-09-09T12:00:00Z');

const MINUTE_MS = 60 * 1000;

/** A row that IS a candidate, so each test can spoil exactly one thing. */
function buildRow(overrides: Partial<DriftCandidateRow> = {}): DriftCandidateRow {
    return {
        id: 'sub-1',
        customerId: 'cus-1',
        status: 'active',
        mpSubscriptionId: 'preapproval-abc',
        trialEnd: null,
        cancelAtPeriodEnd: false,
        // Two hours stale: comfortably past the latency tolerance.
        updatedAt: new Date(NOW.getTime() - 120 * MINUTE_MS),
        ...overrides
    };
}

function candidate(row: DriftCandidateRow): boolean {
    return isDriftReconcileCandidate({
        row,
        now: NOW,
        toleranceMinutes: DRIFT_TOLERANCE_MINUTES
    });
}

describe('isDriftReconcileCandidate — the population this sweep re-reads', () => {
    it('selects an active subscription that has sat untouched', () => {
        // Arrange & Act & Assert
        expect(candidate(buildRow())).toBe(true);
    });

    it('selects a paused subscription — the exact shape measured in HOS-913', () => {
        // Arrange — paused locally while MercadoPago reported `authorized` for
        // over three hours, with subscription-poll running every minute and
        // never touching the row.
        // Act & Assert
        expect(candidate(buildRow({ status: 'paused' }))).toBe(true);
    });

    it('selects a past_due subscription', () => {
        // Arrange — dunning defers to MercadoPago's native recycling and never
        // re-reads the preapproval, so a lost cancellation webhook strands it.
        // Act & Assert
        expect(candidate(buildRow({ status: 'past_due' }))).toBe(true);
    });

    it('selects a trialing subscription whose trial has NOT elapsed', () => {
        // Arrange — a live trial is the half trial-reconcile never looks at.
        const row = buildRow({
            status: 'trialing',
            trialEnd: new Date(NOW.getTime() + 5 * 24 * 60 * MINUTE_MS)
        });
        // Act & Assert
        expect(candidate(row)).toBe(true);
    });
});

describe('isDriftReconcileCandidate — rows another sweep owns', () => {
    it('never selects a row with NO preapproval — that is preapproval-less-expiry, and a cash-paid partner', () => {
        // Arrange — HOS-1062 is building exactly this population: a partner
        // activated without MercadoPago. Asking the provider about it and
        // reading the failure as a verdict is the worst outcome of this issue.
        // Act & Assert
        expect(candidate(buildRow({ mpSubscriptionId: null }))).toBe(false);
    });

    it('treats a blank preapproval id as absent, not as a usable id', () => {
        // Arrange — a blank id would make the provider read fail, and a failed
        // read must never be able to reach a row that was never a candidate.
        // Act & Assert
        expect(candidate(buildRow({ mpSubscriptionId: '   ' }))).toBe(false);
    });

    it('never selects a comp subscription', () => {
        // Arrange — permanently complimentary, no preapproval by design.
        // Act & Assert
        expect(candidate(buildRow({ status: 'comp', mpSubscriptionId: null }))).toBe(false);
    });

    it('never selects a courtesy subscription even though it HAS a preapproval', () => {
        // Arrange — a courtesy is backed by a deliberately PAUSED preapproval.
        // Once the window elapses MercadoPago still reports `paused`, so this
        // sweep would flip the row to `paused` and cut a gifted subscriber's
        // entitlements hours before courtesy-expiry resumes it.
        // Act & Assert
        expect(candidate(buildRow({ status: 'courtesy' }))).toBe(false);
    });

    it('never selects a pending_provider row — subscription-poll and the reaper own it', () => {
        // Arrange & Act & Assert
        expect(candidate(buildRow({ status: 'pending_provider' }))).toBe(false);
    });

    it("never selects qzpay's `incomplete` spelling of the same state", () => {
        // Arrange — the same row written through the qzpay tier.
        // Act & Assert
        expect(candidate(buildRow({ status: 'incomplete' }))).toBe(false);
    });

    it('never selects a pending soft-cancel — finalize-cancelled-subs owns the whole grace', () => {
        // Arrange & Act & Assert
        expect(candidate(buildRow({ cancelAtPeriodEnd: true }))).toBe(false);
    });

    it('never selects a trialing row whose trial ALREADY elapsed — that is trial-reconcile', () => {
        // Arrange — trial-reconcile converts it against the provider and writes
        // its own TRIAL_RECONCILED audit row. Two converters is one too many.
        const row = buildRow({
            status: 'trialing',
            trialEnd: new Date(NOW.getTime() - MINUTE_MS)
        });
        // Act & Assert
        expect(candidate(row)).toBe(false);
    });

    it('never selects a trialing row with no trial_end at all', () => {
        // Arrange — the legacy pre-HOS-211 shape. Neither cron converts it by
        // owner decision; this sweep must not silently start.
        // Act & Assert
        expect(candidate(buildRow({ status: 'trialing', trialEnd: null }))).toBe(false);
    });

    it('never selects a terminal row', () => {
        // Arrange & Act & Assert
        expect(candidate(buildRow({ status: 'cancelled' }))).toBe(false);
        expect(candidate(buildRow({ status: 'expired' }))).toBe(false);
        expect(candidate(buildRow({ status: 'abandoned' }))).toBe(false);
    });
});

describe('isDriftReconcileCandidate — the latency tolerance boundary', () => {
    it('does NOT select a row touched a moment ago', () => {
        // Arrange — a webhook may still be in flight for it.
        const row = buildRow({ updatedAt: new Date(NOW.getTime() - MINUTE_MS) });
        // Act & Assert
        expect(candidate(row)).toBe(false);
    });

    it('does NOT select a row exactly AT the tolerance boundary', () => {
        // Arrange — the comparison is strict, so the boundary instant itself is
        // still protected. Asserted explicitly because an off-by-one here races
        // a live webhook by one tick.
        const row = buildRow({
            updatedAt: new Date(NOW.getTime() - DRIFT_TOLERANCE_MINUTES * MINUTE_MS)
        });
        // Act & Assert
        expect(candidate(row)).toBe(false);
    });

    it('selects a row one millisecond past the boundary', () => {
        // Arrange
        const row = buildRow({
            updatedAt: new Date(NOW.getTime() - DRIFT_TOLERANCE_MINUTES * MINUTE_MS - 1)
        });
        // Act & Assert
        expect(candidate(row)).toBe(true);
    });

    it('never selects a row with no updated_at to reason about', () => {
        // Arrange & Act & Assert
        expect(candidate(buildRow({ updatedAt: null }))).toBe(false);
    });
});

describe('classifyProviderReadFailure — "dead" and "unknown" are different facts', () => {
    it('recognises the mapped RESOURCE_NOT_FOUND code', () => {
        // Arrange — what @qazuor/qzpay-mercadopago produces when the SDK
        // surfaces a `cause` array whose first entry has code '404'.
        const error = Object.assign(new Error('Retrieve subscription - Resource not found: x'), {
            code: 'resource_not_found'
        });
        // Act & Assert
        expect(classifyProviderReadFailure(error)).toBe('unknown_at_provider');
    });

    it('recognises a bare HTTP 404 that never got the mapped code', () => {
        // Arrange — the common shape: the adapter's error mapper only reaches
        // its '404' branch through a `cause` array, so a plain 404 falls into
        // the generic provider_error branch and would otherwise be retried
        // silently forever.
        const error = Object.assign(new Error('Retrieve subscription - Request failed'), {
            code: 'provider_error',
            originalError: { status: 404 }
        });
        // Act & Assert
        expect(classifyProviderReadFailure(error)).toBe('unknown_at_provider');
    });

    it('recognises a 404 carried on the error itself', () => {
        // Arrange
        const error = Object.assign(new Error('Not Found'), { status: 404 });
        // Act & Assert
        expect(classifyProviderReadFailure(error)).toBe('unknown_at_provider');
    });

    it('classifies a rate limit as transient, not as unknown', () => {
        // Arrange — a 429 says nothing about whether the preapproval exists.
        // Escalating it would page a human for a retry.
        const error = Object.assign(new Error('Rate limit exceeded'), {
            code: 'rate_limit_error',
            originalError: { status: 429 }
        });
        // Act & Assert
        expect(classifyProviderReadFailure(error)).toBe('transient');
    });

    it('classifies an auth failure as transient', () => {
        // Arrange — an expired token makes every row unreadable. If that read
        // as "unknown", one bad token would escalate the entire portfolio.
        const error = Object.assign(new Error('Authentication failed'), {
            code: 'authentication_error',
            originalError: { status: 401 }
        });
        // Act & Assert
        expect(classifyProviderReadFailure(error)).toBe('transient');
    });

    it('classifies a network error as transient', () => {
        // Arrange & Act & Assert
        expect(classifyProviderReadFailure(new Error('ECONNRESET'))).toBe('transient');
    });

    it('classifies a non-object throw as transient', () => {
        // Arrange & Act & Assert
        expect(classifyProviderReadFailure('boom')).toBe('transient');
        expect(classifyProviderReadFailure(null)).toBe('transient');
        expect(classifyProviderReadFailure(undefined)).toBe('transient');
    });
});
