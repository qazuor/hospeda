/**
 * Tests for local calendar-day windows (HOS-1169).
 *
 * Every assertion runs under several process time zones (via `vi.stubEnv`)
 * spanning UTC-3 to UTC+14. This module's whole point is that its answer
 * depends on the IANA zone it is TOLD to use, never on the process's own
 * clock — a test that only runs under one process TZ cannot tell that
 * implementation apart from one that silently reads `Date.getHours()`
 * instead of `Intl.DateTimeFormat({ timeZone })`, which is exactly the bug
 * this module exists to prevent (see `utc-date-math.test.ts` for the same
 * lesson learned the hard way under HOS-1010).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getLocalDateString,
    getLocalDayWindow,
    getUtcInstantForLocalMidnight,
    MARKET_TIMEZONE
} from '../src/local-day';

const PROCESS_ZONES = [
    'UTC',
    'America/Argentina/Buenos_Aires',
    'Asia/Tokyo',
    'Pacific/Kiritimati'
] as const;

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('MARKET_TIMEZONE', () => {
    it('is the Argentina IANA zone', () => {
        expect(MARKET_TIMEZONE).toBe('America/Argentina/Buenos_Aires');
    });
});

describe.each(PROCESS_ZONES)('getLocalDateString under process TZ=%s', (zone) => {
    beforeEach(() => {
        vi.stubEnv('TZ', zone);
    });

    it('HOS-1169 regression: a 22:02 Argentina-local scan stays on ITS day, not the next UTC day', () => {
        // 2026-09-04T22:02:18-03:00 == 2026-09-05T01:02:18.000Z. The bug this
        // fixes was DATE_TRUNC('day', viewed_at) in UTC reporting this as
        // 2026-09-05 — the exact five-scan incident that opened HOS-1169.
        const instant = new Date('2026-09-05T01:02:18.000Z');
        expect(getLocalDateString({ instant, timeZone: MARKET_TIMEZONE })).toBe('2026-09-04');
    });

    it('HOS-1169 regression: a 00:30 Argentina-local event stays on ITS day, not the previous one', () => {
        // 2026-09-04T00:30:00-03:00 == 2026-09-04T03:30:00.000Z.
        const instant = new Date('2026-09-04T03:30:00.000Z');
        expect(getLocalDateString({ instant, timeZone: MARKET_TIMEZONE })).toBe('2026-09-04');
    });

    it('a UTC-daytime instant with no boundary crossing resolves to the same calendar day', () => {
        // 2026-09-04T15:00:00Z == 2026-09-04T12:00:00-03:00 — well clear of
        // either boundary, so both zones would agree; asserted anyway as a
        // non-edge-case sanity check.
        const instant = new Date('2026-09-04T15:00:00.000Z');
        expect(getLocalDateString({ instant, timeZone: MARKET_TIMEZONE })).toBe('2026-09-04');
    });

    it('defaults to MARKET_TIMEZONE when no timeZone is given', () => {
        const instant = new Date('2026-09-05T01:02:18.000Z');
        expect(getLocalDateString({ instant })).toBe('2026-09-04');
    });
});

describe.each(PROCESS_ZONES)('getUtcInstantForLocalMidnight under process TZ=%s', (zone) => {
    beforeEach(() => {
        vi.stubEnv('TZ', zone);
    });

    it('maps a local calendar date to 03:00 UTC (00:00 -03:00) in Argentina', () => {
        const result = getUtcInstantForLocalMidnight({
            date: '2026-09-04',
            timeZone: MARKET_TIMEZONE
        });
        expect(result.toISOString()).toBe('2026-09-04T03:00:00.000Z');
    });

    it('round-trips with getLocalDateString: local midnight of D is still on day D', () => {
        const midnight = getUtcInstantForLocalMidnight({
            date: '2026-09-04',
            timeZone: MARKET_TIMEZONE
        });
        expect(getLocalDateString({ instant: midnight, timeZone: MARKET_TIMEZONE })).toBe(
            '2026-09-04'
        );
    });

    it('one millisecond before local midnight is still the PREVIOUS local day', () => {
        const midnight = getUtcInstantForLocalMidnight({
            date: '2026-09-04',
            timeZone: MARKET_TIMEZONE
        });
        const justBefore = new Date(midnight.getTime() - 1);
        expect(getLocalDateString({ instant: justBefore, timeZone: MARKET_TIMEZONE })).toBe(
            '2026-09-03'
        );
    });

    it('throws on a malformed date string', () => {
        expect(() => getUtcInstantForLocalMidnight({ date: '2026-9-4' })).toThrow();
    });
});

describe.each(PROCESS_ZONES)('getLocalDayWindow under process TZ=%s', (zone) => {
    beforeEach(() => {
        vi.stubEnv('TZ', zone);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('HOS-1169 regression: "now" pinned to 22:02 Argentina-local time yields TODAY as the last date, not tomorrow', () => {
        // Same instant as the real incident: 2026-09-04T22:02:18-03:00.
        vi.setSystemTime(new Date('2026-09-05T01:02:18.000Z'));

        const { dates } = getLocalDayWindow({ windowDays: 3 });

        expect(dates).toEqual(['2026-09-02', '2026-09-03', '2026-09-04']);
        expect(dates.at(-1)).toBe('2026-09-04');
        expect(dates).not.toContain('2026-09-05');
    });

    it('produces exactly windowDays dates, oldest first, ending on the local today', () => {
        vi.setSystemTime(new Date('2026-06-10T14:30:00.000Z')); // mid-afternoon UTC, not a boundary case
        const { dates } = getLocalDayWindow({ windowDays: 30 });

        expect(dates).toHaveLength(30);
        expect(dates[0]).toBe('2026-05-12');
        expect(dates.at(-1)).toBe('2026-06-10');
    });

    it('windowStart is local midnight of the OLDEST date in `dates`, as a valid SQL lower bound', () => {
        vi.setSystemTime(new Date('2026-06-10T14:30:00.000Z'));
        const { windowStart, dates } = getLocalDayWindow({ windowDays: 30 });

        expect(dates[0]).toBe('2026-05-12');
        expect(windowStart.toISOString()).toBe('2026-05-12T03:00:00.000Z'); // 00:00 -03:00
    });

    it('SQL windowStart and JS gap-fill dates agree on the day boundary (no gaps, no duplicates)', () => {
        // The exact invariant the bug report calls out: the two sides of a
        // daily series MUST use the same day criterion or the series either
        // gaps or double-counts at the edges.
        vi.setSystemTime(new Date('2026-09-05T01:02:18.000Z')); // 22:02 Ar-local on the 4th
        const { windowStart, dates } = getLocalDayWindow({ windowDays: 5 });

        // The scan from the real incident (22:02 Ar-local, 2026-09-04) must be
        // >= windowStart (so the SQL query would include it)...
        const scanInstant = new Date('2026-09-05T01:02:18.000Z');
        expect(scanInstant.getTime()).toBeGreaterThanOrEqual(windowStart.getTime());

        // ...AND its local calendar day must be present in the gap-fill list
        // (so the service can find a bucket for the row the SQL returns).
        const scanLocalDate = getLocalDateString({ instant: scanInstant });
        expect(dates).toContain(scanLocalDate);
    });

    it('windowDays = 1 returns a single date equal to local today', () => {
        vi.setSystemTime(new Date('2026-09-05T01:02:18.000Z'));
        const { dates } = getLocalDayWindow({ windowDays: 1 });
        expect(dates).toEqual(['2026-09-04']);
    });

    it('throws when windowDays is less than 1', () => {
        expect(() => getLocalDayWindow({ windowDays: 0 })).toThrow();
    });
});
