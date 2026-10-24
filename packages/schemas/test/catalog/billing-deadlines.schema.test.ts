import { describe, expect, it } from 'vitest';
import { BillingDeadlineValuesSchema } from '../../src/catalog/billing-deadlines.schema';

const baseline = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
};

describe('TEST:1707:1 AC:1707:1 optional PLAZO 20', () => {
    it('continues to accept frozen ten-key versions and accepts configured days', () => {
        expect(BillingDeadlineValuesSchema.safeParse(baseline).success).toBe(true);
        expect(
            BillingDeadlineValuesSchema.safeParse({ ...baseline, '20': { daysBefore: [3, 1] } })
                .success
        ).toBe(true);
    });
    it.each([
        { daysBefore: [] },
        { daysBefore: [0] },
        { daysBefore: [2, 2] },
        { daysBefore: [1, 2, 3, 4, 5, 6] }
    ])('rejects invalid days $daysBefore', ({ daysBefore }) => {
        expect(
            BillingDeadlineValuesSchema.safeParse({ ...baseline, '20': { daysBefore } }).success
        ).toBe(false);
    });
    it('rejects extra values inside PLAZO 20', () => {
        expect(
            BillingDeadlineValuesSchema.safeParse({
                ...baseline,
                '20': { daysBefore: [1], extra: true }
            }).success
        ).toBe(false);
    });
});
