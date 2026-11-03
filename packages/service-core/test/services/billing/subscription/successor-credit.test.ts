import { describe, expect, it } from 'vitest';
import {
    computeSuccessorCreditDays,
    scheduleSuccessorFirstChargeWithCredit
} from '../../../../src/services/billing/subscription/successor-credit';

const start = new Date('2026-04-01T00:00:00.000Z');
const end = new Date('2026-05-01T00:00:00.000Z');
const middle = new Date('2026-04-16T00:00:00.000Z');

describe('DEC-SUB-006 value credit', () => {
    it('covers half the cycle at the same price', () => {
        const result = computeSuccessorCreditDays({
            paidAmountMinor: 3000,
            periodStart: start,
            periodEnd: end,
            now: middle,
            targetAmountMinor: 3000,
            targetCycle: 'monthly'
        });
        expect(result).toEqual({ creditDays: 15, unusedMinor: 1500 });
    });

    it('covers half as many days at twice the price', () => {
        const result = computeSuccessorCreditDays({
            paidAmountMinor: 3000,
            periodStart: start,
            periodEnd: end,
            now: middle,
            targetAmountMinor: 6000,
            targetCycle: 'monthly'
        });
        expect(result.creditDays).toBe(8);
    });

    it('covers more days on an annual option with a lower daily price', () => {
        const result = computeSuccessorCreditDays({
            paidAmountMinor: 3000,
            periodStart: start,
            periodEnd: end,
            now: middle,
            targetAmountMinor: 12000,
            targetCycle: 'annual'
        });
        expect(result.creditDays).toBe(46);
    });

    it('rounds a fractional credit day upward', () => {
        const result = computeSuccessorCreditDays({
            paidAmountMinor: 100,
            periodStart: start,
            periodEnd: end,
            now: middle,
            targetAmountMinor: 3000,
            targetCycle: 'monthly'
        });
        expect(result.creditDays).toBe(1);
    });

    it('returns zero when the covered period ends', () => {
        const result = computeSuccessorCreditDays({
            paidAmountMinor: 3000,
            periodStart: start,
            periodEnd: end,
            now: end,
            targetAmountMinor: 3000,
            targetCycle: 'monthly'
        });
        expect(result).toEqual({ creditDays: 0, unusedMinor: 0 });
    });

    it('keeps B3 window plus one day for a small credit', () => {
        const bornAt = start;
        const authorizationWindowEndsAt = new Date(start.getTime() + 3 * 86400000);
        const result = scheduleSuccessorFirstChargeWithCredit({
            bornAt,
            authorizationWindowEndsAt,
            creditDays: 2
        });
        expect(result.firstChargeAt).toEqual(new Date(start.getTime() + 4 * 86400000));
    });

    it('moves the charge to the end of a large credit', () => {
        const bornAt = start;
        const authorizationWindowEndsAt = new Date(start.getTime() + 3 * 86400000);
        const result = scheduleSuccessorFirstChargeWithCredit({
            bornAt,
            authorizationWindowEndsAt,
            creditDays: 12
        });
        expect(result.firstChargeAt).toEqual(new Date(start.getTime() + 12 * 86400000));
    });
});
