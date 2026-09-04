/**
 * Pure helpers behind `QrCodeService.getScanStatsForCode` (HOS-1044 §6.4).
 *
 * The load-bearing property here is timezone safety: this repo has hit the
 * "last N days" off-by-one bug once already (129 vs 259 rows on another
 * window), caused by building a day boundary from LOCAL date components and
 * then serialising it, which silently shifts by the server's UTC offset.
 * Every test in the "timezone safety" describe blocks sets `TZ` to a non-UTC
 * offset (Argentina, UTC-3) and asserts the UTC-correct answer regardless —
 * so a regression that swaps a `getUTCFullYear()` for a bare `getFullYear()`
 * anywhere in `qr-code.scan-stats.ts` fails these tests immediately.
 *
 * @module test/services/qr-code/qr-code.scan-stats
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    buildEmptyQrCodeScanStats,
    buildQrScanBreakdown,
    computeUtcWindowStart,
    gapFillQrScanDailySeries,
    QR_SCAN_WINDOW_DAYS
} from '../../../src/services/qr-code/qr-code.scan-stats';

describe('QR_SCAN_WINDOW_DAYS', () => {
    it('maps the two supported windows to their day counts', () => {
        expect(QR_SCAN_WINDOW_DAYS['7d']).toBe(7);
        expect(QR_SCAN_WINDOW_DAYS['30d']).toBe(30);
    });
});

describe('computeUtcWindowStart', () => {
    it('returns UTC midnight of "today" for a 1-day window', () => {
        const now = new Date('2026-01-15T14:30:00.000Z');

        const start = computeUtcWindowStart(1, now);

        expect(start.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    });

    it('goes back exactly (windowDays - 1) calendar days for a 7-day window', () => {
        const now = new Date('2026-01-15T14:30:00.000Z');

        const start = computeUtcWindowStart(7, now);

        expect(start.toISOString()).toBe('2026-01-09T00:00:00.000Z');
    });

    it('goes back exactly (windowDays - 1) calendar days for a 30-day window', () => {
        const now = new Date('2026-02-01T00:00:00.000Z');

        const start = computeUtcWindowStart(30, now);

        // Jan has 31 days: Feb 1 minus 29 days = Jan 3.
        expect(start.toISOString()).toBe('2026-01-03T00:00:00.000Z');
    });

    describe('timezone safety', () => {
        const ORIGINAL_TZ = process.env.TZ;

        beforeEach(() => {
            // Argentina, UTC-3 — chosen because it is this platform's own
            // market timezone, and because it is far enough from UTC that a
            // local-time bug would shift the boundary onto the wrong
            // calendar day rather than just the wrong hour.
            process.env.TZ = 'America/Argentina/Buenos_Aires';
        });

        afterEach(() => {
            process.env.TZ = ORIGINAL_TZ;
        });

        it('anchors to the UTC calendar day, not the shifted local one, when "now" is just after UTC midnight', () => {
            // 02:00 UTC on Jan 2 is 23:00 on Jan 1 in Buenos Aires (-3). A
            // local-time implementation would compute "today" as Jan 1.
            const now = new Date('2026-01-02T02:00:00.000Z');

            const start = computeUtcWindowStart(1, now);

            expect(start.toISOString()).toBe('2026-01-02T00:00:00.000Z');
        });

        it('produces the identical instant regardless of the process timezone', () => {
            const now = new Date('2026-01-02T02:00:00.000Z');
            const underBuenosAires = computeUtcWindowStart(7, now);

            process.env.TZ = 'UTC';
            const underUtc = computeUtcWindowStart(7, now);

            expect(underBuenosAires.toISOString()).toBe(underUtc.toISOString());
        });
    });
});

describe('gapFillQrScanDailySeries', () => {
    it('returns exactly windowDays entries, oldest first', () => {
        const now = new Date('2026-01-15T12:00:00.000Z');

        const series = gapFillQrScanDailySeries([], 7, now);

        expect(series).toHaveLength(7);
        expect(series[0]?.date).toBe('2026-01-09');
        expect(series[6]?.date).toBe('2026-01-15');
    });

    it('fills every day with total: 0 when there are no rows', () => {
        const now = new Date('2026-01-15T12:00:00.000Z');

        const series = gapFillQrScanDailySeries([], 7, now);

        expect(series.every((item) => item.total === 0)).toBe(true);
    });

    /**
     * AC-6: a scan writes one row, and the daily series places it on the day
     * of `scannedAt` — verified here at the gap-fill boundary, which is the
     * function that decides which bucket a raw aggregate row lands in.
     */
    it('places a single scan on its own day and leaves every other day at zero (AC-6)', () => {
        const now = new Date('2026-01-15T12:00:00.000Z');

        const series = gapFillQrScanDailySeries([{ date: '2026-01-12', total: 1 }], 7, now);

        const day12 = series.find((item) => item.date === '2026-01-12');
        expect(day12?.total).toBe(1);

        const otherDays = series.filter((item) => item.date !== '2026-01-12');
        expect(otherDays.every((item) => item.total === 0)).toBe(true);
    });

    it('ignores a raw row whose date falls outside the requested window', () => {
        const now = new Date('2026-01-15T12:00:00.000Z');

        const series = gapFillQrScanDailySeries([{ date: '2025-12-01', total: 99 }], 7, now);

        expect(series.reduce((sum, item) => sum + item.total, 0)).toBe(0);
    });

    describe('timezone safety', () => {
        const ORIGINAL_TZ = process.env.TZ;

        beforeEach(() => {
            process.env.TZ = 'America/Argentina/Buenos_Aires';
        });

        afterEach(() => {
            process.env.TZ = ORIGINAL_TZ;
        });

        it('keys the last day of the series by the UTC calendar date, not the local one', () => {
            // Same boundary case as computeUtcWindowStart's own test: 02:00 UTC
            // on Jan 2 is still Jan 1 in Buenos Aires local time.
            const now = new Date('2026-01-02T02:00:00.000Z');

            const series = gapFillQrScanDailySeries([{ date: '2026-01-02', total: 4 }], 1, now);

            expect(series).toEqual([{ date: '2026-01-02', total: 4 }]);
        });
    });
});

