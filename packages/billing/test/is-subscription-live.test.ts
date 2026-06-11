import { describe, expect, it } from 'vitest';
import { BILLING_CRON_LAG_GRACE_HOURS } from '../src/constants/billing.constants.js';
import { isSubscriptionLive } from '../src/predicates/is-subscription-live.js';

// Fixed reference point — all tests pass an explicit nowMs for determinism.
const NOW_MS = 1_720_000_000_000; // 2024-07-03T09:46:40.000Z

const HOURS_MS = 3_600_000;
const GRACE_MS = BILLING_CRON_LAG_GRACE_HOURS * HOURS_MS; // 6 h in ms

describe('isSubscriptionLive', () => {
    // -------------------------------------------------------------------------
    // Non-live statuses
    // -------------------------------------------------------------------------
    describe('non-active/trialing statuses', () => {
        const nonLiveStatuses = ['cancelled', 'past_due', 'paused', 'expired', 'unpaid', ''];

        for (const status of nonLiveStatuses) {
            it(`should return false for status '${status}'`, () => {
                // Arrange
                const input = { status, nowMs: NOW_MS };
                // Act
                const result = isSubscriptionLive(input);
                // Assert
                expect(result).toBe(false);
            });
        }
    });

    // -------------------------------------------------------------------------
    // 'active' status
    // -------------------------------------------------------------------------
    describe("status 'active'", () => {
        it('should return true when currentPeriodEnd is null (fail-open)', () => {
            // Arrange
            const input = { status: 'active', currentPeriodEnd: null, nowMs: NOW_MS };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should return true when currentPeriodEnd is undefined (fail-open)', () => {
            // Arrange
            const input = { status: 'active', nowMs: NOW_MS };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should return true when currentPeriodEnd is in the future', () => {
            // Arrange — expires 1 hour from now
            const futureEnd = new Date(NOW_MS + 1 * HOURS_MS);
            const input = { status: 'active', currentPeriodEnd: futureEnd, nowMs: NOW_MS };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should return true when currentPeriodEnd is 1 h in the past (within 6 h grace)', () => {
            // Arrange
            const pastEnd = new Date(NOW_MS - 1 * HOURS_MS);
            const input = { status: 'active', currentPeriodEnd: pastEnd, nowMs: NOW_MS };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should return true when currentPeriodEnd is exactly at the grace boundary (<=)', () => {
            // Arrange — overdue by exactly BILLING_CRON_LAG_GRACE_HOURS
            const atBoundary = new Date(NOW_MS - GRACE_MS);
            const input = { status: 'active', currentPeriodEnd: atBoundary, nowMs: NOW_MS };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should return false when currentPeriodEnd is 7 h in the past (past 6 h grace)', () => {
            // Arrange
            const sevenHoursPast = new Date(NOW_MS - 7 * HOURS_MS);
            const input = {
                status: 'active',
                currentPeriodEnd: sevenHoursPast,
                nowMs: NOW_MS
            };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(false);
        });

        it('should return false when currentPeriodEnd is 1 ms past the grace boundary', () => {
            // Arrange
            const justPastGrace = new Date(NOW_MS - GRACE_MS - 1);
            const input = {
                status: 'active',
                currentPeriodEnd: justPastGrace,
                nowMs: NOW_MS
            };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(false);
        });

        it('should treat an invalid Date as fail-open (true)', () => {
            // Arrange
            const invalid = new Date('not-a-date');
            const input = { status: 'active', currentPeriodEnd: invalid, nowMs: NOW_MS };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // 'trialing' status
    // -------------------------------------------------------------------------
    describe("status 'trialing'", () => {
        it('should return true when trialEnd is null (fail-open)', () => {
            // Arrange
            const input = { status: 'trialing', trialEnd: null, nowMs: NOW_MS };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should return true when trialEnd is undefined (fail-open)', () => {
            // Arrange
            const input = { status: 'trialing', nowMs: NOW_MS };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should return true when trialEnd is in the future', () => {
            // Arrange
            const futureEnd = new Date(NOW_MS + 2 * HOURS_MS);
            const input = { status: 'trialing', trialEnd: futureEnd, nowMs: NOW_MS };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should return true when trialEnd is 1 h in the past (within 6 h grace)', () => {
            // Arrange
            const pastEnd = new Date(NOW_MS - 1 * HOURS_MS);
            const input = { status: 'trialing', trialEnd: pastEnd, nowMs: NOW_MS };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should return true when trialEnd is at the exact grace boundary (<=)', () => {
            // Arrange
            const atBoundary = new Date(NOW_MS - GRACE_MS);
            const input = { status: 'trialing', trialEnd: atBoundary, nowMs: NOW_MS };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should return false when trialEnd is 7 h in the past (past 6 h grace)', () => {
            // Arrange
            const sevenHoursPast = new Date(NOW_MS - 7 * HOURS_MS);
            const input = { status: 'trialing', trialEnd: sevenHoursPast, nowMs: NOW_MS };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(false);
        });

        it('should treat an invalid Date as fail-open (true)', () => {
            // Arrange
            const invalid = new Date('x');
            const input = { status: 'trialing', trialEnd: invalid, nowMs: NOW_MS };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // graceHours override
    // -------------------------------------------------------------------------
    describe('graceHours override', () => {
        it('should return false when graceHours is 0 and subscription is exactly at expiry', () => {
            // Arrange — period ended at exactly nowMs (overdueMs = 0 and grace is 0 → 0 <= 0 is true)
            // Per spec: <= at boundary. At exactly-expired with graceHours=0: overdueMs=0, graceLimitMs=0 → 0<=0 → true
            // Test 1 ms past expiry to confirm block:
            const expiredMs = new Date(NOW_MS - 1);
            const input = {
                status: 'active',
                currentPeriodEnd: expiredMs,
                nowMs: NOW_MS,
                graceHours: 0
            };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(false);
        });

        it('should return true when graceHours is 0 and period ends exactly at nowMs (<=)', () => {
            // Arrange — period ends at now (overdue = 0)
            const exactlyNow = new Date(NOW_MS);
            const input = {
                status: 'active',
                currentPeriodEnd: exactlyNow,
                nowMs: NOW_MS,
                graceHours: 0
            };
            // Act + Assert — 0 <= 0 is true (boundary is still live)
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should accept a custom graceHours larger than default (e.g. 12 h)', () => {
            // Arrange — 7 hours past end would be dead with default 6 h grace, but live with 12 h
            const sevenHoursPast = new Date(NOW_MS - 7 * HOURS_MS);
            const input = {
                status: 'active',
                currentPeriodEnd: sevenHoursPast,
                nowMs: NOW_MS,
                graceHours: 12
            };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should accept a custom graceHours smaller than default (e.g. 1 h)', () => {
            // Arrange — 2 hours past end: dead with 1 h grace, but live with default 6 h
            const twoHoursPast = new Date(NOW_MS - 2 * HOURS_MS);
            const input = {
                status: 'active',
                currentPeriodEnd: twoHoursPast,
                nowMs: NOW_MS,
                graceHours: 1
            };
            // Act + Assert
            expect(isSubscriptionLive(input)).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // Cross-field isolation — 'active' should not be affected by trialEnd
    // -------------------------------------------------------------------------
    describe('field isolation', () => {
        it("should ignore trialEnd when status is 'active' (only currentPeriodEnd matters)", () => {
            // Arrange — trialEnd in the far past, currentPeriodEnd is fine
            const trialEndFarPast = new Date(NOW_MS - 100 * HOURS_MS);
            const validPeriodEnd = new Date(NOW_MS + 1 * HOURS_MS);
            const input = {
                status: 'active',
                trialEnd: trialEndFarPast,
                currentPeriodEnd: validPeriodEnd,
                nowMs: NOW_MS
            };
            // Act + Assert — should be live because currentPeriodEnd is fine
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it("should ignore currentPeriodEnd when status is 'trialing' (only trialEnd matters)", () => {
            // Arrange — currentPeriodEnd in the far past, trialEnd is fine
            const periodEndFarPast = new Date(NOW_MS - 100 * HOURS_MS);
            const validTrialEnd = new Date(NOW_MS + 1 * HOURS_MS);
            const input = {
                status: 'trialing',
                trialEnd: validTrialEnd,
                currentPeriodEnd: periodEndFarPast,
                nowMs: NOW_MS
            };
            // Act + Assert — should be live because trialEnd is fine
            expect(isSubscriptionLive(input)).toBe(true);
        });
    });
});
