/**
 * Unit tests for subscription-status-derive.ts (HOS-171 — card-first trial)
 *
 * Covers AC-1 and AC-3 of the HOS-171 spec:
 *
 * 1. AC-1 — a provider-authorized subscription (mapped to ACTIVE) whose local
 *    trialEnd is still in the future derives to TRIALING.
 * 2. AC-3 — a trialEnd that is null or already in the past NEVER derives
 *    TRIALING; the mapped status passes through unchanged.
 * 3. Non-ACTIVE mapped statuses are never touched, regardless of the trial
 *    window. This is the guard that stops a cancelled/paused/past_due row from
 *    being resurrected into a live status just because its trial has not
 *    nominally elapsed.
 * 4. Full matrix exhaustion — every SubscriptionStatusEnum value crossed with
 *    future/null/past trialEnd, so a new enum value cannot silently slip
 *    through unconsidered.
 *
 * The clock is injected everywhere — no test depends on wall time.
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { deriveTrialingStatus } from '../../src/services/billing/subscription/subscription-status-derive.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Fixed reference clock — all trial windows below are relative to this. */
const NOW = new Date('2026-07-15T12:00:00.000Z');

/** A trial window that has not yet elapsed. */
const FUTURE_TRIAL_END = new Date('2026-07-29T12:00:00.000Z');

/** A trial window that has already elapsed. */
const PAST_TRIAL_END = new Date('2026-07-01T12:00:00.000Z');

/** All status values for exhaustive matrix loops. */
const ALL_STATUSES = Object.values(SubscriptionStatusEnum);

/** Every status except ACTIVE — none of these may ever derive TRIALING. */
const NON_ACTIVE_STATUSES = ALL_STATUSES.filter(
    (status) => status !== SubscriptionStatusEnum.ACTIVE
);

// ─── AC-1 — the derivation itself ────────────────────────────────────────────

describe('deriveTrialingStatus — AC-1: active + future trialEnd derives TRIALING', () => {
    it('derives TRIALING when the provider authorized and the trial has not elapsed', () => {
        // Arrange
        const input = {
            mappedStatus: SubscriptionStatusEnum.ACTIVE,
            trialEnd: FUTURE_TRIAL_END,
            now: NOW
        };
        // Act
        const result = deriveTrialingStatus(input);
        // Assert
        expect(result).toBe(SubscriptionStatusEnum.TRIALING);
    });

    it('derives TRIALING when the trial ends one millisecond from now', () => {
        // Arrange — the tightest possible future window
        const input = {
            mappedStatus: SubscriptionStatusEnum.ACTIVE,
            trialEnd: new Date(NOW.getTime() + 1),
            now: NOW
        };
        // Act
        const result = deriveTrialingStatus(input);
        // Assert
        expect(result).toBe(SubscriptionStatusEnum.TRIALING);
    });
});

// ─── AC-3 — null / past trialEnd must never derive TRIALING ──────────────────

describe('deriveTrialingStatus — AC-3: null or past trialEnd stays ACTIVE', () => {
    it('returns ACTIVE unchanged when trialEnd is null (ordinary paid subscription)', () => {
        // Arrange
        const input = {
            mappedStatus: SubscriptionStatusEnum.ACTIVE,
            trialEnd: null,
            now: NOW
        };
        // Act
        const result = deriveTrialingStatus(input);
        // Assert
        expect(result).toBe(SubscriptionStatusEnum.ACTIVE);
    });

    it('returns ACTIVE unchanged when the trial has elapsed (MP has charged)', () => {
        // Arrange
        const input = {
            mappedStatus: SubscriptionStatusEnum.ACTIVE,
            trialEnd: PAST_TRIAL_END,
            now: NOW
        };
        // Act
        const result = deriveTrialingStatus(input);
        // Assert
        expect(result).toBe(SubscriptionStatusEnum.ACTIVE);
    });

    it('returns ACTIVE at the exact boundary — trialEnd === now is elapsed, not trialing', () => {
        // Arrange — the boundary is exclusive: an instant that has arrived is over
        const input = {
            mappedStatus: SubscriptionStatusEnum.ACTIVE,
            trialEnd: new Date(NOW.getTime()),
            now: NOW
        };
        // Act
        const result = deriveTrialingStatus(input);
        // Assert
        expect(result).toBe(SubscriptionStatusEnum.ACTIVE);
    });
});

// ─── Non-active statuses are never derived off ───────────────────────────────

describe('deriveTrialingStatus — never derives from a non-ACTIVE status', () => {
    for (const status of NON_ACTIVE_STATUSES) {
        it(`${status} + future trialEnd stays ${status} (no resurrection)`, () => {
            // Arrange — an open trial window on a status that is not live
            const input = {
                mappedStatus: status,
                trialEnd: FUTURE_TRIAL_END,
                now: NOW
            };
            // Act
            const result = deriveTrialingStatus(input);
            // Assert
            expect(result).toBe(status);
        });
    }
});

// ─── Full matrix exhaustion ──────────────────────────────────────────────────

describe('deriveTrialingStatus — full truth table (every status × every window)', () => {
    const WINDOWS: ReadonlyArray<{ label: string; trialEnd: Date | null }> = [
        { label: 'future trialEnd', trialEnd: FUTURE_TRIAL_END },
        { label: 'null trialEnd', trialEnd: null },
        { label: 'past trialEnd', trialEnd: PAST_TRIAL_END }
    ];

    for (const status of ALL_STATUSES) {
        for (const window of WINDOWS) {
            // TRIALING is derived in exactly one cell of this matrix.
            const shouldDerive =
                status === SubscriptionStatusEnum.ACTIVE && window.trialEnd === FUTURE_TRIAL_END;
            const expected = shouldDerive ? SubscriptionStatusEnum.TRIALING : status;

            it(`${status} + ${window.label} => ${expected}`, () => {
                // Arrange
                const input = { mappedStatus: status, trialEnd: window.trialEnd, now: NOW };
                // Act
                const result = deriveTrialingStatus(input);
                // Assert
                expect(result).toBe(expected);
            });
        }
    }
});

// ─── Purity ──────────────────────────────────────────────────────────────────

describe('deriveTrialingStatus — purity', () => {
    it('does not mutate its inputs', () => {
        // Arrange
        const trialEnd = new Date(FUTURE_TRIAL_END.getTime());
        const now = new Date(NOW.getTime());
        const input = { mappedStatus: SubscriptionStatusEnum.ACTIVE, trialEnd, now };
        // Act
        deriveTrialingStatus(input);
        // Assert
        expect(trialEnd.getTime()).toBe(FUTURE_TRIAL_END.getTime());
        expect(now.getTime()).toBe(NOW.getTime());
    });

    it('is deterministic — the same input yields the same output', () => {
        // Arrange
        const input = {
            mappedStatus: SubscriptionStatusEnum.ACTIVE,
            trialEnd: FUTURE_TRIAL_END,
            now: NOW
        };
        // Act
        const first = deriveTrialingStatus(input);
        const second = deriveTrialingStatus(input);
        // Assert
        expect(first).toBe(second);
    });
});
