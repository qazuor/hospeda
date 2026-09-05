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
    computeScanWindowStart,
    gapFillQrScanDailySeries,
    QR_SCAN_WINDOW_DAYS
} from '../../../src/services/qr-code/qr-code.scan-stats';

describe('QR_SCAN_WINDOW_DAYS', () => {
    it('maps the two supported windows to their day counts', () => {
        expect(QR_SCAN_WINDOW_DAYS['7d']).toBe(7);
        expect(QR_SCAN_WINDOW_DAYS['30d']).toBe(30);
    });
});

describe('computeScanWindowStart', () => {
    // Every expectation below is the UTC instant of ARGENTINE local midnight
    // (HOS-1169), which is 03:00Z of the same date — not 00:00Z. A window
    // anchored on the UTC day reports a restaurant's dinner service as the next
    // day's traffic, which is the whole reason this moved.
    it('returns local midnight of "today" for a 1-day window', () => {
        const now = new Date('2026-01-15T14:30:00.000Z');

        const start = computeScanWindowStart(1, now);

        expect(start.toISOString()).toBe('2026-01-15T03:00:00.000Z');
    });

    it('goes back exactly (windowDays - 1) calendar days for a 7-day window', () => {
        const now = new Date('2026-01-15T14:30:00.000Z');

        const start = computeScanWindowStart(7, now);

        expect(start.toISOString()).toBe('2026-01-09T03:00:00.000Z');
    });

    it('goes back exactly (windowDays - 1) calendar days for a 30-day window', () => {
        // 00:00Z on Feb 1 is 21:00 on Jan 31 in Argentina, so "today" is Jan 31
        // locally — one day EARLIER than the UTC date. A 30-day window from
        // Jan 31 therefore starts on Jan 2, not Jan 3.
        const now = new Date('2026-02-01T00:00:00.000Z');

        const start = computeScanWindowStart(30, now);

        expect(start.toISOString()).toBe('2026-01-02T03:00:00.000Z');
    });

    it('puts a 22:00 local scan inside TODAY, not tomorrow (the HOS-1169 bug)', () => {
        // The measured incident: 22:02 on Sep 4 in Argentina is 01:02Z on Sep 5.
        // A UTC-anchored window called that "Sep 5" and moved the whole dinner
        // service to the next day.
        const now = new Date('2026-09-05T01:02:18.000Z');

        const start = computeScanWindowStart(1, now);

        // Local midnight of Sep 4 — so the 22:02 scan falls inside the window.
        expect(start.toISOString()).toBe('2026-09-04T03:00:00.000Z');
        expect(start.getTime()).toBeLessThan(now.getTime());
    });

    describe('timezone safety', () => {
        const ORIGINAL_TZ = process.env.TZ;

        afterEach(() => {
            process.env.TZ = ORIGINAL_TZ;
        });

        it('produces the identical instant regardless of the process timezone', () => {
            // The zone is resolved from MARKET_TIMEZONE, never from the host's
            // TZ, so a server running in UTC and one running in Buenos Aires
            // must agree. This is the assertion that would catch someone
            // "simplifying" the helper into local getters.
            const now = new Date('2026-01-02T02:00:00.000Z');

            process.env.TZ = 'America/Argentina/Buenos_Aires';
            const underBuenosAires = computeScanWindowStart(7, now);

            process.env.TZ = 'UTC';
            const underUtc = computeScanWindowStart(7, now);

            process.env.TZ = 'Asia/Tokyo';
            const underTokyo = computeScanWindowStart(7, now);

            expect(underBuenosAires.toISOString()).toBe(underUtc.toISOString());
            expect(underBuenosAires.toISOString()).toBe(underTokyo.toISOString());
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

        it('keys the last day of the series by the LOCAL calendar date (HOS-1169)', () => {
            // 02:00Z on Jan 2 is 23:00 on Jan 1 in Argentina, so the local day
            // is still Jan 1 — which is the day the owner is looking at.
            const now = new Date('2026-01-02T02:00:00.000Z');

            const series = gapFillQrScanDailySeries([{ date: '2026-01-01', total: 4 }], 1, now);

            expect(series).toEqual([{ date: '2026-01-01', total: 4 }]);
        });

        it('fills the day the SQL would emit, so a late-evening scan is not orphaned', () => {
            // The two halves must agree on the day. The model groups by
            // `DATE_TRUNC('day', scanned_at AT TIME ZONE MARKET_TIMEZONE)`, so a
            // 22:02 local scan is keyed '2026-09-04'. If the fill still built UTC
            // days it would emit '2026-09-05' and the row would land in NO
            // bucket: the total would say 4 and every day would show 0.
            const now = new Date('2026-09-05T01:02:18.000Z');

            const series = gapFillQrScanDailySeries([{ date: '2026-09-04', total: 4 }], 1, now);

            expect(series).toEqual([{ date: '2026-09-04', total: 4 }]);
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