describe('buildQrScanBreakdown', () => {
    it('returns an empty record for no rows', () => {
        expect(buildQrScanBreakdown([])).toEqual({});
    });

    it('keeps an observed value under its own key', () => {
        const breakdown = buildQrScanBreakdown([{ key: 'MOBILE', total: 3 }]);

        expect(breakdown).toEqual({ MOBILE: 3 });
    });

    /**
     * AC-7: a row whose derivation is NULL (garbage or absent User-Agent)
     * still counts — it falls into the explicit 'unknown' bucket rather than
     * being dropped.
     */
    it('folds a null key into the explicit "unknown" bucket (AC-7)', () => {
        const breakdown = buildQrScanBreakdown([{ key: null, total: 2 }]);

        expect(breakdown).toEqual({ unknown: 2 });
    });

    it('sums multiple rows that collapse into the same bucket', () => {
        const breakdown = buildQrScanBreakdown([
            { key: null, total: 2 },
            { key: null, total: 3 },
            { key: 'IOS', total: 5 }
        ]);

        expect(breakdown).toEqual({ unknown: 5, IOS: 5 });
    });

    it('keeps unknown and an observed value as independent buckets summing to the total', () => {
        const rows = [
            { key: 'MOBILE', total: 4 },
            { key: null, total: 1 }
        ];

        const breakdown = buildQrScanBreakdown(rows);
        const sum = Object.values(breakdown).reduce((a, b) => a + b, 0);

        expect(sum).toBe(5);
        expect(breakdown.unknown).toBe(1);
    });
});

describe('buildEmptyQrCodeScanStats', () => {
    it('echoes the requested window and reports every count at zero', () => {
        const now = new Date('2026-01-15T12:00:00.000Z');

        const stats = buildEmptyQrCodeScanStats('7d', now);

        expect(stats.window).toBe('7d');
        expect(stats.total).toBe(0);
        expect(stats.byDeviceType).toEqual({});
        expect(stats.byOs).toEqual({});
        expect(stats.byBrowserLanguage).toEqual({});
    });

    it('gap-fills the daily series to the full window length', () => {
        const now = new Date('2026-01-15T12:00:00.000Z');

        const stats = buildEmptyQrCodeScanStats('30d', now);

        expect(stats.dailySeries).toHaveLength(30);
        expect(stats.dailySeries.every((item) => item.total === 0)).toBe(true);
    });
});
