import { describe, expect, it } from 'vitest';
import { computeS11ServiceEnd } from '../../../../src/services/billing/subscription/s11-service-end.js';

const d = (value: string) => new Date(value);

describe('computeS11ServiceEnd', () => {
    it('uses the anchored period cycle in UTC and clamps month ends', () => {
        expect(
            computeS11ServiceEnd({
                now: d('2026-10-14Z'),
                paidPeriodStart: d('2026-10-01Z'),
                everyMonths: 1,
                creditEndsAt: null
            })
        ).toMatchObject({ serviceEndsAt: d('2026-11-01Z'), basis: 'PAID_PERIOD' });
        expect(
            computeS11ServiceEnd({
                now: d('2026-10-14Z'),
                paidPeriodStart: d('2026-10-01Z'),
                everyMonths: 12,
                creditEndsAt: null
            }).serviceEndsAt
        ).toEqual(d('2027-10-01Z'));
        expect(
            computeS11ServiceEnd({
                now: d('2026-10-14Z'),
                paidPeriodStart: d('2026-10-01Z'),
                everyMonths: 3,
                creditEndsAt: null
            }).serviceEndsAt
        ).toEqual(d('2027-01-01Z'));
        expect(
            computeS11ServiceEnd({
                now: d('2026-10-14Z'),
                paidPeriodStart: d('2026-10-01Z'),
                everyMonths: 6,
                creditEndsAt: null
            }).serviceEndsAt
        ).toEqual(d('2027-04-01Z'));
        expect(
            computeS11ServiceEnd({
                now: d('2026-01-01Z'),
                paidPeriodStart: d('2026-01-31Z'),
                everyMonths: 1,
                creditEndsAt: null
            }).serviceEndsAt
        ).toEqual(d('2026-02-28Z'));
    });
    it('selects the later paid or credit end and handles absent facts', () => {
        expect(
            computeS11ServiceEnd({
                now: d('2026-01-01Z'),
                paidPeriodStart: d('2026-10-01Z'),
                everyMonths: 1,
                creditEndsAt: d('2026-12-01Z')
            })
        ).toMatchObject({ serviceEndsAt: d('2026-12-01Z'), basis: 'CREDIT' });
        expect(
            computeS11ServiceEnd({
                now: d('2026-01-01Z'),
                paidPeriodStart: d('2026-10-01Z'),
                everyMonths: 1,
                creditEndsAt: d('2026-10-15Z')
            }).basis
        ).toBe('PAID_PERIOD');
        expect(
            computeS11ServiceEnd({
                now: d('2026-01-01Z'),
                paidPeriodStart: null,
                everyMonths: 1,
                creditEndsAt: d('2026-12-01Z')
            })
        ).toMatchObject({ basis: 'CREDIT' });
        expect(
            computeS11ServiceEnd({
                now: d('2026-01-01Z'),
                paidPeriodStart: null,
                everyMonths: 1,
                creditEndsAt: null
            })
        ).toMatchObject({ serviceEndsAt: d('2026-01-01Z'), basis: 'NOW' });
    });
    it('rejects invalid cycle lengths', () => {
        expect(() =>
            computeS11ServiceEnd({
                now: d('2026-01-01Z'),
                paidPeriodStart: null,
                everyMonths: 0,
                creditEndsAt: null
            })
        ).toThrow();
        expect(() =>
            computeS11ServiceEnd({
                now: d('2026-01-01Z'),
                paidPeriodStart: null,
                everyMonths: 13,
                creditEndsAt: null
            })
        ).toThrow();
    });
});
