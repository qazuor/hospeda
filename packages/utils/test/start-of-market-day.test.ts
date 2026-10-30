/**
 * TEST:U2:6 (AC:U2:6, HOS-1424) — every window in days is computed on the
 * calendar of `America/Argentina/Buenos_Aires`, and the instant is stored in UTC.
 *
 * The process time zone is forced (UTC first, which is what production and CI
 * run), so a version that read the process's own clock would land on the UTC
 * calendar day near midnight and fail here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalDateString, MARKET_TIMEZONE, startOfMarketDay } from '../src/local-day';

const PROCESS_ZONES = ['UTC', 'America/Argentina/Buenos_Aires', 'Asia/Tokyo'] as const;

afterEach(() => {
    vi.unstubAllEnvs();
});

describe.each(PROCESS_ZONES)('TEST:U2:6 startOfMarketDay under process TZ=%s', (zone) => {
    beforeEach(() => {
        vi.stubEnv('TZ', zone);
    });

    it('takes the Buenos Aires day, not the UTC one, just before BA midnight', () => {
        // Arrange: 23:59:30 on 6 October in Buenos Aires is already 7 October in UTC.
        const instant = new Date('2026-10-07T02:59:30.000Z');

        // Act
        const start = startOfMarketDay({ instant });

        // Assert
        expect(start.toISOString()).toBe('2026-10-06T03:00:00.000Z');
    });

    it('starts the next day exactly at BA midnight', () => {
        // Arrange: 00:00:00 on 7 October in Buenos Aires.
        const instant = new Date('2026-10-07T03:00:00.000Z');

        // Act
        const start = startOfMarketDay({ instant });

        // Assert
        expect(start.toISOString()).toBe('2026-10-07T03:00:00.000Z');
    });

    it('"three days before" a target lands on a BA calendar day, also near midnight', () => {
        // Arrange: the target is 22:30 on 9 October in Buenos Aires (10 October in UTC).
        const target = new Date('2026-10-10T01:30:00.000Z');

        // Act
        const notice = startOfMarketDay({ instant: target, offsetDays: -3 });

        // Assert: 6 October in Buenos Aires, a calendar day and not target - 72h.
        expect(getLocalDateString({ instant: notice, timeZone: MARKET_TIMEZONE })).toBe(
            '2026-10-06'
        );
        expect(notice.toISOString()).toBe('2026-10-06T03:00:00.000Z');
        expect(notice.getTime()).not.toBe(target.getTime() - 3 * 24 * 60 * 60 * 1000);
    });

    it('crosses month and year boundaries on the calendar', () => {
        // Arrange: 21:00 on 2 January 2027 in Buenos Aires.
        const instant = new Date('2027-01-03T00:00:00.000Z');

        // Act
        const start = startOfMarketDay({ instant, offsetDays: -3 });

        // Assert
        expect(start.toISOString()).toBe('2026-12-30T03:00:00.000Z');
    });

    it('returns a UTC instant: what gets stored is the same moment whatever the process zone', () => {
        // Arrange
        const instant = new Date('2026-10-07T12:00:00.000Z');

        // Act
        const start = startOfMarketDay({ instant });

        // Assert: the ISO form is UTC (Z), 00:00 -03:00 of the BA day.
        expect(start.toISOString()).toMatch(/Z$/);
        expect(start.getTime()).toBe(Date.UTC(2026, 9, 7, 3, 0, 0));
    });
});

describe('startOfMarketDay input validation', () => {
    it('rejects a fractional offset', () => {
        expect(() => startOfMarketDay({ offsetDays: 1.5 })).toThrow();
    });
});
