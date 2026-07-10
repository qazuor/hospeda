import type { Event } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { events } from '../../schemas/event/event.dbschema.ts';
import { userBookmarks } from '../../schemas/user/user_bookmark.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { buildWhereClause } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

/**
 * Synthetic sort field name that orders events by the number of active
 * (non-deleted) bookmarks pointing at them. Implemented as a correlated
 * subquery against `user_bookmarks` filtered by `entity_type = 'EVENT'` and
 * `deleted_at IS NULL`. SPEC-098 T-052a (mirrors the accommodation
 * implementation in T-052).
 *
 * Performance depends on the compound index `idx_user_bookmarks_entity_active`
 * on `(entity_id, entity_type, deleted_at)` (see SPEC-098 T-008 and the
 * `0019_user_bookmarks_entity_active_index.sql` manual migration).
 */
const MOST_SAVED_SORT_FIELD = 'mostSaved';

/**
 * Synthetic sort field that orders events by the `date->>'start'` value
 * inside the JSONB `date` column. Required because that field is not a
 * top-level column and `buildOrderByClause` cannot reach it.
 */
const START_DATE_SORT_FIELD = 'startDate';

/**
 * Build the SQL expression used as the ORDER BY for the `startDate` synthetic
 * sort. NULL dates are pushed to the end of the result set so missing data
 * never floats above real upcoming events.
 */
function buildStartDateOrderExpr(order: 'asc' | 'desc'): SQL {
    const direction = order === 'desc' ? sql`DESC` : sql`ASC`;
    return sql`(${events.date}->>'start')::timestamptz ${direction} NULLS LAST`;
}

/**
 * Build the correlated subquery used as the ORDER BY expression for the
 * `mostSaved` synthetic sort. NULL counts (i.e. no active bookmarks) are
 * folded to zero by `COUNT(*)`, so no `NULLS LAST` clause is required.
 */
function buildMostSavedOrderExpr(order: 'asc' | 'desc'): SQL {
    const direction = order === 'desc' ? sql`DESC` : sql`ASC`;
    return sql`(
        SELECT COUNT(*) FROM ${userBookmarks}
        WHERE ${userBookmarks.entityId} = ${events.id}
          AND ${userBookmarks.entityType} = 'EVENT'
          AND ${userBookmarks.deletedAt} IS NULL
    ) ${direction}`;
}

/**
 * Extracts the `categories` (array, OR union) / `category` (singular) event
 * filter from a generic `where` record and converts it into a manual
 * `inArray`/`eq` SQL condition, mirroring `AccommodationModel`'s `types`/`type`
 * precedence: the array wins when both are present, and an empty array is
 * treated as "no filter" (never `inArray([])`).
 *
 * This is REQUIRED because `categories` is not a real column on the `events`
 * table (only the singular `category` is) — the generic `buildWhereClause`
 * helper has no way to turn it into `inArray()`, so passing it straight
 * through would silently skip it as an unknown key, dropping the filter
 * entirely instead of applying it (HOS-96 US-2/US-9 — the shipped latent bug:
 * the sidebar already serializes `?category=A,B`/`?categories=A,B` but the
 * backend never filtered by it).
 *
 * @param where - The raw filter record as received from the service layer.
 * @returns The `where` record with `category`/`categories` stripped (so the
 *   generic `buildWhereClause` never sees them), plus the manual SQL
 *   condition to push into `additionalConditions` (if any).
 */
function extractEventCategoryCondition(where: Record<string, unknown>): {
    where: Record<string, unknown>;
    condition?: SQL<unknown>;
} {
    const { category, categories, ...rest } = where;
    if (Array.isArray(categories) && categories.length > 0) {
        return {
            where: rest,
            condition: inArray(events.category, categories as (typeof events.category._.data)[])
        };
    }
    if (category !== undefined) {
        return {
            where: rest,
            condition: eq(events.category, category as typeof events.category._.data)
        };
    }
    return { where: rest, condition: undefined };
}

/**
 * Input parameters for EventModel.search() and EventModel.searchWithRelations().
 */
