import type {
    EventOrganizerType,
    EventType,
    NewEventOrganizerInputType,
    UpdateEventOrganizerInputType
} from '@repo/types';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { events } from '../../dbschemas/event/event.dbschema.ts';
import { eventOrganizers } from '../../dbschemas/event/event_organizer.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for EventOrganizerModel
 * Columns: name, createdAt
 */
const eventOrganizerOrderable = createOrderableColumnsAndMapping(
    ['name', 'createdAt'] as const,
    eventOrganizers
);

export const EVENT_ORGANIZER_ORDERABLE_COLUMNS = eventOrganizerOrderable.columns;
export type EventOrganizerOrderByColumn = typeof eventOrganizerOrderable.type;
const eventOrganizerOrderableColumns = eventOrganizerOrderable.mapping;

export type EventOrganizerPaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: EventOrganizerOrderByColumn;
};

export type EventOrganizerSearchParams = EventOrganizerPaginationParams & {
    q?: string;
    name?: string;
    lifecycle?: string;
};

export type EventOrganizerRelations = {
    events?: true;
};

export type EventOrganizerRelationResult<T extends EventOrganizerRelations> = {
    events: T['events'] extends true ? EventType[] : never;
};

export type EventOrganizerWithRelationsType = EventOrganizerType & {
    events?: EventType[];
};

