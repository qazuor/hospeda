import type { Event } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { and, count, eq, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { events } from '../../schemas/event/event.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

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
            // DRIZZLE-LIMITATION: select(*) and findMany return InferSelect with branded enum columns; cast back to canonical Event[] used by services.
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
            // DRIZZLE-LIMITATION: select(*) and findMany return InferSelect with branded enum columns; cast back to canonical Event[] used by services.
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
}

/** Singleton instance of EventModel for use across the application. */
export const eventModel = new EventModel();
