import { describe, expect, it } from 'vitest';
import { BILLING_CRON_LAG_GRACE_HOURS } from '../src/constants/billing.constants.js';
import { isSubscriptionLive } from '../src/predicates/is-subscription-live.js';

// Fixed reference point — all tests pass an explicit nowMs for determinism.
const NOW_MS = 1_720_000_000_000; // 2024-07-03T09:46:40.000Z

const HOURS_MS = 3_600_000;
const GRACE_MS = BILLING_CRON_LAG_GRACE_HOURS * HOURS_MS; // 6 h in ms

describe('isSubscriptionLive', () => {
    // -------------------------------------------------------------------------
    // Non-live statuses (no soft-cancel grace)
    // -------------------------------------------------------------------------
    describe('non-live statuses (past_due, paused, expired, unpaid)', () => {
        const nonLiveStatuses = ['past_due', 'paused', 'expired', 'unpaid', ''];

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
    // 'comp' status — permanently complimentary (SPEC-262); always live (HOS-239)
    // -------------------------------------------------------------------------
    describe("status 'comp' (complimentary — always live)", () => {
        it('should return true with no dates provided', () => {
            expect(isSubscriptionLive({ status: 'comp', nowMs: NOW_MS })).toBe(true);
        });

        it('should return true even with a currentPeriodEnd far in the past (never expires)', () => {
            const longAgo = new Date(NOW_MS - 365 * 24 * HOURS_MS);
            expect(
                isSubscriptionLive({ status: 'comp', currentPeriodEnd: longAgo, nowMs: NOW_MS })
            ).toBe(true);
        });

        it('should return true even with a trialEnd in the past (dates are ignored for comp)', () => {
            const pastTrial = new Date(NOW_MS - 10 * 24 * HOURS_MS);
            expect(isSubscriptionLive({ status: 'comp', trialEnd: pastTrial, nowMs: NOW_MS })).toBe(
                true
            );
        });
    });

    // -------------------------------------------------------------------------
    // 'cancelled' status — soft-cancel grace (live until currentPeriodEnd, no grace window)
    // -------------------------------------------------------------------------
    describe("status 'cancelled' (paid-through grace)", () => {
        /*
         * Every LIVE case below carries `cancelAtPeriodEnd: true` (HOS-1310).
         * The flag is not decoration: it is the only column separating an owner
         * who paid and then asked to stop from a row that never completed a
         * checkout, because `currentPeriodEnd` is stamped by qzpay at INSERT as
         * `now + 30 days`, before any charge. The dedicated describe block at the
         * end of this file is the pair of cases that proves it.
         */
        it('should return true when no currentPeriodEnd is provided (absent = fail-open)', () => {
            // Absent currentPeriodEnd → fail-open → true
            const input = { status: 'cancelled', cancelAtPeriodEnd: true, nowMs: NOW_MS };
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should return true when currentPeriodEnd is in the future (owner paid through)', () => {
            // Arrange — period_end is 5 days in the future
            const futureEnd = new Date(NOW_MS + 5 * 24 * HOURS_MS);
            const input = {
                status: 'cancelled',
                cancelAtPeriodEnd: true,
                currentPeriodEnd: futureEnd,
                nowMs: NOW_MS
            };
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should return false when currentPeriodEnd is 1 hour in the past (no grace window)', () => {
            // Arrange — period_end passed 1 h ago; no cron-lag grace for cancelled
            const pastEnd = new Date(NOW_MS - 1 * HOURS_MS);
            const input = { status: 'cancelled', currentPeriodEnd: pastEnd, nowMs: NOW_MS };
            expect(isSubscriptionLive(input)).toBe(false);
        });

        it('should return false when currentPeriodEnd is 1 ms in the past', () => {
            // Arrange — just expired
            const justPast = new Date(NOW_MS - 1);
            const input = { status: 'cancelled', currentPeriodEnd: justPast, nowMs: NOW_MS };
            expect(isSubscriptionLive(input)).toBe(false);
        });

        it('should return true when currentPeriodEnd is exactly now (boundary — overdueMs = 0 ≤ 0)', () => {
            // Arrange — exactly at now: overdueMs = 0, graceLimitMs = 0 → 0 ≤ 0 = true
            const exactlyNow = new Date(NOW_MS);
            const input = {
                status: 'cancelled',
                cancelAtPeriodEnd: true,
                currentPeriodEnd: exactlyNow,
                nowMs: NOW_MS
            };
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should return true when currentPeriodEnd is null (fail-open)', () => {
            const input = {
                status: 'cancelled',
                cancelAtPeriodEnd: true,
                currentPeriodEnd: null,
                nowMs: NOW_MS
            };
            expect(isSubscriptionLive(input)).toBe(true);
        });

        it('should NOT apply cron-lag grace: 1 h past end is dead (unlike active where 1 h past is live)', () => {
            // Arrange — 1 h past currentPeriodEnd
            const oneHourPast = new Date(NOW_MS - 1 * HOURS_MS);
            // Active would be live (within 6 h grace), cancelled must be dead
            expect(
                isSubscriptionLive({
                    status: 'active',
                    currentPeriodEnd: oneHourPast,
                    nowMs: NOW_MS
                })
            ).toBe(true);
            expect(
                isSubscriptionLive({
                    status: 'cancelled',
                    currentPeriodEnd: oneHourPast,
                    nowMs: NOW_MS
                })
            ).toBe(false);
        });
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

describe('isSubscriptionLive — courtesy (HOS-180)', () => {
    const NOW = new Date('2026-09-15T12:00:00Z').getTime();

    it('is live while the courtesy window is open', () => {
        expect(
            isSubscriptionLive({
                status: 'courtesy',
                courtesyEndsAt: new Date('2026-10-15T12:00:00Z'),
                nowMs: NOW
            })
        ).toBe(true);
    });

    it('is not live once the window is past the cron-lag grace', () => {
        expect(
            isSubscriptionLive({
                status: 'courtesy',
                courtesyEndsAt: new Date('2026-09-14T12:00:00Z'),
                nowMs: NOW
            })
        ).toBe(false);
    });

    it('stays live inside the cron-lag grace, so cron timing never punishes the subscriber', () => {
        // One hour past the window, well inside the 6h grace: the job that
        // resumes the preapproval has not run yet, and that is our problem, not
        // the subscriber's.
        expect(
            isSubscriptionLive({
                status: 'courtesy',
                courtesyEndsAt: new Date(NOW - 3_600_000),
                nowMs: NOW
            })
        ).toBe(true);
    });

    it('fails open on an absent window, like every other date on this input', () => {
        expect(isSubscriptionLive({ status: 'courtesy', nowMs: NOW })).toBe(true);
        expect(isSubscriptionLive({ status: 'courtesy', courtesyEndsAt: null, nowMs: NOW })).toBe(
            true
        );
    });

    it('does not make a plain paused subscription live', () => {
        // Same underlying MercadoPago state, opposite answer. This is the
        // distinction the whole feature rests on.
        expect(
            isSubscriptionLive({
                status: 'paused',
                courtesyEndsAt: new Date('2026-10-15T12:00:00Z'),
                nowMs: NOW
            })
        ).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// HOS-1310: a cancelled row is not evidence of payment
// ─────────────────────────────────────────────────────────────────────────────

describe('HOS-1310: the paid-through grace requires cancelAtPeriodEnd, not just a date', () => {
    const NOW = Date.UTC(2026, 8, 10, 12, 0, 0);
    /** A period end a month out — exactly what qzpay stamps at INSERT. */
    const THIRTY_DAYS_OUT = new Date(NOW + 30 * 24 * 3_600_000);

    /*
     * The two cases in tension. They differ in ONE field, and that field is the
     * whole fix: the date is identical and identically useless, because qzpay
     * writes `currentPeriodEnd = now + 30 days` in the INSERT next to
     * `status = 'incomplete'`, before the owner has authorized anything.
     *
     * A test with only the first case would pass on a predicate that refused
     * EVERY cancelled row — silently taking the paid period away from every
     * owner who cancelled mid-cycle. The second case is what kills that.
     */
    it('a never-paid phantom row (cancelAtPeriodEnd false) is NOT live', () => {
        // The webhook path: checkout abandoned or card refused -> MP reports the
        // preapproval cancelled -> the row is written `cancelled` and its
        // placeholder period end is REFRESHED, not cleared. Nothing reaps it.
        expect(
            isSubscriptionLive({
                status: 'cancelled',
                cancelAtPeriodEnd: false,
                currentPeriodEnd: THIRTY_DAYS_OUT,
                nowMs: NOW
            })
        ).toBe(false);
    });

    it('the REAL staging row, shape for shape, is not live (measured 2026-09-10)', () => {
        /*
         * Not a hypothetical. A cancelled, never-charged preapproval in staging
         * (`summarized.charged_quantity = null`, `last_charged_date = null`) whose
         * `current_period_end` is MercadoPago's `date_created` plus one month —
         * written by the adapter through the webhook, not by the local insert, as
         * the millisecond tail proves. MercadoPago returns `auto_recurring`
         * intact on a cancelled preapproval (frequency 1 month,
         * transaction_amount 35000, no end_date), so `calculatePeriodEnd` adds
         * the month and the window is ~30 days rather than zero.
         *
         * This exact shape answered `true` before the fix, and that row was still
         * reading live fifteen days after it died.
         */
        const dateCreated = Date.UTC(2026, 7, 25, 9, 10, 37, 767);
        const oneMonthAfterCreation = new Date(Date.UTC(2026, 8, 25, 9, 10, 37, 767));
        expect(
            isSubscriptionLive({
                status: 'cancelled',
                cancelAtPeriodEnd: false,
                currentPeriodEnd: oneMonthAfterCreation,
                // Fifteen days into the phantom window.
                nowMs: dateCreated + 15 * 24 * 3_600_000
            })
        ).toBe(false);
    });

    it('a real soft-cancel (cancelAtPeriodEnd true) with the SAME date IS live', () => {
        expect(
            isSubscriptionLive({
                status: 'cancelled',
                cancelAtPeriodEnd: true,
                currentPeriodEnd: THIRTY_DAYS_OUT,
                nowMs: NOW
            })
        ).toBe(true);
    });

    it.each([
        ['absent', undefined],
        ['null', null],
        ['false', false]
    ])('treats a %s cancelAtPeriodEnd as "no evidence of payment" — this field does NOT fail open', (_label, flag) => {
        // The deliberate asymmetry against every date on this input. Absence
        // of a date honestly means "nothing to expire against"; absence of
        // this flag means "we do not know that anyone paid", and guessing
        // `true` is the bug.
        expect(
            isSubscriptionLive({
                status: 'cancelled',
                cancelAtPeriodEnd: flag,
                currentPeriodEnd: THIRTY_DAYS_OUT,
                nowMs: NOW
            })
        ).toBe(false);
    });

    it("applies to qzpay's `canceled` spelling too — normalization and the flag are BOTH needed", () => {
        // Neither half is sufficient. Without normalization a legitimate
        // soft-cancel that came through qzpay's spelling is denied its paid
        // period; without the flag a never-paid row is granted one.
        expect(
            isSubscriptionLive({
                status: 'canceled',
                cancelAtPeriodEnd: false,
                currentPeriodEnd: THIRTY_DAYS_OUT,
                nowMs: NOW
            })
        ).toBe(false);
        expect(
            isSubscriptionLive({
                status: 'canceled',
                cancelAtPeriodEnd: true,
                currentPeriodEnd: THIRTY_DAYS_OUT,
                nowMs: NOW
            })
        ).toBe(true);
    });

    it('and the flag is IGNORED by every other status — it gates one branch, not the predicate', () => {
        // A guard that leaked into the other branches would revoke access from
        // every paying customer, which is the over-wide direction of this fix.
        for (const status of ['active', 'trialing', 'courtesy', 'comp']) {
            expect(
                isSubscriptionLive({
                    status,
                    cancelAtPeriodEnd: false,
                    currentPeriodEnd: THIRTY_DAYS_OUT,
                    trialEnd: THIRTY_DAYS_OUT,
                    courtesyEndsAt: THIRTY_DAYS_OUT,
                    nowMs: NOW
                })
            ).toBe(true);
        }
    });
});
