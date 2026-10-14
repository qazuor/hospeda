import { describe, expect, it } from 'vitest';
import { resolveDueRenewalMilestone } from '../../../../src/services/billing/subscription/renewal-notice';

const charge = new Date('2001-06-20T15:00:00.000Z');
const day = (offset: number): Date => new Date(charge.getTime() + offset * 24 * 60 * 60 * 1000);

describe('HOS-1622 TEST:B13a:13 AC:B13a:13 resolveDueRenewalMilestone', () => {
    it('returns the most recent due milestone and never sends on or after the charge day', () => {
        const cases = [
            { offset: -10, expected: null },
            { offset: -5, expected: 5 },
            { offset: -3, expected: 5 },
            { offset: -1, expected: 1 },
            { offset: 0, expected: null },
            { offset: 1, expected: null }
        ] as const;
        for (const { offset, expected } of cases) {
            const result = resolveDueRenewalMilestone({
                nextChargeAt: charge,
                now: day(offset),
                daysBefore: [5, 1]
            });
            expect(result?.daysBefore ?? null).toBe(expected);
            if (expected !== null) expect(result?.targetDate).toBe('2001-06-20');
        }
    });

    it('deduplicates and ignores the configured order', () => {
        for (const daysBefore of [
            [1, 5],
            [5, 1],
            [3, 3]
        ] as const) {
            const result = resolveDueRenewalMilestone({
                nextChargeAt: charge,
                now: day(-3),
                daysBefore
            });
            expect(result?.daysBefore).toBe(daysBefore[0] === 3 ? 3 : 5);
        }
    });

    it('uses the Argentina market day when the UTC instant is still the previous day', () => {
        const earlyCharge = new Date('2001-06-20T02:00:00.000Z');
        const result = resolveDueRenewalMilestone({
            nextChargeAt: earlyCharge,
            now: new Date('2001-06-14T15:00:00.000Z'),
            daysBefore: [5, 1]
        });
        expect(result).toEqual({ daysBefore: 5, targetDate: '2001-06-19' });
    });
});
