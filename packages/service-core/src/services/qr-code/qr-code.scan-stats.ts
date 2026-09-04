import type { QrCodeScanBreakdownRow, QrCodeScanDailyRow } from '@repo/db';
import type {
    QrCodeScanBreakdown,
    QrCodeScanDailySeriesItem,
    QrCodeScanStats,
    QrCodeScanWindow
} from '@repo/schemas';

/**
 * Pure helpers behind {@link QrCodeService.getScanStatsForCode} (HOS-1044 §6.4).
 *
 * Kept separate from the service class, and from the DB model, for one reason:
 * these functions carry the exact behavior a wrong implementation would get
 * silently wrong (timezone-safe day boundaries, the null → `'unknown'`
 * mapping), and none of it needs a database connection to test.
 *
 * ## Why every date computation goes through UTC getters, never `toISOString()`
 *
 * This repo has hit the bug once already (129 vs 259 rows on another "last N
 * days" window): building a day boundary from LOCAL date components
 * (`getFullYear()`/`getMonth()`/`getDate()`) and then serialising it with
 * `toISOString()` silently shifts the boundary by the server's UTC offset,
 * because `toISOString()` always renders in UTC regardless of how the `Date`
 * was built. The fix used by `entity-view.model.ts`'s `getDailySeries` /
 * `entity-view.service.ts`'s `gapFillHostDailySeries` — and copied verbatim
 * here — is to read `getUTCFullYear()` / `getUTCMonth()` / `getUTCDate()` off
 * "now" and reconstruct UTC midnight with `Date.UTC(...)`. Every getter used
 * below is a `getUTC*` one; introducing a bare `getFullYear()` anywhere in
 * this file reintroduces the bug, which is exactly what
 * `qr-code.scan-stats.test.ts`'s timezone-independence assertion exists to
 * catch.
 */

/** Rolling window → number of calendar days it covers. */
export const QR_SCAN_WINDOW_DAYS: Readonly<Record<QrCodeScanWindow, number>> = {
    '7d': 7,
    '30d': 30
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** UTC midnight of `now`'s calendar date — never derived from local getters. */
function utcMidnight(now: Date): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Formats a UTC-midnight-aligned `Date` as `YYYY-MM-DD`, reading UTC fields only. */
function formatUtcDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * The inclusive lower bound for a `windowDays`-day rolling window ending
 * today (UTC), i.e. `[result, now]` spans exactly `windowDays` calendar days.
 *
 * @param windowDays - Number of calendar days in the window (7 or 30).
 * @param now - Injectable for tests; defaults to the current instant.
 * @returns UTC midnight of the oldest included day.
 */
export function computeUtcWindowStart(windowDays: number, now: Date = new Date()): Date {
    const todayUtc = utcMidnight(now);
    return new Date(todayUtc.getTime() - (windowDays - 1) * MS_PER_DAY);
}

/**
 * Gap-fills a sparse daily series (only days with at least one scan) into
 * exactly `windowDays` entries, oldest first, with `total: 0` on days with no
 * scans — the same contract `gapFillHostDailySeries` provides for host views.
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
    const todayUtc = utcMidnight(now);

    const result: QrCodeScanDailySeriesItem[] = [];
    for (let dayOffset = windowDays - 1; dayOffset >= 0; dayOffset--) {
        const day = new Date(todayUtc.getTime() - dayOffset * MS_PER_DAY);
        const dateStr = formatUtcDate(day);
        result.push({ date: dateStr, total: rowMap.get(dateStr) ?? 0 });
    }

    return result;
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
