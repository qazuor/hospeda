/**
 * Tests for UTC calendar arithmetic (HOS-1010).
 *
 * The point of this module is that its answer does not depend on where the
 * process runs, so almost every assertion here runs under four timezones
 * spanning UTC-3 to UTC+14. A test of date arithmetic that runs in only one
 * zone cannot tell a correct implementation from the local-time one it
 * replaced — that is exactly how the bug this module fixes survived a green
 * suite for the whole of HOS-180.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addCalendarMonths, addCalendarYears } from '../src/utc-date-math';

/**
 * UTC-3 is the zone that produced the reported bug; Tokyo and Kiritimati sit on
 * the other side of the date line, so a stray local read fails there too and in
 * the opposite direction.
 */
const ZONES = [
    'UTC',
    'America/Argentina/Buenos_Aires',
    'Asia/Tokyo',
    'Pacific/Kiritimati'
] as const;

afterEach(() => {
    vi.unstubAllEnvs();
});

describe.each(ZONES)('addCalendarMonths under TZ=%s', (zone) => {
    // Sanity check on the harness itself: if stubbing TZ did not actually move
    // the local clock, every assertion below would be the UTC one four times
    // over and would prove nothing.
    it('the timezone stub really moves local time (harness check)', () => {
        vi.stubEnv('TZ', zone);
        const localOffset = new Date('2026-11-01T00:00:00.000Z').getTimezoneOffset();
        const expected = {
            UTC: 0,
            'America/Argentina/Buenos_Aires': 180,
            'Asia/Tokyo': -540,
            'Pacific/Kiritimati': -840
        };
        expect(localOffset).toBe(expected[zone]);
    });

    it('adds a month to a period starting on day 1 — the case the local-time version broke', () => {
        vi.stubEnv('TZ', zone);
        // Under the old setMonth() this returned 2026-03-04 in Buenos Aires.
        const result = addCalendarMonths({
            from: new Date('2026-02-01T00:00:00.000Z'),
            months: 1,
            dayOverflow: 'clamp'
        });
        expect(result.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    });

    it('adds a month across the day-1 case that used to come out three days SHORT', () => {
        vi.stubEnv('TZ', zone);
        // Under the old setMonth() this returned 2026-03-29 in Buenos Aires.
        const result = addCalendarMonths({
            from: new Date('2026-03-01T00:00:00.000Z'),
            months: 1,
            dayOverflow: 'clamp'
        });
        expect(result.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    });

    it('crosses a year boundary without losing the year', () => {
        vi.stubEnv('TZ', zone);
        const result = addCalendarMonths({
            from: new Date('2026-12-01T00:00:00.000Z'),
            months: 1,
            dayOverflow: 'clamp'
        });
        expect(result.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });

    it('preserves the time of day exactly', () => {
        vi.stubEnv('TZ', zone);
        const result = addCalendarMonths({
            from: new Date('2026-05-15T14:32:05.123Z'),
            months: 3,
            dayOverflow: 'clamp'
        });
        expect(result.toISOString()).toBe('2026-08-15T14:32:05.123Z');
    });

    it('walks backwards for a negative month count', () => {
        vi.stubEnv('TZ', zone);
        const result = addCalendarMonths({
            from: new Date('2026-03-01T00:00:00.000Z'),
            months: -1,
            dayOverflow: 'clamp'
        });
        expect(result.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    });

    it('returns an equal instant for zero months', () => {
        vi.stubEnv('TZ', zone);
        const from = new Date('2026-07-19T08:00:00.000Z');
        expect(addCalendarMonths({ from, months: 0, dayOverflow: 'clamp' }).toISOString()).toBe(
            from.toISOString()
        );
    });
});

describe('addCalendarMonths — the end-of-month rule', () => {
    it('clamps 31 January to the last day February has', () => {
        expect(
            addCalendarMonths({
                from: new Date('2026-01-31T00:00:00.000Z'),
                months: 1,
                dayOverflow: 'clamp'
            }).toISOString()
        ).toBe('2026-02-28T00:00:00.000Z');
    });

    it('overflows 31 January into March when told to', () => {
        expect(
            addCalendarMonths({
                from: new Date('2026-01-31T00:00:00.000Z'),
                months: 1,
                dayOverflow: 'overflow'
            }).toISOString()
        ).toBe('2026-03-03T00:00:00.000Z');
    });

    it('clamps to 29 February in a leap year, not 28', () => {
        expect(
            addCalendarMonths({
                from: new Date('2028-01-31T00:00:00.000Z'),
                months: 1,
                dayOverflow: 'clamp'
            }).toISOString()
        ).toBe('2028-02-29T00:00:00.000Z');
    });

    it('clamps 31 March to a 30-day April', () => {
        expect(
            addCalendarMonths({
                from: new Date('2026-03-31T00:00:00.000Z'),
                months: 1,
                dayOverflow: 'clamp'
            }).toISOString()
        ).toBe('2026-04-30T00:00:00.000Z');
    });

    it('leaves a day that exists in the target month untouched under either rule', () => {
        const from = new Date('2027-02-28T00:00:00.000Z');
        const clamped = addCalendarMonths({ from, months: 1, dayOverflow: 'clamp' });
        const overflowed = addCalendarMonths({ from, months: 1, dayOverflow: 'overflow' });
        expect(clamped.toISOString()).toBe('2027-03-28T00:00:00.000Z');
        expect(overflowed.toISOString()).toBe(clamped.toISOString());
    });

    it('is identical under both rules for every day 1-28, which is most subscriptions', () => {
        for (let day = 1; day <= 28; day++) {
            const from = new Date(`2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`);
            expect(addCalendarMonths({ from, months: 1, dayOverflow: 'clamp' }).toISOString()).toBe(
                addCalendarMonths({ from, months: 1, dayOverflow: 'overflow' }).toISOString()
            );
        }
    });
});

describe('addCalendarYears', () => {
    it('moves a whole year', () => {
        expect(
            addCalendarYears({
                from: new Date('2026-10-01T00:00:00.000Z'),
                years: 1,
                dayOverflow: 'clamp'
            }).toISOString()
        ).toBe('2027-10-01T00:00:00.000Z');
    });

    it('clamps 29 February onto a non-leap year', () => {
        expect(
            addCalendarYears({
                from: new Date('2028-02-29T00:00:00.000Z'),
                years: 1,
                dayOverflow: 'clamp'
            }).toISOString()
        ).toBe('2029-02-28T00:00:00.000Z');
    });

    it('overflows 29 February into 1 March when told to', () => {
        expect(
            addCalendarYears({
                from: new Date('2028-02-29T00:00:00.000Z'),
                years: 1,
                dayOverflow: 'overflow'
            }).toISOString()
        ).toBe('2029-03-01T00:00:00.000Z');
    });

    it('lands back on 29 February four years later', () => {
        expect(
            addCalendarYears({
                from: new Date('2028-02-29T00:00:00.000Z'),
                years: 4,
                dayOverflow: 'clamp'
            }).toISOString()
        ).toBe('2032-02-29T00:00:00.000Z');
    });
});

describe('addCalendarMonths — invalid input', () => {
    it('propagates an invalid date instead of silently substituting now()', () => {
        // The helpers this module replaces returned `new Date()` from a catch
        // block, so a parse failure became a plausible-looking current
        // timestamp that no caller could detect.
        const result = addCalendarMonths({
            from: new Date('not a date'),
            months: 1,
            dayOverflow: 'clamp'
        });
        expect(Number.isNaN(result.getTime())).toBe(true);
    });
});