export const EventOrganizerModel = {
    /**
     * Get an event organizer by its unique ID.
     */
    async getById(id: string): Promise<EventOrganizerType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(eventOrganizers)
                .where(eq(eventOrganizers.id, id))
                .limit(1);
            dbLogger.query({
                table: 'event_organizers',
                action: 'getById',
                params: { id },
                result
            });
            return result[0] as EventOrganizerType | undefined;
        } catch (error) {
            dbLogger.error(error, 'EventOrganizerModel.getById');
            throw new Error(`Failed to get event organizer by id: ${(error as Error).message}`);
        }
    },

    /**
     * Get event organizers by name.
     */
    async getByName(name: string): Promise<EventOrganizerType[]> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(eventOrganizers)
                .where(eq(eventOrganizers.name, name));
            dbLogger.query({
                table: 'event_organizers',
                action: 'getByName',
                params: { name },
                result
            });
            return result as EventOrganizerType[];
        } catch (error) {
            dbLogger.error(error, 'EventOrganizerModel.getByName');
            throw new Error(`Failed to get event organizers by name: ${(error as Error).message}`);
        }
    },

    /**
     * Create a new event organizer.
     */
    async create(input: NewEventOrganizerInputType): Promise<EventOrganizerType> {
        const db = getDb();
        try {
            const result = await db.insert(eventOrganizers).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'event_organizers',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as EventOrganizerType;
        } catch (error) {
            dbLogger.error(error, 'EventOrganizerModel.create');
            throw new Error(`Failed to create event organizer: ${(error as Error).message}`);
        }
    },

    /**
     * Update an event organizer by ID.
     */
    async update(
        id: string,
        input: UpdateEventOrganizerInputType
    ): Promise<EventOrganizerType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .update(eventOrganizers)
                .set(input)
                .where(eq(eventOrganizers.id, id))
                .returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'event_organizers',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as EventOrganizerType | undefined;
        } catch (error) {
            dbLogger.error(error, 'EventOrganizerModel.update');
            throw new Error(`Failed to update event organizer: ${(error as Error).message}`);
        }
    },

    /**
     * Soft delete an event organizer by ID.
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(eventOrganizers)
                .set({ deletedAt: now, deletedById })
                .where(eq(eventOrganizers.id, id))
                .returning({ id: eventOrganizers.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'event_organizers',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'EventOrganizerModel.delete');
            throw new Error(`Failed to delete event organizer: ${(error as Error).message}`);
        }
    },

    /**
     * Hard delete an event organizer by ID.
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db
                .delete(eventOrganizers)
                .where(eq(eventOrganizers.id, id))
                .returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'event_organizers',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'EventOrganizerModel.hardDelete');
            throw new Error(`Failed to hard delete event organizer: ${(error as Error).message}`);
        }
    },

    /**
     * List event organizers with pagination and optional ordering.
     */
    async list(params: EventOrganizerPaginationParams): Promise<EventOrganizerType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(
                eventOrganizerOrderableColumns,
                orderBy,
                eventOrganizers.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(eventOrganizers)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'event_organizers', action: 'list', params, result });
            return result as EventOrganizerType[];
        } catch (error) {
            dbLogger.error(error, 'EventOrganizerModel.list');
            throw new Error(`Failed to list event organizers: ${(error as Error).message}`);
        }
    },

    /**
     * Search event organizers by name, lifecycle, etc.
     *
     * @param params - Search and pagination parameters
     * @returns Array of EventOrganizerType
     * @throws Error if the query fails
     */
    async search(params: EventOrganizerSearchParams): Promise<EventOrganizerType[]> {
        const db = getDb();
        const { q, name, lifecycle, limit, offset, order, orderBy } = params;
        try {
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(eventOrganizers.name, prepareLikeQuery(q)));
            }
            if (name) {
                whereClauses.push(ilike(eventOrganizers.name, prepareLikeQuery(name)));
            }
            if (lifecycle) {
                whereClauses.push(eq(eventOrganizers.lifecycle, lifecycle));
            }
            const col = getOrderableColumn(
                eventOrganizerOrderableColumns,
                orderBy,
                eventOrganizers.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(eventOrganizers)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'event_organizers', action: 'search', params, result });
            return result as EventOrganizerType[];
        } catch (error) {
            dbLogger.error(error, 'EventOrganizerModel.search');
            throw new Error(`Failed to search event organizers: ${(error as Error).message}`);
        }
    },

    /**
     * Count event organizers with optional filters.
     *
     * @param params - Search parameters
     * @returns Number of event organizers matching the query
     * @throws Error if the query fails
     */
    async count(params?: EventOrganizerSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { name, lifecycle, q } = params || {};
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(eventOrganizers.name, prepareLikeQuery(q)));
            }
            if (name) {
                whereClauses.push(ilike(eventOrganizers.name, prepareLikeQuery(name)));
            }
            if (lifecycle) {
                whereClauses.push(eq(eventOrganizers.lifecycle, lifecycle));
            }
            const result = await db
                .select({ count: count().as('count') })
                .from(eventOrganizers)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
            dbLogger.query({ table: 'event_organizers', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'EventOrganizerModel.count');
            throw new Error(`Failed to count event organizers: ${(error as Error).message}`);
        }
    },

    /**
     * Get an event organizer by ID, including specified relations.
     *
     * @template T
     * @param id - EventOrganizer ID
     * @param withRelations - Relations to include (events)
     * @returns EventOrganizerType with relations if found, otherwise undefined
     * @throws Error if the query fails
     */
    async getWithRelations<T extends EventOrganizerRelations>(
        id: string,
        withRelations: T
    ): Promise<(EventOrganizerWithRelationsType & EventOrganizerRelationResult<T>) | undefined> {
        const db = getDb();
        try {
            const result = await db.query.eventOrganizers.findFirst({
                where: (o, { eq }) => eq(o.id, id),
                with: withRelations as Record<string, true>
            });
            dbLogger.query({
                table: 'event_organizers',
                action: 'getWithRelations',
                params: { id, with: withRelations },
                result
            });
            return result as
                | (EventOrganizerWithRelationsType & EventOrganizerRelationResult<T>)
                | undefined;
        } catch (error) {
            dbLogger.error(error, 'EventOrganizerModel.getWithRelations');
            throw new Error(
                `Failed to get event organizer with relations: ${(error as Error).message}`
            );
        }
    },

    /**
     * Get event organizers by event ID.
     *
     * @param eventId - Event ID
     * @returns Array of EventOrganizerType
     * @throws Error if the query fails
     */
    async getByEvent(eventId: string): Promise<EventOrganizerType[]> {
        const db = getDb();
        try {
            const result = await db
                .select({ eventOrganizers, events })
                .from(eventOrganizers)
                .innerJoin(
                    events,
                    and(eq(events.organizerId, eventOrganizers.id), eq(events.id, eventId))
                );
            dbLogger.query({
                table: 'event_organizers',
                action: 'getByEvent',
                params: { eventId },
                result
            });
            return result.map((row) => row.eventOrganizers as EventOrganizerType);
        } catch (error) {
            dbLogger.error(error, 'EventOrganizerModel.getByEvent');
            throw new Error(`Failed to get event organizers by event: ${(error as Error).message}`);
        }
    }
};
