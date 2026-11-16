import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { computeApplicationDate } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import {
    MIGRATION_COHORT_CLOCK_BUDGET_MS,
    migrationCohortClockStart
} from '../../tests/billing/helpers/plan-migration-clock.ts';

/** Notice days of the e2e deadline version for a plan retirement (`'12'`). */
const NOTICE_DAYS = 60;
/** Each activated card delivers two late notices: the approval and the charge. */
const PER_CARD_MS = 2 * FAKE_NOTICE_DELAY_MS;

/**
 * Replays TEST:B12:12's cohort build on the fake clock: a card approved at `at`
 * is charged once, which moves its next charge one month (`advanceNextCharge`).
 */
function nextChargeOfCardApprovedAt(at: Date): Date {
    const next = new Date(at);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
}

function cohortApplicationDays(start: Date): { card: string; canceller: string } {
    // card is the 1st activated card, canceller the 3rd; the launch follows the 5th.
    const cardAnchor = nextChargeOfCardApprovedAt(start);
    const cancellerAnchor = nextChargeOfCardApprovedAt(new Date(start.getTime() + 2 * PER_CARD_MS));
    const announcedAt = new Date(start.getTime() + 5 * PER_CARD_MS + FAKE_NOTICE_DELAY_MS);
    const day = (nextChargeAt: Date) =>
        computeApplicationDate({
            nextChargeAt,
            cycle: 'monthly',
            announcedAt,
            noticeDays: NOTICE_DAYS
        });
    return { card: day(cardAnchor), canceller: day(cancellerAnchor) };
}

describe('HOS-2240 TEST:B12:12 cohort clock', () => {
    it('reproduces the CI failure: a real-now start 22 minutes before local midnight splits the cohort', () => {
        // Arrange: CI attempt 2 reached the launch step at 2026-11-16T02:38Z (23:38 local).
        const start = new Date('2026-11-16T02:38:00.000Z');

        // Act
        const days = cohortApplicationDays(start);

        // Assert: the test expected the card's day; the API stored the canceller's.
        expect(days).toEqual({ card: '2027-02-15', canceller: '2027-01-16' });
    });

    it('moves a start too close to local midnight onto the next local midnight', () => {
        // Arrange
        const now = new Date('2026-11-16T02:38:00.000Z');

        // Act
        const start = migrationCohortClockStart({ now });

        // Assert
        expect(start.toISOString()).toBe('2026-11-16T03:00:00.000Z');
        expect(cohortApplicationDays(start)).toEqual({
            card: '2027-01-16',
            canceller: '2027-01-16'
        });
    });

    it.each([
        ['2026-11-15T15:00:00.000Z', '2027-01-15'],
        ['2026-11-16T15:00:00.000Z', '2027-01-16'],
        ['2026-11-15T20:59:59.000Z', '2027-01-15']
    ])('keeps a start at %s and gives one application day %s', (iso, expected) => {
        // Arrange
        const now = new Date(iso);

        // Act
        const start = migrationCohortClockStart({ now });

        // Assert
        expect(start).toBe(now);
        expect(cohortApplicationDays(start)).toEqual({ card: expected, canceller: expected });
    });

    it('moves the start exactly when the budget reaches local midnight', () => {
        // Arrange: 2026-11-16T03:00Z is local midnight of 2026-11-16.
        const midnight = new Date('2026-11-16T03:00:00.000Z');
        const atBudget = new Date(midnight.getTime() - MIGRATION_COHORT_CLOCK_BUDGET_MS);

        // Act + Assert
        expect(migrationCohortClockStart({ now: atBudget }).toISOString()).toBe(
            midnight.toISOString()
        );
        const justBefore = new Date(atBudget.getTime() - 1);
        expect(migrationCohortClockStart({ now: justBefore })).toBe(justBefore);
    });

    it('never starts behind real time', () => {
        for (let hour = 0; hour < 24; hour += 1) {
            const now = new Date(Date.UTC(2026, 10, 15, hour, 17));
            expect(migrationCohortClockStart({ now }).getTime()).toBeGreaterThanOrEqual(
                now.getTime()
            );
        }
    });
});
