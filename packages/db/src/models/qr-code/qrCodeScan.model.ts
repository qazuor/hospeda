import type { QrCodeScan } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { qrCodeScans } from '../../schemas/qr-code/qr_code_scan.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/** Input to {@link QrCodeScanModel.getScanAggregateForCode}. */
export interface QrCodeScanAggregateInput {
    /** The code whose scans are being read. Counting is by code, never by entity. */
    readonly qrCodeId: string;
    /**
     * Inclusive lower bound, expected to be UTC midnight of the oldest day the
     * caller wants included. Computed by the SERVICE layer
     * (`computeUtcWindowStart`) — this model does not know about "windows",
     * only about a timestamp to filter from, so a timezone mistake cannot be
     * introduced twice.
     */
    readonly windowStart: Date;
}

/** One day of raw (non-gap-filled) scan counts. Gap-filling is a service concern. */
export interface QrCodeScanDailyRow {
    /** Calendar date in `YYYY-MM-DD`, UTC. */
    readonly date: string;
    readonly total: number;
}

/**
 * One value of a breakdown dimension (`deviceType` / `os` / `browserLanguage`)
 * and its count. `key` is `null` when the column itself was `NULL` on the
 * grouped rows — turning that into the `'unknown'` bucket is a SERVICE
 * concern (`buildQrScanBreakdown`), kept out of the model so the raw grouping
 * result stays a faithful mirror of what the database actually holds.
 */
export interface QrCodeScanBreakdownRow {
    readonly key: string | null;
    readonly total: number;
}

/** Raw aggregate for one code over one window. Nothing here is gap-filled. */
export interface QrCodeScanAggregate {
    readonly total: number;
    readonly dailySeries: readonly QrCodeScanDailyRow[];
    readonly byDeviceType: readonly QrCodeScanBreakdownRow[];
    readonly byOs: readonly QrCodeScanBreakdownRow[];
    readonly byBrowserLanguage: readonly QrCodeScanBreakdownRow[];
}

/** Raw row shape shared by the total and the three breakdown queries. */
interface RawCountRow extends Record<string, unknown> {
    total: string | number;
}

/** Raw row shape for a breakdown query — carries the grouping key alongside the count. */
interface RawKeyedCountRow extends RawCountRow {
    key: string | null;
}

/** Raw row shape for the daily-series query. */
interface RawDailyRow extends RawCountRow {
    date: string;
}

/**
 * Normalises the two shapes a raw `db.execute()` call can return: a bare
 * array (postgres-js driver) or `{ rows: [...] }` (node-postgres driver).
 * Mirrors the same helper duplicated in `entity-view.model.ts` and
 * `user.model.ts` — kept local rather than shared because each caller's raw
 * row type differs and a shared generic would buy nothing here.
 */
function extractRows<T>(result: unknown): T[] {
    return Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] }).rows ?? []);
}

/**
 * Model for `qr_code_scans` (HOS-981, widened by HOS-1141 and HOS-1044).
 *
 * Append-only: a scan is an event, so there is nothing to update and no soft
 * delete. See the table's own comment for why the row carries the raw
 * user-agent alongside its derivations and no IP address.
 */
export class QrCodeScanModel extends BaseModelImpl<QrCodeScan> {
    protected table = qrCodeScans;
    public entityName = 'qr_code_scans';

    protected getTableName(): string {
        return 'qrCodeScans';
    }

