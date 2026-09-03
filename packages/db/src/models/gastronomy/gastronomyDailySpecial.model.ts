import type { GastronomyDailySpecial } from '@repo/schemas';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { gastronomyDailySpecials } from '../../schemas/gastronomy/gastronomy_daily_special.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Input for {@link GastronomyDailySpecialModel.findValidOn}.
 */
interface FindValidOnInput {
    /** UUID of the parent gastronomy listing. */
    gastronomyId: string;
    /**
     * The day to test the window against, as a bare `YYYY-MM-DD`.
     *
     * Passed IN rather than read off the clock — see the method docblock.
     */
    today: string;
    /** Optional transaction client. */
    tx?: DrizzleClient;
}

/**
 * GastronomyDailySpecialModel — DB access for the menú del día (HOS-1041).
 *
 * `BaseModelImpl` for the ordinary write path, plus the one finder that makes
 * the feature what it is: {@link findValidOn}, the date query that retires an
 * expired special without a cron ever running.
 *
 * No soft delete, matching the carta's pair of tables: a special the owner
 * removed is gone, and one that merely elapsed is still a row — it just stops
 * matching the read.
 */
export class GastronomyDailySpecialModel extends BaseModelImpl<GastronomyDailySpecial> {
    protected table = gastronomyDailySpecials;
    public entityName = 'gastronomyDailySpecials';

    protected getTableName(): string {
        return 'gastronomyDailySpecials';
    }

    /**
     * Lists the listing's specials whose validity window CONTAINS `today`,
     * ordered by `display_order ASC`.
     *
     * This is the whole expiry mechanism. Owner decision (2026-09-01): the
     * menú del día is retired by a query, not by a cron job that flips rows —
     * so there is no window in which a job has not yet run and yesterday's dish
     * is still on the page, and nothing to re-run after an outage. A row whose
     * `valid_until` has passed simply stops being returned here, on the very
     * next read.
     *
     * ## `today` is a parameter, not `CURRENT_DATE`
     *
     * Two reasons, and both are bugs avoided rather than preferences.
     *
     * `CURRENT_DATE` resolves against the DATABASE session's timezone, which no
     * caller controls and which differs between a developer's container and the
     * VPS. And the container's own UTC day is wrong for this feature
     * specifically: at 21:00 in Concepción del Uruguay it is already tomorrow
     * in UTC, so a UTC "today" would take the dish of the day off the page in
     * the middle of dinner service — the exact hour it exists for. The caller
     * resolves the day through `getTodayInMarketTimezone()` (AR, UTC-3) and
     * passes it here.
     *
     * Taking it as a parameter also makes the boundary testable without a fake
     * clock: the day before, the first day, the last day and the day after are
     * four ordinary calls.
     *
     * Both bounds are INCLUSIVE (`valid_from <= today <= valid_until`), which is
     * why a one-day special has both columns set to the same date.
     *
     * @param input.gastronomyId - UUID of the parent gastronomy listing.
     * @param input.today - The day to test, as `YYYY-MM-DD`.
     * @param input.tx - Optional transaction client.
     * @returns The currently-valid specials, ordered for display.
     */
    async findValidOn(input: FindValidOnInput): Promise<GastronomyDailySpecial[]> {
        const { gastronomyId, today, tx } = input;
        const db = this.getClient(tx);
        const logContext = { gastronomyId, today };

        try {
            const items = await db
                .select()
                .from(gastronomyDailySpecials)
                .where(
                    and(
                        eq(gastronomyDailySpecials.gastronomyId, gastronomyId),
                        lte(gastronomyDailySpecials.validFrom, today),
                        gte(gastronomyDailySpecials.validUntil, today)
                    )
                )
                .orderBy(asc(gastronomyDailySpecials.displayOrder));

            const result = items as GastronomyDailySpecial[];
            try {
                logQuery(this.entityName, 'findValidOn', logContext, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findValidOn', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findValidOn', logContext, err.message);
        }
    }
}

/** Singleton instance of GastronomyDailySpecialModel. */
export const gastronomyDailySpecialModel = new GastronomyDailySpecialModel();
