import type { AccommodationOccupancy } from '@repo/schemas';
import { OccupancySourceEnum } from '@repo/schemas';
import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { accommodationOccupancy } from '../../schemas/accommodation/accommodationOccupancy.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/**
 * Model for the `accommodation_occupancy` table (HOS-43 Phase 1).
 *
 * Extends `BaseModelImpl` for the generic CRUD surface (used sparingly here —
 * most callers should go through the dedicated methods below, which encode
 * the range/idempotency/source semantics the spec requires) plus five
 * domain-specific query methods:
 *
 * - {@link findByAccommodationAndRange} — half-open date range read, backs
 *   the `GET .../occupancy?from&to` endpoints.
 * - {@link findByAccommodation} — full occupancy list, backs the host
 *   calendar UI.
 * - {@link batchUpsertManual} — idempotent bulk insert of `MANUAL` rows,
 *   backs `PATCH .../occupancy/batch` with `isBlocked: true`.
 * - {@link deleteManualByDate} / {@link deleteManualByDates} — delete ONLY
 *   `MANUAL` rows, so sync-sourced rows (Phase 2/3) are never removable by
 *   the manual toggle UI.
 */
export class AccommodationOccupancyModel extends BaseModelImpl<AccommodationOccupancy> {
    protected table = accommodationOccupancy;
    public entityName = 'accommodationOccupancy';

    protected getTableName(): string {
        return 'accommodationOccupancy';
    }

    /**
     * Finds all occupancy rows for an accommodation within a half-open date
     * range: `date >= from AND date < to`.
     *
     * The upper bound is exclusive by design — mirrors the "check-out day is
     * free" semantics documented in the spec (section 5): a stay that checks
     * out on `to` does NOT block `to` itself.
     *
     * @param params.accommodationId - The accommodation to query.
     * @param params.from - Inclusive lower bound, `YYYY-MM-DD`.
     * @param params.to - Exclusive upper bound, `YYYY-MM-DD`.
     * @param tx - Optional transaction client.
     * @returns Rows ordered by `date` ascending.
     */
    async findByAccommodationAndRange(
        params: { accommodationId: string; from: string; to: string },
        tx?: DrizzleClient
    ): Promise<AccommodationOccupancy[]> {
        const { accommodationId, from, to } = params;
        const db = this.getClient(tx);
        const rows = await db
            .select()
            .from(accommodationOccupancy)
            .where(
                and(
                    eq(accommodationOccupancy.accommodationId, accommodationId),
                    gte(accommodationOccupancy.date, from),
                    lt(accommodationOccupancy.date, to)
                )
            )
            .orderBy(asc(accommodationOccupancy.date));
        return rows as AccommodationOccupancy[];
    }

    /**
     * Finds every occupancy row for an accommodation, regardless of date.
     * Backs the host calendar UI, which renders the full set of blocked days
     * across all visible months client-side.
     *
     * @param params.accommodationId - The accommodation to query.
     * @param tx - Optional transaction client.
     * @returns Rows ordered by `date` ascending.
     */
    async findByAccommodation(
        params: { accommodationId: string },
        tx?: DrizzleClient
    ): Promise<AccommodationOccupancy[]> {
        const db = this.getClient(tx);
        const rows = await db
            .select()
            .from(accommodationOccupancy)
            .where(eq(accommodationOccupancy.accommodationId, params.accommodationId))
            .orderBy(asc(accommodationOccupancy.date));
        return rows as AccommodationOccupancy[];
    }

    /**
     * Idempotently inserts one `source=MANUAL`, `isBlocked=true` row per
     * date. Relies on the `(accommodation_id, date)` unique index: re-running
     * with a date that already has a row (of any source) is a no-op for that
     * date — it does NOT overwrite a sync-sourced row's `source`, matching
     * the spec's "sync is not pierced by manual writes" invariant (US-1,
     * risk table).
     *
     * @param params.accommodationId - The accommodation to block dates on.
     * @param params.dates - `YYYY-MM-DD` dates to insert. Empty array is a no-op.
     * @param params.createdById - The host (or system actor) creating these rows.
     * @param params.note - Optional note applied to every inserted row.
     * @param tx - Optional transaction client.
     * @returns The rows actually inserted (excludes dates that already had a
     *   row and were skipped by the conflict target).
     */
    async batchUpsertManual(
        params: {
            accommodationId: string;
            dates: readonly string[];
            createdById: string;
            note?: string | null;
        },
        tx?: DrizzleClient
    ): Promise<AccommodationOccupancy[]> {
        const { accommodationId, dates, createdById, note } = params;
        if (dates.length === 0) return [];

        const db = this.getClient(tx);
        const now = new Date();
        const values = dates.map((date) => ({
            accommodationId,
            date,
            isBlocked: true,
            source: OccupancySourceEnum.MANUAL,
            externalEventId: null,
            note: note ?? null,
            createdById,
            createdAt: now,
            updatedAt: now
        }));

        const inserted = await db
            .insert(accommodationOccupancy)
            .values(values)
            .onConflictDoNothing({
                target: [accommodationOccupancy.accommodationId, accommodationOccupancy.date]
            })
            .returning();

        return inserted as AccommodationOccupancy[];
    }

    /**
     * Deletes the `MANUAL` occupancy row for a single date, if any.
     *
     * Scoped to `source='MANUAL'` on purpose — a sync-sourced row for the
     * same `(accommodationId, date)` is left untouched, since the unique
     * index guarantees at most one row per day regardless of source.
     *
     * @param params.accommodationId - The accommodation to unblock a date on.
     * @param params.date - `YYYY-MM-DD` date to unblock.
     * @param tx - Optional transaction client.
     * @returns The number of rows deleted (0 or 1).
     */
    async deleteManualByDate(
        params: { accommodationId: string; date: string },
        tx?: DrizzleClient
    ): Promise<number> {
        const { accommodationId, date } = params;
        const db = this.getClient(tx);
        const result = await db
            .delete(accommodationOccupancy)
            .where(
                and(
                    eq(accommodationOccupancy.accommodationId, accommodationId),
                    eq(accommodationOccupancy.date, date),
                    eq(accommodationOccupancy.source, OccupancySourceEnum.MANUAL)
                )
            )
            .returning();
        return result.length;
    }

    /**
     * Batch variant of {@link deleteManualByDate} — deletes the `MANUAL` rows
     * for every date in the list, leaving any sync-sourced rows for those
     * same dates untouched.
     *
     * @param params.accommodationId - The accommodation to unblock dates on.
     * @param params.dates - `YYYY-MM-DD` dates to unblock. Empty array is a no-op.
     * @param tx - Optional transaction client.
     * @returns The number of rows deleted.
     */
    async deleteManualByDates(
        params: { accommodationId: string; dates: readonly string[] },
        tx?: DrizzleClient
    ): Promise<number> {
        const { accommodationId, dates } = params;
        if (dates.length === 0) return 0;

        const db = this.getClient(tx);
        const result = await db
            .delete(accommodationOccupancy)
            .where(
                and(
                    eq(accommodationOccupancy.accommodationId, accommodationId),
                    inArray(accommodationOccupancy.date, [...dates]),
                    eq(accommodationOccupancy.source, OccupancySourceEnum.MANUAL)
                )
            )
            .returning();
        return result.length;
    }
}

/** Singleton instance of AccommodationOccupancyModel for use across the application. */
export const accommodationOccupancyModel = new AccommodationOccupancyModel();