    /**
     * Reads the raw aggregate for ONE `qrCodeId` over `[windowStart, now]`
     * (HOS-1044 §6.4): a total, a per-day count, and per-value counts for
     * `deviceType`, `os` and `browserLanguage`.
     *
     * Five independent raw queries rather than one combined one — the table
     * is indexed on `qrCodeId` and on `scannedAt`, each query is a cheap
     * bounded scan, and four small `GROUP BY`s read far more plainly than one
     * `GROUPING SETS` query. Raw `sql` (matching `EntityViewModel.
     * getDailySeries` and `ConversationModel.getMonthlyInquiriesByOwnerId`)
     * rather than the chained query builder, because `to_char(date_trunc(...))`
     * has no typed Drizzle helper — every value is still bound through the
     * tagged template, never string-interpolated.
     *
     * Deliberately does NOT collapse a `NULL` grouping key: `deviceType` /
     * `os` / `browserLanguage` are all nullable by design (a garbage or
     * absent `User-Agent` must still count the scan), and turning `NULL` into
     * the `'unknown'` bucket is the caller's job ({@link QrCodeScanBreakdownRow}).
     *
     * @param input - The code id and the inclusive window start.
     * @param tx - Optional transaction client.
     * @returns The raw (non-gap-filled) aggregate.
     * @throws {DbError} When any of the underlying queries fails.
     */
    async getScanAggregateForCode(
        input: QrCodeScanAggregateInput,
        tx?: DrizzleClient
    ): Promise<QrCodeScanAggregate> {
        const { qrCodeId, windowStart } = input;
        const db = this.getClient(tx);
        const logContext = { qrCodeId, windowStart };

        try {
            const [totalResult, dailyResult, deviceResult, osResult, languageResult] =
                await Promise.all([
                    db.execute<RawCountRow>(sql`
                        SELECT COUNT(*)::int AS total
                        FROM qr_code_scans
                        WHERE qr_code_id = ${qrCodeId} AND scanned_at >= ${windowStart}
                    `),
                    db.execute<RawDailyRow>(sql`
                        SELECT
                            to_char(DATE_TRUNC('day', scanned_at), 'YYYY-MM-DD') AS "date",
                            COUNT(*)::int AS total
                        FROM qr_code_scans
                        WHERE qr_code_id = ${qrCodeId} AND scanned_at >= ${windowStart}
                        GROUP BY DATE_TRUNC('day', scanned_at)
                        ORDER BY "date" ASC
                    `),
                    db.execute<RawKeyedCountRow>(sql`
                        SELECT device_type AS "key", COUNT(*)::int AS total
                        FROM qr_code_scans
                        WHERE qr_code_id = ${qrCodeId} AND scanned_at >= ${windowStart}
                        GROUP BY device_type
                    `),
                    db.execute<RawKeyedCountRow>(sql`
                        SELECT os AS "key", COUNT(*)::int AS total
                        FROM qr_code_scans
                        WHERE qr_code_id = ${qrCodeId} AND scanned_at >= ${windowStart}
                        GROUP BY os
                    `),
                    db.execute<RawKeyedCountRow>(sql`
                        SELECT browser_language AS "key", COUNT(*)::int AS total
                        FROM qr_code_scans
                        WHERE qr_code_id = ${qrCodeId} AND scanned_at >= ${windowStart}
                        GROUP BY browser_language
                    `)
                ]);

            const totalRows = extractRows<RawCountRow>(totalResult);

            const result: QrCodeScanAggregate = {
                // Drizzle types COUNT(*) as bigint-ish but the pg driver returns
                // it as a string when not cast — the explicit Number() coercion
                // is required regardless of the ::int cast above.
                total: Number(totalRows[0]?.total ?? 0),
                dailySeries: extractRows<RawDailyRow>(dailyResult).map((row) => ({
                    date: row.date,
                    total: Number(row.total)
                })),
                byDeviceType: extractRows<RawKeyedCountRow>(deviceResult).map((row) => ({
                    key: row.key,
                    total: Number(row.total)
                })),
                byOs: extractRows<RawKeyedCountRow>(osResult).map((row) => ({
                    key: row.key,
                    total: Number(row.total)
                })),
                byBrowserLanguage: extractRows<RawKeyedCountRow>(languageResult).map((row) => ({
                    key: row.key,
                    total: Number(row.total)
                }))
            };

            try {
                logQuery('qr_code_scans', 'getScanAggregateForCode', logContext, {
                    total: result.total
                });
            } catch {}

            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError('qr_code_scans', 'getScanAggregateForCode', logContext, err);
            } catch {}
            throw new DbError('qr_code_scans', 'getScanAggregateForCode', logContext, err.message);
        }
    }
}

/** Singleton instance of QrCodeScanModel for use across the application. */
export const qrCodeScanModel = new QrCodeScanModel();
