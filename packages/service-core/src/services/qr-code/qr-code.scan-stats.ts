import type { QrCodeScanBreakdownRow, QrCodeScanDailyRow } from '@repo/db';
import type {
    QrCodeScanBreakdown,
    QrCodeScanDailySeriesItem,
    QrCodeScanStats,
    QrCodeScanWindow
} from '@repo/schemas';
import { getLocalDayWindow } from '@repo/utils';

/**
 * Pure helpers behind {@link QrCodeService.getScanStatsForCode} (HOS-1044 §6.4).
 *
 * Kept separate from the service class, and from the DB model, for one reason:
 * these functions carry the exact behavior a wrong implementation would get
 * silently wrong (timezone-safe day boundaries, the null → `'unknown'`
 * mapping), and none of it needs a database connection to test.
 *
 * ## Why the day boundary is the ARGENTINE calendar day, not UTC
 *
 * A scan at 22:02 on a Tuesday in Argentina is 01:02 UTC on Wednesday. Bucketing
 * by UTC day therefore reports a restaurant's dinner service as the next day's
 * traffic — and dinner is precisely when a table QR gets scanned. Measured on
 * 2026-09-04: five scans at 22:02 local came back as
 * `{"2026-09-04": 1, "2026-09-05": 4}`.
 *
 * So both halves derive the day from `MARKET_TIMEZONE` (HOS-1169):
 * `QrCodeScanModel.getScanAggregateForCode` groups by
 * `DATE_TRUNC('day', scanned_at AT TIME ZONE MARKET_TIMEZONE)`, and the
 * gap-fill below takes its dates from {@link getLocalDayWindow}. **They MUST
 * come from the same helper**: if one side counts local days and the other
 * fills UTC days, the series grows holes or duplicates instead of failing
 * loudly.
 *
 * The older hazard this file used to guard against is still real and still
 * avoided: never build a boundary from local getters and serialise it with
 * `toISOString()`, which renders in UTC no matter how the `Date` was built
 * (this repo already paid for it once — 129 vs 259 rows on another "last N
 * days" window). The date strings here come from the helper, which resolves
 * them through `Intl.DateTimeFormat` in the target IANA zone, never from an
 * offset arithmetic shortcut.
 */

/** Rolling window → number of calendar days it covers. */
export const QR_SCAN_WINDOW_DAYS: Readonly<Record<QrCodeScanWindow, number>> = {
    '7d': 7,
    '30d': 30
};

/**
 * The inclusive lower bound for a `windowDays`-day rolling window ending today
 * in `MARKET_TIMEZONE`: the UTC instant of local midnight of the oldest
 * included day, ready for a `WHERE scanned_at >= $windowStart` bound.
 *
 * @param windowDays - Number of calendar days in the window (7 or 30).
 * @param now - Injectable for tests; defaults to the current instant.
 * @returns The UTC instant of local midnight of the oldest included day.
 */
export function computeScanWindowStart(windowDays: number, now: Date = new Date()): Date {
    return getLocalDayWindow({ now, windowDays }).windowStart;
}

/**
 * Gap-fills a sparse daily series (only days with at least one scan) into
 * exactly `windowDays` entries, oldest first, with `total: 0` on days with no
 * scans.
 *
 * The dates come from {@link getLocalDayWindow}, the same helper that produced
 * the `windowStart` handed to the SQL — which is what keeps the fill aligned
 * with `DATE_TRUNC('day', scanned_at AT TIME ZONE MARKET_TIMEZONE)`. Deriving
 * them here instead would put the two halves one offset apart on every scan
 * after 21:00 local.
 *
 * @param rows - Sparse per-day counts, as returned by
 *   `QrCodeScanModel.getScanAggregateForCode`.
 * @param windowDays - Number of calendar days in the window (7 or 30).
 * @param now - Injectable for tests; defaults to the current instant.
 * @returns Exactly `windowDays` items ordered by date ascending.
 */
export function gapFillQrScanDailySeries(
    rows: readonly QrCodeScanDailyRow[],
    windowDays: number,
    now: Date = new Date()
): QrCodeScanDailySeriesItem[] {
    const rowMap = new Map<string, number>(rows.map((row) => [row.date, row.total]));
    const { dates } = getLocalDayWindow({ now, windowDays });

    return dates.map((date) => ({ date, total: rowMap.get(date) ?? 0 }));
}

/**
 * Turns a raw grouped-by-value breakdown into the response shape, folding a
 * `NULL` grouping key (the column was never populated on that row) into the
 * explicit `'unknown'` bucket (HOS-1044 §6.4 / AC-7).
 *
 * `qr_code_scans.deviceType` / `.os` / `.browserLanguage` are all nullable by
 * design — a garbage or absent `User-Agent` must still count the scan — so a
 * `NULL` row here is the expected common case, never an error to filter out.
 *
 * @param rows - One row per distinct value observed, `key: null` for the
 *   scans whose derivation is missing.
 * @returns A plain record keyed by the observed value or `'unknown'`.
 */
export function buildQrScanBreakdown(rows: readonly QrCodeScanBreakdownRow[]): QrCodeScanBreakdown {
    const breakdown: Record<string, number> = {};
    for (const row of rows) {
        const key = row.key ?? 'unknown';
        breakdown[key] = (breakdown[key] ?? 0) + row.total;
    }
    return breakdown;
}

/**
 * The all-zero aggregate for a venue that has no code yet (HOS-1044 §6.4 /
 * "no code" case). Used by the route layer directly — never by the service —
 * because a venue with no `qr_codes` row has no `qrCodeId` to aggregate over,
 * and minting one on this read is forbidden (§6.2, AC-4).
 *
 * @param window - The requested rolling window.
 * @param now - Injectable for tests; defaults to the current instant.
 * @returns A fully gap-filled, all-zero {@link QrCodeScanStats}.
 */
export function buildEmptyQrCodeScanStats(
    window: QrCodeScanWindow,
    now: Date = new Date()
): QrCodeScanStats {
    return {
        window,
        total: 0,
        dailySeries: gapFillQrScanDailySeries([], QR_SCAN_WINDOW_DAYS[window], now),
        byDeviceType: {},
        byOs: {},
        byBrowserLanguage: {}
    };
}
