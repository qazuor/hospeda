/**
 * Unit tests for courtesy-grant.calc.ts (HOS-180).
 *
 * Two rules carry the feature and are asserted hardest here:
 *
 * 1. The window starts at the END of the already-paid period, never at the
 *    grant instant (spec OQ-4). Getting this wrong gifts the subscriber a cycle
 *    they had already paid for and charges them for one they were promised.
 * 2. A grant too close to the next charge is refused (R-6 / AC-12), because
 *    pausing the preapproval is what stops that charge and a late pause loses
 *    the race.
 */
import { describe, expect, it } from 'vitest';
import {
    COURTESY_MIN_LEAD_DAYS,
    computeCourtesyWindow
} from '../../src/services/billing/subscription/courtesy-grant.calc.js';

const NOW = new Date('2026-09-10T12:00:00.000Z');

describe('computeCourtesyWindow — the window', () => {
    it('starts at the end of the already-paid period, NOT at the grant instant', () => {
        // Arrange
        const currentPeriodEnd = new Date('2026-10-01T00:00:00.000Z');
        // Act
        const result = computeCourtesyWindow({
            currentPeriodEnd,
            cycles: 1,
            cadence: 'monthly',
            now: NOW
        });
        // Assert
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.window.courtesyStartsAt.toISOString()).toBe(currentPeriodEnd.toISOString());
        expect(result.window.courtesyStartsAt.getTime()).not.toBe(NOW.getTime());
    });

    it('ends N calendar months after the start on a monthly plan', () => {
        const result = computeCourtesyWindow({
            currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
            cycles: 2,
            cadence: 'monthly',
            now: NOW
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.window.courtesyEndsAt.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    });

    it('counts a year per cycle on an annual plan', () => {
        const result = computeCourtesyWindow({
            currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
            cycles: 1,
            cadence: 'annual',
            now: NOW
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.window.courtesyEndsAt.toISOString()).toBe('2027-10-01T00:00:00.000Z');
    });

    it('uses calendar months, so a gift spanning February is still one month', () => {
        // 31 days would land on 1 March; a calendar month lands on 31 January.
        const result = computeCourtesyWindow({
            currentPeriodEnd: new Date('2026-12-31T00:00:00.000Z'),
            cycles: 1,
            cadence: 'monthly',
            now: NOW
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.window.courtesyEndsAt.toISOString()).toBe('2027-01-31T00:00:00.000Z');
    });

    it('echoes the cycle count for the audit trail', () => {
        const result = computeCourtesyWindow({
            currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
            cycles: 5,
            cadence: 'monthly',
            now: NOW
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.window.courtesyCyclesGranted).toBe(5);
    });

    it('has no upper cap on cycles (spec OQ-5)', () => {
        const result = computeCourtesyWindow({
            currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
            cycles: 999,
            cadence: 'monthly',
            now: NOW
        });
        expect(result.ok).toBe(true);
    });
});

describe('computeCourtesyWindow — refusals', () => {
    it('refuses when the next charge is inside the lead-time margin (R-6)', () => {
        // One day out: pausing the preapproval now may lose the race against a
        // charge MercadoPago has already begun, and the subscriber would pay for
        // the very cycle being gifted.
        const result = computeCourtesyWindow({
            currentPeriodEnd: new Date(NOW.getTime() + 1 * 86_400_000),
            cycles: 1,
            cadence: 'monthly',
            now: NOW
        });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.refusal.kind).toBe('not-enough-lead-time');
    });

    it('accepts a grant exactly at the lead-time boundary', () => {
        const result = computeCourtesyWindow({
            currentPeriodEnd: new Date(NOW.getTime() + COURTESY_MIN_LEAD_DAYS * 86_400_000),
            cycles: 1,
            cadence: 'monthly',
            now: NOW
        });
        expect(result.ok).toBe(true);
    });

    it('refuses one instant inside the boundary', () => {
        const result = computeCourtesyWindow({
            currentPeriodEnd: new Date(NOW.getTime() + COURTESY_MIN_LEAD_DAYS * 86_400_000 - 1),
            cycles: 1,
            cadence: 'monthly',
            now: NOW
        });
        expect(result.ok).toBe(false);
    });

    it('never overstates the room left in the refusal message', () => {
        // 2.9 days out must report 2, not 3 — reporting 3 would name exactly the
        // threshold that just rejected the grant, which reads as a bug.
        const result = computeCourtesyWindow({
            currentPeriodEnd: new Date(NOW.getTime() + 2.9 * 86_400_000),
            cycles: 1,
            cadence: 'monthly',
            now: NOW
        });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        if (result.refusal.kind !== 'not-enough-lead-time') throw new Error('wrong refusal');
        expect(result.refusal.daysUntil).toBe(2);
    });

    it('refuses a period end that already passed', () => {
        const result = computeCourtesyWindow({
            currentPeriodEnd: new Date(NOW.getTime() - 86_400_000),
            cycles: 1,
            cadence: 'monthly',
            now: NOW
        });
        expect(result.ok).toBe(false);
    });

    it('refuses without a period end — no boundary to start from', () => {
        for (const value of [null, undefined]) {
            const result = computeCourtesyWindow({
                currentPeriodEnd: value,
                cycles: 1,
                cadence: 'monthly',
                now: NOW
            });
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.refusal.kind).toBe('no-period-end');
        }
    });

    it.each([0, -1, 1.5, Number.NaN])('refuses a cycle count of %s', (cycles) => {
        const result = computeCourtesyWindow({
            currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
            cycles,
            cadence: 'monthly',
            now: NOW
        });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.refusal.kind).toBe('invalid-cycles');
    });

    it('checks the cycle count before the period end, so a bad call reports the real problem', () => {
        const result = computeCourtesyWindow({
            currentPeriodEnd: null,
            cycles: 0,
            cadence: 'monthly',
            now: NOW
        });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.refusal.kind).toBe('invalid-cycles');
    });
});
