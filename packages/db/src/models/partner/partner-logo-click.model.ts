/**
 * @file partner-logo-click.model.ts
 *
 * Lean, standalone model for the `partner_logo_clicks` append-only telemetry
 * table (HOS-1063 A-3).
 *
 * **Why NOT BaseModelImpl:** the same reason `EntityViewModel` is standalone —
 * `BaseModelImpl` hard-assumes `deletedAt`, `updatedAt` and the audit columns
 * this table intentionally omits, and would inherit `softDelete()` / `update()`
 * methods that throw at runtime against columns that do not exist.
 *
 * **Dedup semantics** match `EntityViewModel.getStatsForEntities` exactly, and
 * that is deliberate rather than convenient: the panel shows a views number and
 * a clicks number side by side, and two numbers computed by two different rules
 * invite a comparison that means nothing.
 *   - `unique` = COUNT(DISTINCT visitor_hash) in the window.
 *   - `total`  = COUNT(DISTINCT (visitor_hash, 30-minute bucket)) — a visitor
 *                who clicks the same logo three times in five minutes is one
 *                click, not three, so a partner cannot inflate their own number
 *                by clicking it.
 *
 * @see packages/db/src/schemas/partner/partner_logo_click.dbschema.ts
 * @see packages/db/src/models/entity-view/entity-view.model.ts — the mould.
 */