export interface EventSearchParams {
    /** Filter by destination UUID via events.destination_id (direct FK, REQ-096-02). */
    destinationId?: string;
    /** Page number (1-based). Defaults to 1. */
    page?: number;
    /** Number of items per page. Defaults to 10. */
    pageSize?: number;
    /** Column to sort by. */
    sortBy?: string;
    /** Sort direction. Defaults to 'desc'. */
    sortOrder?: 'asc' | 'desc';
}

export class EventModel extends BaseModelImpl<Event> {
    protected table = events;
    public entityName = 'events';

    protected override readonly validRelationKeys = [
        'author',
        'createdBy',
        'updatedBy',
        'deletedBy',
        'location',
        'organizer',
        'destination',
        'tags'
    ] as const;

    /**
     * The `media` column stores structured image metadata as JSONB.
     * Opting in here ensures that a partial media patch does not overwrite
     * sibling keys written by a concurrent request (GAP-078-186, GAP-078-198).
     */
    protected override readonly mergeableJsonbColumns = ['media'] as const;

    protected getTableName(): string {
        return 'events';
    }

    /**
     * Overrides {@link BaseModelImpl.findAll} to add support for the synthetic
     * `mostSaved` sort field. When `options.sortBy === 'mostSaved'`, the query
     * orders rows by the count of active bookmarks via a correlated subquery on
     * `user_bookmarks` (entity_type='EVENT' AND deleted_at IS NULL), with a
     * stable `id DESC` tiebreaker so pagination stays deterministic. All other
     * sort fields delegate to the base implementation unchanged.
     *
     * SPEC-098 T-052a — mirrors the accommodation `mostSaved` mechanism on
     * the events listing.
     */
    override async findAll(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<{ items: Event[]; total: number }> {
        // HOS-96: strip category/categories from the generic where record and
        // convert them into a manual inArray/eq condition BEFORE either branch
        // below builds its query — see extractEventCategoryCondition() JSDoc.
        const { where: sanitizedWhere, condition: categoryCondition } =
            extractEventCategoryCondition(where ?? {});
        const mergedConditions: SQL[] = [
            ...(additionalConditions ?? []),
            ...(categoryCondition ? [categoryCondition] : [])
        ];

        const sortBy = options?.sortBy;
        const isSyntheticSort =
            sortBy === MOST_SAVED_SORT_FIELD || sortBy === START_DATE_SORT_FIELD;
        if (!isSyntheticSort) {
            return super.findAll(
                sanitizedWhere,
                options,
                mergedConditions.length > 0 ? mergedConditions : undefined,
                tx
            );
        }

        const db = this.getClient(tx);
        const safeWhere = sanitizedWhere;
        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 10;
        const sortOrder: 'asc' | 'desc' =
            options?.sortOrder ?? (sortBy === MOST_SAVED_SORT_FIELD ? 'desc' : 'asc');
        const offset = (page - 1) * pageSize;

        const logContext = { where: safeWhere, page, pageSize, sortBy };

        try {
            const baseWhereClause = buildWhereClause(safeWhere, this.table);

            const allConditions: SQL[] = [];
            if (baseWhereClause) allConditions.push(baseWhereClause);
            if (mergedConditions.length > 0) {
                allConditions.push(...mergedConditions);
            }

            const finalWhereClause =
                allConditions.length === 0
                    ? undefined
                    : allConditions.length === 1
                      ? allConditions[0]
                      : and(...allConditions);

            const orderExpr =
                sortBy === START_DATE_SORT_FIELD
                    ? buildStartDateOrderExpr(sortOrder)
                    : buildMostSavedOrderExpr(sortOrder);
            const tieBreaker = desc(events.id);

            const itemsQuery = db
                .select()
                .from(this.table)
                .where(finalWhereClause)
                .orderBy(orderExpr, tieBreaker)
                .limit(pageSize)
                .offset(offset);

            const [items, total] = await Promise.all([
                itemsQuery,
                this.count(safeWhere, {
                    additionalConditions: mergedConditions,
                    tx
                })
            ]);

            // DRIZZLE-LIMITATION: relational query result widens nullable JSONB columns vs the entity type; the projection above already returns the canonical shape.
            const result = { items: items as unknown as Event[], total };
            try {
                logQuery(this.entityName, 'findAll', logContext, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findAll', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findAll', logContext, err.message);
        }
    }

    /**
     * Overrides {@link BaseModelImpl.findAllWithRelations} so the synthetic
     * sort field `startDate` — which orders by `date->>'start'` extracted from
     * the JSONB `date` column — also works when loading rows with relations
     * (the path used by `EventService._executeSearch`).
     *
     * The other synthetic sort field, `mostSaved`, is intentionally NOT
     * handled here. Its correlated subquery does not compose with Drizzle's
     * relational query API and currently falls back to default ordering when
     * used via the public list endpoint — see SPEC-098 T-052a notes.
     */
    override async findAllWithRelations(
        relations: Record<string, boolean | Record<string, unknown>>,
        where: Record<string, unknown> = {},
        options: {
            page?: number;
            pageSize?: number;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
        } = {},
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<{ items: Event[]; total: number }> {
        // HOS-96: strip category/categories from the generic where record and
        // convert them into a manual inArray/eq condition BEFORE either branch
        // below builds its query — see extractEventCategoryCondition() JSDoc.
        const { where: sanitizedWhere, condition: categoryCondition } =
            extractEventCategoryCondition(where ?? {});
        const mergedConditions: SQL[] = [
            ...(additionalConditions ?? []),
            ...(categoryCondition ? [categoryCondition] : [])
        ];

        const sortBy = options.sortBy;
        if (sortBy !== START_DATE_SORT_FIELD) {
            return super.findAllWithRelations(
                relations,
                sanitizedWhere,
                options,
                mergedConditions.length > 0 ? mergedConditions : undefined,
                tx
            );
        }

        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);

        const db = this.getClient(tx);
        const safeWhere = sanitizedWhere;
        const page = options.page ?? 1;
        const pageSize = options.pageSize ?? 10;
        const sortOrder: 'asc' | 'desc' = options.sortOrder ?? 'asc';
        const offset = (page - 1) * pageSize;

        const logContext = { where: safeWhere, page, pageSize, sortBy };

        try {
            const baseWhereClause = buildWhereClause(safeWhere, this.table);

            const allConditions: SQL[] = [];
            if (baseWhereClause) allConditions.push(baseWhereClause);
            if (mergedConditions.length > 0) {
                allConditions.push(...mergedConditions);
            }

            const finalWhereClause =
                allConditions.length === 0
                    ? undefined
                    : allConditions.length === 1
                      ? allConditions[0]
                      : and(...allConditions);

            const orderExpr = buildStartDateOrderExpr(sortOrder);

            // Translate the relations record into the shape Drizzle's
            // relational query API expects (boolean flags per relation key).
            const withObj: Record<string, boolean> = {};
            for (const key of this.validRelationKeys) {
                if (relations[key as string]) withObj[key as string] = true;
            }

            const [items, total] = await Promise.all([
                db.query.events.findMany({
                    where: finalWhereClause,
                    with: withObj,
                    orderBy: [orderExpr, desc(events.id)],
                    limit: pageSize,
                    offset
                }),
                this.count(safeWhere, { additionalConditions: mergedConditions, tx })
            ]);

            // DRIZZLE-LIMITATION: relational query widens nullable JSONB columns vs the Event entity type; the projection returns the same row shape used elsewhere.
            const result = { items: items as unknown as Event[], total };
            try {
                logQuery(this.entityName, 'findAllWithRelations', logContext, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findAllWithRelations', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findAllWithRelations', logContext, err.message);
        }
    }

    /**
     * Finds an event with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { author: true })
     * @returns Promise resolving to the event with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<Event | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        try {
            const withObj: Record<string, boolean> = {};
            for (const key of [
                'author',
                'createdBy',
                'updatedBy',
                'deletedBy',
                'location',
                'organizer',
                'destination',
                'tags'
            ]) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const db = this.getClient(tx);
                const result = await db.query.events.findFirst({
                    where: (fields, { eq: eqFn }) => eqFn(fields.id, where.id as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                // DRIZZLE-LIMITATION: findFirst with `with: { ...event relations, tags }` returns Drizzle's nested join shape; Event entity from @repo/schemas uses domain-mapped relation types.
                return result as unknown as Event | null;
            }
            const result = await this.findOne(where, tx);
            logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'findWithRelations', { where, relations }, error as Error);
            throw new DbError(
                this.entityName,
                'findWithRelations',
                { where, relations },
                (error as Error).message
            );
        }
    }

    /**
     * Searches events with optional destinationId filter applied directly to
     * events.destination_id (the direct FK added in REQ-096-02 / SPEC-096).
     *
     * Soft-deleted rows are always excluded.
     *
     * @param params - Search parameters including optional destinationId filter.
     * @param tx - Optional transaction client.
     * @returns Paginated list of matching events with total count.
     */
    async search(
        params: EventSearchParams,
        tx?: DrizzleClient
    ): Promise<{ items: Event[]; total: number }> {
        const db = this.getClient(tx);
        const { destinationId, page = 1, pageSize = 10 } = params;

        const whereClauses: SQL<unknown>[] = [isNull(events.deletedAt)];

        if (destinationId) {
            whereClauses.push(eq(events.destinationId, destinationId));
        }

        const where = and(...whereClauses);

        try {
            const [items, totalResult] = await Promise.all([
                db
                    .select()
                    .from(this.table)
                    .where(where)
                    .limit(pageSize)
                    .offset((page - 1) * pageSize),
                db.select({ count: count() }).from(this.table).where(where)
            ]);

            const total = Number(totalResult[0]?.count ?? 0);
            // DRIZZLE-LIMITATION: relational query result widens nullable JSONB columns vs the entity type; the projection above already returns the canonical shape.
            const result = { items: items as unknown as Event[], total };

            try {
                logQuery(this.entityName, 'search', params, result);
            } catch {}

            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'search', params, err);
            } catch {}
            throw new DbError(this.entityName, 'search', params, err.message);
        }
    }

    /**
     * Searches events with optional destinationId filter and loads relations.
     *
     * Applies the same destinationId filter as {@link search} but uses
     * Drizzle's relational query API to load organizer and location relations.
     * Soft-deleted rows are always excluded.
     *
     * @param params - Search parameters including optional destinationId filter.
     * @param tx - Optional transaction client.
     * @returns Paginated list of events with organizer and location relations.
     */
    async searchWithRelations(
        params: EventSearchParams,
        tx?: DrizzleClient
    ): Promise<{ items: Event[]; total: number }> {
        const db = this.getClient(tx);
        const { destinationId, page = 1, pageSize = 10 } = params;

        const whereClauses: SQL<unknown>[] = [isNull(events.deletedAt)];

        if (destinationId) {
            whereClauses.push(eq(events.destinationId, destinationId));
        }

        const where = and(...whereClauses);

        try {
            const [items, totalResult] = await Promise.all([
                db.query.events.findMany({
                    where,
                    with: { organizer: true, location: true },
                    limit: pageSize,
                    offset: (page - 1) * pageSize
                }),
                db.select({ count: count() }).from(this.table).where(where)
            ]);

            const total = Number(totalResult[0]?.count ?? 0);
            // DRIZZLE-LIMITATION: relational query result widens nullable JSONB columns vs the entity type; the projection above already returns the canonical shape.
            const result = { items: items as unknown as Event[], total };

            try {
                logQuery(this.entityName, 'searchWithRelations', params, result);
            } catch {}

            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'searchWithRelations', params, err);
            } catch {}
            throw new DbError(this.entityName, 'searchWithRelations', params, err.message);
        }
    }

    /**
     * Overrides {@link BaseModelImpl.count} to apply the same manual
     * `categories`/`category` branch as {@link findAll} and
     * {@link findAllWithRelations} (HOS-96 US-2/US-9), so the public count
     * endpoint (which drives pagination totals) reflects the exact same
     * OR-union filter as the items query.
     */
    override async count(
        where: Record<string, unknown>,
        options?: { additionalConditions?: SQL[]; tx?: DrizzleClient }
    ): Promise<number> {
        const { where: sanitizedWhere, condition: categoryCondition } =
            extractEventCategoryCondition(where ?? {});
        const mergedConditions: SQL[] = [
            ...(options?.additionalConditions ?? []),
            ...(categoryCondition ? [categoryCondition] : [])
        ];
        return super.count(sanitizedWhere, { ...options, additionalConditions: mergedConditions });
    }
}

/** Singleton instance of EventModel for use across the application. */
export const eventModel = new EventModel();
