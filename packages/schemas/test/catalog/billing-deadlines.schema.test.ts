import { describe, expect, it } from 'vitest';
import {
    BillingDeadlineKeySchema,
    BillingDeadlineValuesSchema
} from '../../src/catalog/billing-deadlines.schema';

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

describe('HOS-2179 optional PLAZO 21: the one-time payment page (P-2)', () => {
    const page = { pageMinutes: 60, windowMarginMinutes: 60 };

    it('keeps accepting versions published before it and accepts the decided values', () => {
        expect(BillingDeadlineValuesSchema.safeParse(baseline).success).toBe(true);
        expect(BillingDeadlineValuesSchema.safeParse({ ...baseline, '21': page }).success).toBe(
            true
        );
    });

    it.each([
        ['a zero page', { ...page, pageMinutes: 0 }],
        ['a fractional page', { ...page, pageMinutes: 1.5 }],
        ['a zero margin', { ...page, windowMarginMinutes: 0 }],
        ['a negative margin', { ...page, windowMarginMinutes: -60 }],
        ['a missing margin', { pageMinutes: 60 }],
        ['a missing page', { windowMarginMinutes: 60 }],
        ['an extra value', { ...page, extra: true }],
        ['a page over 24 hours (R-3)', { ...page, pageMinutes: 1441 }],
        ['a margin over 24 hours (R-3)', { ...page, windowMarginMinutes: 1441 }]
    ])('rejects %s', (_, value) => {
        expect(BillingDeadlineValuesSchema.safeParse({ ...baseline, '21': value }).success).toBe(
            false
        );
    });

    it('accepts exactly 24 hours for the page and for the margin', () => {
        expect(
            BillingDeadlineValuesSchema.safeParse({
                ...baseline,
                '21': { pageMinutes: 1440, windowMarginMinutes: 1440 }
            }).success
        ).toBe(true);
    });

    it('is a key an admin can change, and 22 is not', () => {
        expect(BillingDeadlineKeySchema.safeParse(21).success).toBe(true);
        expect(BillingDeadlineKeySchema.safeParse(22).success).toBe(false);
    });
});
