import { afterEach, describe, expect, it } from 'vitest';
import { billingPeriodEnd } from '../../../../src/services/billing/subscription/billing-period-end';

const originalTz = process.env.TZ;

afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
});

const end = (iso: string, everyMonths: number) =>
    billingPeriodEnd({ periodStart: new Date(iso), everyMonths }).periodEnd.toISOString();

describe('billingPeriodEnd — the end of the paid period (HOS-1560, H2)', () => {
    it('clamps 31 January + 1 month to the last day of February', () => {
        // Arrange / Act / Assert
        expect(end('2026-01-31T12:00:00.000Z', 1)).toBe('2026-02-28T12:00:00.000Z');
        expect(end('2028-01-31T12:00:00.000Z', 1)).toBe('2028-02-29T12:00:00.000Z');
    });

    it('clamps 29 February + 12 months to 28 February of the next year', () => {
        expect(end('2028-02-29T08:15:00.000Z', 12)).toBe('2029-02-28T08:15:00.000Z');
    });

    it('moves 15 March + 1 month to 15 April, keeping the time of day', () => {
        expect(end('2026-03-15T10:30:45.123Z', 1)).toBe('2026-04-15T10:30:45.123Z');
    });

    it('crosses the year boundary', () => {
        expect(end('2026-12-31T00:00:00.000Z', 1)).toBe('2027-01-31T00:00:00.000Z');
        expect(end('2026-11-30T00:00:00.000Z', 3)).toBe('2027-02-28T00:00:00.000Z');
    });

    it('does not depend on the process timezone', () => {
        // Arrange: an instant whose local calendar day differs from its UTC day.
        const cases: readonly [string, number, string][] = [
            ['2026-01-31T01:00:00.000Z', 1, '2026-02-28T01:00:00.000Z'],
            ['2026-03-01T02:00:00.000Z', 1, '2026-04-01T02:00:00.000Z'],
            ['2026-01-31T23:30:00.000Z', 1, '2026-02-28T23:30:00.000Z']
        ];
        for (const tz of ['UTC', 'America/Argentina/Buenos_Aires', 'Pacific/Kiritimati']) {
            process.env.TZ = tz;
            for (const [start, months, expected] of cases) {
                // Act / Assert
                expect(end(start, months), `${tz} ${start}`).toBe(expected);
            }
        }
    });

    it('rejects a cadence outside 1..12 months', () => {
        expect(() => billingPeriodEnd({ periodStart: new Date(), everyMonths: 0 })).toThrow();
        expect(() => billingPeriodEnd({ periodStart: new Date(), everyMonths: 13 })).toThrow();
    });
});
