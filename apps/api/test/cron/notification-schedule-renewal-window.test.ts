/**
 * Unit Tests: `evaluateRenewalReminder` (HOS-854)
 *
 * The renewal window decision, isolated from the cron job's I/O.
 *
 * The job body wraps its whole renewal pass in a try/catch that logs and
 * swallows, so a defect in this predicate surfaces there only as "zero
 * reminders sent" — indistinguishable from "nothing was due". Testing the
 * predicate directly is what keeps that failure mode visible.
 *
 * @module test/cron/notification-schedule-renewal-window
 */

import { describe, expect, it } from 'vitest';
import { evaluateRenewalReminder } from '../../src/cron/jobs/notification-schedule.job';

const REMINDER_DAYS: ReadonlySet<number> = new Set([7, 3, 1]);
const NOW = new Date('2026-08-27T08:00:00.000Z');
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Builds an ISO timestamp `days` away from NOW (negative = in the past). */
function isoOffsetDays(days: number): string {
    return new Date(NOW.getTime() + days * MS_PER_DAY).toISOString();
}

describe('evaluateRenewalReminder', () => {
    describe('reminder days', () => {
        it.each([7, 3, 1])('marks a subscription renewing in %i day(s) as due', (days) => {
            // Arrange / Act
            const verdict = evaluateRenewalReminder({
                subscription: { status: 'active', currentPeriodEnd: isoOffsetDays(days) },
                now: NOW,
                reminderDays: REMINDER_DAYS
            });

            // Assert
            expect(verdict.due).toBe(true);
            expect(verdict).toEqual({
                due: true,
                daysRemaining: days,
                renewalDate: new Date(isoOffsetDays(days))
            });
        });

        it.each([2, 4, 5, 6, 8, 29, 365])('does NOT mark day %i as due', (days) => {
            // Arrange / Act
            const verdict = evaluateRenewalReminder({
                subscription: { status: 'active', currentPeriodEnd: isoOffsetDays(days) },
                now: NOW,
                reminderDays: REMINDER_DAYS
            });

            // Assert
            expect(verdict.due).toBe(false);
        });

        it('rounds a partial day UP, so 6.5 days out still reports 7', () => {
            // Arrange / Act
            const verdict = evaluateRenewalReminder({
                subscription: { status: 'active', currentPeriodEnd: isoOffsetDays(6.5) },
                now: NOW,
                reminderDays: REMINDER_DAYS
            });

            // Assert
            expect(verdict).toEqual({
                due: true,
                daysRemaining: 7,
                renewalDate: new Date(isoOffsetDays(6.5))
            });
        });
    });

    describe('expired periods (the HOS-854 regression)', () => {
        it.each([
            -0.5, -1, -2, -30, -365
        ])('is never due when the period ended %i day(s) ago', (days) => {
            // Arrange / Act
            const verdict = evaluateRenewalReminder({
                subscription: { status: 'active', currentPeriodEnd: isoOffsetDays(days) },
                now: NOW,
                reminderDays: REMINDER_DAYS
            });

            // Assert
            expect(verdict.due).toBe(false);
        });

        it('is due at the exact boundary, where msRemaining is 0', () => {
            // `Math.ceil(0)` is 0 and 0 is not a reminder day — this is the case
            // the original `Math.max(..., 1)` clamp existed to cover, and the fix
            // must keep it while dropping the clamp's effect on negatives.
            // Arrange / Act
            const verdict = evaluateRenewalReminder({
                subscription: { status: 'active', currentPeriodEnd: NOW.toISOString() },
                now: NOW,
                reminderDays: REMINDER_DAYS
            });

            // Assert
            expect(verdict).toEqual({ due: true, daysRemaining: 1, renewalDate: NOW });
        });
    });

    describe('status gate (defence in depth)', () => {
        it.each([
            'abandoned',
            'pending_provider',
            'incomplete',
            'canceled',
            'past_due',
            'paused'
        ])('is never due for a %s subscription, even inside the window', (status) => {
            // Arrange / Act
            const verdict = evaluateRenewalReminder({
                subscription: { status, currentPeriodEnd: isoOffsetDays(3) },
                now: NOW,
                reminderDays: REMINDER_DAYS
            });

            // Assert
            expect(verdict.due).toBe(false);
        });

        it('is due for an active subscription inside the window', () => {
            // The positive control for the gate above: proves these cases are
            // rejected for their status, not because the fixture never qualifies.
            // Arrange / Act
            const verdict = evaluateRenewalReminder({
                subscription: { status: 'active', currentPeriodEnd: isoOffsetDays(3) },
                now: NOW,
                reminderDays: REMINDER_DAYS
            });

            // Assert
            expect(verdict).toEqual({
                due: true,
                daysRemaining: 3,
                renewalDate: new Date(isoOffsetDays(3))
            });
        });

        it.each([undefined, null, ''])('is never due when status is %p', (status) => {
            // Arrange / Act
            const verdict = evaluateRenewalReminder({
                subscription: { status, currentPeriodEnd: isoOffsetDays(3) },
                now: NOW,
                reminderDays: REMINDER_DAYS
            });

            // Assert
            expect(verdict.due).toBe(false);
        });
    });

    describe('malformed input', () => {
        it.each([undefined, null])('is never due when currentPeriodEnd is %p', (periodEnd) => {
            // Arrange / Act
            const verdict = evaluateRenewalReminder({
                subscription: { status: 'active', currentPeriodEnd: periodEnd },
                now: NOW,
                reminderDays: REMINDER_DAYS
            });

            // Assert
            expect(verdict.due).toBe(false);
        });

        it('is never due when currentPeriodEnd is unparseable', () => {
            // An invalid Date yields NaN, and every comparison against NaN is
            // false — without an explicit guard that lands in the "not expired"
            // path and would be treated as a live renewal.
            // Arrange / Act
            const verdict = evaluateRenewalReminder({
                subscription: { status: 'active', currentPeriodEnd: 'not-a-date' },
                now: NOW,
                reminderDays: REMINDER_DAYS
            });

            // Assert
            expect(verdict.due).toBe(false);
        });

        it('accepts a Date instance as well as an ISO string', () => {
            // Arrange / Act
            const verdict = evaluateRenewalReminder({
                subscription: {
                    status: 'active',
                    currentPeriodEnd: new Date(NOW.getTime() + 3 * MS_PER_DAY)
                },
                now: NOW,
                reminderDays: REMINDER_DAYS
            });

            // Assert
            expect(verdict).toEqual({
                due: true,
                daysRemaining: 3,
                renewalDate: new Date(isoOffsetDays(3))
            });
        });
    });
});