import type { PartnerLogoClickDestination } from '@repo/schemas';
import { getLocalDayWindow, getLocalMonthWindow } from '@repo/utils';
import { lt, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import type {
    InsertPartnerLogoClick,
    SelectPartnerLogoClick
} from '../../schemas/partner/partner_logo_click.dbschema.ts';
import { partnerLogoClicks } from '../../schemas/partner/partner_logo_click.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

// ─── Input / output types ────────────────────────────────────────────────────

/** Input to record a single logo-click event. */
export interface InsertLogoClickInput {
    /** UUID of the partner whose logo was clicked. */
    readonly partnerId: string;
    /**
     * Salted daily hash of the visitor fingerprint, or `'user:<uuid>'` for an
     * authenticated visitor. Never a raw IP.
     */
    readonly visitorHash: string;
    /** Which of the two linking branches the click followed. */
    readonly destination: PartnerLogoClickDestination;
}

/** Input to aggregate one partner's clicks over a rolling window. */
export interface GetClickStatsForPartnerInput {
    /** UUID of the partner to aggregate. */
    readonly partnerId: string;
    /** Rolling window in days. The panel uses 7 and 30 only. */
    readonly windowDays: number;
}

/** Aggregated click counts for one partner over a window. */
export interface PartnerLogoClickStats {
    /** Distinct visitor fingerprints that clicked in the window. */
    readonly unique: number;
    /** Deduplicated total clicks in the window (30-minute bucket rule). */
    readonly total: number;
}

/** Input to purge click rows older than a threshold. */
export interface PurgeClicksOlderThanInput {
    /**
     * Rows with `clicked_at < NOW() - interval '<days> days'` are hard-deleted.
     * The TTL cron uses the same 95-day horizon as `entity_views`.
     */
    readonly days: number;
}

/**
 * Raw aggregation row. Drizzle returns numeric aggregates as strings from the
 * pg driver, so `Number()` coercion is applied before returning.
 */
interface RawClickStatsRow extends Record<string, unknown> {
    unique: string | number;
    total: string | number;
}

// ─── Model ───────────────────────────────────────────────────────────────────

/**
 * Standalone model for the `partner_logo_clicks` telemetry table.
 *
 * All methods accept an optional `tx` to participate in an outer transaction;
 * when omitted they use the singleton from `getDb()`.
 */
export class PartnerLogoClickModel {
    /** Returns the provided tx if available, otherwise the global db client. */
    private getClient(tx?: DrizzleClient): DrizzleClient {
        return tx ?? getDb();
    }

    /**
     * Appends a single logo-click event.
     *
     * No synchronous dedup check on insert — the same insert-always strategy
     * `entity_views` uses. Deduplication is applied at query time by
     * {@link getStatsForPartner}.
     *
     * @param input - The click event to record.
     * @param tx - Optional transaction client.
     * @returns The inserted row.
     * @throws {DbError} If the database operation fails.
     */
    async insertClick(
        input: InsertLogoClickInput,
        tx?: DrizzleClient
    ): Promise<SelectPartnerLogoClick> {
        const db = this.getClient(tx);
        const logContext = { partnerId: input.partnerId, destination: input.destination };

        try {
            const row: InsertPartnerLogoClick = {
                partnerId: input.partnerId,
                visitorHash: input.visitorHash,
                destination: input.destination
                // clickedAt has defaultNow() — omitted so the DB sets it
            };

            const [inserted] = await db.insert(partnerLogoClicks).values(row).returning();

            if (!inserted) {
                throw new Error('Insert returned no row');
            }

            try {
                logQuery('partnerLogoClicks', 'insertClick', logContext, { id: inserted.id });
            } catch {}

            return inserted;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError('partnerLogoClicks', 'insertClick', logContext, err);
            } catch {}
            throw new DbError('partnerLogoClicks', 'insertClick', logContext, err.message);
        }
    }

    /**
     * Returns deduplicated click counts for one partner over a rolling window.
     *
     * A partner with no clicks in the window yields `{ unique: 0, total: 0 }`
     * rather than an absent row — unlike `getStatsForEntities`, which omits
     * entities with no rows and leaves zero-filling to its service. There is
     * exactly one partner here and a caller that has to remember to zero-fill a
     * single scalar is a caller that will one day render `undefined`.
     *
     * **Window semantics** are anchored to local midnight (`MARKET_TIMEZONE`)
     * of the oldest calendar date in the range, matching `EntityViewModel`
     * (HOS-1169) so the clicks number and the views number beside it cover the
     * same days.
     *
     * @param input - partnerId and windowDays.
     * @param tx - Optional transaction client.
     * @returns Deduplicated `{ unique, total }`, zeroed when there are no rows.
     * @throws {DbError} If the database operation fails.
     */
    async getStatsForPartner(
        input: GetClickStatsForPartnerInput,
        tx?: DrizzleClient
    ): Promise<PartnerLogoClickStats> {
        const { partnerId, windowDays } = input;
        const db = this.getClient(tx);
        const logContext = { partnerId, windowDays };

        try {
            const { windowStart } = getLocalDayWindow({ windowDays });

            const rows = await db.execute<RawClickStatsRow>(sql`
                SELECT
                    COUNT(DISTINCT visitor_hash)::int                             AS "unique",
                    COUNT(DISTINCT (
                        visitor_hash,
                        FLOOR(EXTRACT(EPOCH FROM clicked_at) / 1800)
                    ))::int                                                      AS "total"
                FROM partner_logo_clicks
                WHERE partner_id = ${partnerId}::uuid
                  AND clicked_at >= ${windowStart}
            `);

            const rawRows: RawClickStatsRow[] = Array.isArray(rows)
                ? (rows as RawClickStatsRow[])
                : ((rows as { rows?: RawClickStatsRow[] }).rows ?? []);

            const first = rawRows[0];
            const stats: PartnerLogoClickStats = {
                unique: Number(first?.unique ?? 0),
                total: Number(first?.total ?? 0)
            };

            try {
                logQuery('partnerLogoClicks', 'getStatsForPartner', logContext, stats);
            } catch {}

            return stats;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError('partnerLogoClicks', 'getStatsForPartner', logContext, err);
            } catch {}
            throw new DbError('partnerLogoClicks', 'getStatsForPartner', logContext, err.message);
        }
    }

    /**
     * Aggregates one calendar month of clicks into
     * `partner_logo_click_monthly_rollups`, for every partner that has any.
     *
     * Written as a single `INSERT … SELECT … ON CONFLICT DO UPDATE` so the whole
     * month is one statement: no rows travel to the application, and a re-run
     * over a month whose source rows still exist CORRECTS the stored totals
     * instead of duplicating them. That idempotency is not a nicety — repairing
     * a failed cron run is the normal reason this is invoked a second time.
     *
     * ## The month boundaries are resolved in TypeScript, not in SQL
     *
     * Identical treatment to `EntityViewModel.rollUpMonth`, and for the same two
     * reasons, the first of which is fatal rather than cosmetic:
     *
     * 1. **The `DATE_TRUNC(... AT TIME ZONE $tz)` form could not execute.**
     *    `MARKET_TIMEZONE` is a plain string, so each interpolation emitted a
     *    DISTINCT placeholder and Postgres compares `GROUP BY` expressions by
     *    node identity, not by bound value — the statement was rejected at parse
     *    time on every run. Resolving the bounds in TypeScript removes the zone
     *    from the statement entirely. (`marketTimezoneSql()` in
     *    `../../utils/drizzle-helpers.ts` is the fix where the zone genuinely
     *    has to be inside SQL; here it does not.)
     * 2. **`WHERE DATE_TRUNC(...)` is not sargable**, so
     *    `partnerLogoClicks_clickedAt_idx` went unused and the table was scanned
     *    in full, twice a day.
     *
     * A click at 22:00 on the 31st still belongs to the month the partner thinks
     * it does: the boundaries are local midnights converted to UTC instants.
     *
     * @param input.month - Any date inside the month to roll up.
     * @param tx - Optional transaction client.
     * @returns The number of rollup rows written or updated.
     * @throws {DbError} If the database operation fails.
     */
    async rollUpMonth(input: { readonly month: Date }, tx?: DrizzleClient): Promise<number> {
        const db = this.getClient(tx);
        const { monthStart, nextMonthStart, monthLabel } = getLocalMonthWindow({
            instant: input.month
        });
        const logContext = { month: monthLabel };

        try {
            // No RETURNING: `rowCount` answers "how many rows" without dragging
            // one row per partner into the process to be counted and discarded.
            const result = await db.execute(sql`
                INSERT INTO partner_logo_click_monthly_rollups
                    (partner_id, month, total, unique_visitors)
                SELECT
                    partner_id,
                    ${monthLabel}::date,
                    COUNT(DISTINCT (
                        visitor_hash,
                        FLOOR(EXTRACT(EPOCH FROM clicked_at) / 1800)
                    ))::int,
                    COUNT(DISTINCT visitor_hash)::int
                FROM partner_logo_clicks
                WHERE clicked_at >= ${monthStart}
                  AND clicked_at < ${nextMonthStart}
                GROUP BY
                    partner_id
                ON CONFLICT (partner_id, month) DO UPDATE SET
                    total = EXCLUDED.total,
                    unique_visitors = EXCLUDED.unique_visitors
            `);

            const written = (result as { rowCount?: number | null }).rowCount ?? 0;

            try {
                logQuery('partnerLogoClicks', 'rollUpMonth', logContext, { written });
            } catch {}

            return written;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError('partnerLogoClicks', 'rollUpMonth', logContext, err);
            } catch {}
            throw new DbError('partnerLogoClicks', 'rollUpMonth', logContext, err.message);
        }
    }

    /**
     * Hard-deletes rows with `clicked_at < NOW() - interval '<days> days'`.
     *
     * Called by the same TTL cron that purges `entity_views`, on the same
     * horizon and for the same GDPR-lite reason: `visitor_hash` is a
     * fingerprint and must not be retained indefinitely. The monthly rollup is
     * what keeps the NUMBERS after the fingerprints are gone.
     *
     * @param input.days - Retention threshold in days.
     * @param tx - Optional transaction client.
     * @returns The number of rows deleted.
     * @throws {DbError} If the database operation fails.
     */
    async purgeOlderThan(input: PurgeClicksOlderThanInput, tx?: DrizzleClient): Promise<number> {
        const { days } = input;
        const db = this.getClient(tx);
        const logContext = { days };

        try {
            const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            const deleted = await db
                .delete(partnerLogoClicks)
                .where(lt(partnerLogoClicks.clickedAt, cutoff))
                .returning({ id: partnerLogoClicks.id });

            const count = deleted.length;

            try {
                logQuery('partnerLogoClicks', 'purgeOlderThan', logContext, { deleted: count });
            } catch {}

            return count;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError('partnerLogoClicks', 'purgeOlderThan', logContext, err);
            } catch {}
            throw new DbError('partnerLogoClicks', 'purgeOlderThan', logContext, err.message);
        }
    }
}

/** Singleton instance of PartnerLogoClickModel for use across the application. */
export const partnerLogoClickModel = new PartnerLogoClickModel();
