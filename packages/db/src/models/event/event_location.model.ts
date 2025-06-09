import type {
    EventLocationType,
    NewEventLocationInputType,
    UpdateEventLocationInputType
} from '@repo/types';
import type { EventType } from '@repo/types/entities/event/event.types';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { events } from '../../dbschemas/event/event.dbschema.ts';
import { eventLocations } from '../../dbschemas/event/event_location.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for EventLocationModel
 * Columns: city, placeName, createdAt
 */
const eventLocationOrderable = createOrderableColumnsAndMapping(
    ['city', 'placeName', 'createdAt'] as const,
    eventLocations
);

export const EVENT_LOCATION_ORDERABLE_COLUMNS = eventLocationOrderable.columns;
export type EventLocationOrderByColumn = typeof eventLocationOrderable.type;
const eventLocationOrderableColumns = eventLocationOrderable.mapping;

export type EventLocationPaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: EventLocationOrderByColumn;
};

export type EventLocationSearchParams = EventLocationPaginationParams & {
    q?: string;
    city?: string;
    placeName?: string;
    lifecycle?: string;
};

export type EventLocationRelations = {
    events?: true;
};

export type EventLocationRelationResult<T extends EventLocationRelations> = {
    events: T['events'] extends true ? EventType[] : never;
};

export type EventLocationWithRelationsType = EventLocationType & {
    events?: EventType[];
};

export const EventLocationModel = {
    /**
     * Get an event location by its unique ID.
     */
    async getById(id: string): Promise<EventLocationType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(eventLocations)
                .where(eq(eventLocations.id, id))
                .limit(1);
            dbLogger.query({ table: 'event_locations', action: 'getById', params: { id }, result });
            return result[0] as EventLocationType | undefined;
        } catch (error) {
            dbLogger.error(error, 'EventLocationModel.getById');
            throw new Error(`Failed to get event location by id: ${(error as Error).message}`);
        }
    },

    /**
     * Get event locations by city.
     */
    async getByCity(city: string): Promise<EventLocationType[]> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(eventLocations)
                .where(eq(eventLocations.city, city));
            dbLogger.query({
                table: 'event_locations',
                action: 'getByCity',
                params: { city },
                result
            });
            return result as EventLocationType[];
        } catch (error) {
            dbLogger.error(error, 'EventLocationModel.getByCity');
            throw new Error(`Failed to get event locations by city: ${(error as Error).message}`);
        }
    },

    /**
     * Get event locations by place name.
     */
    async getByPlaceName(placeName: string): Promise<EventLocationType[]> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(eventLocations)
                .where(eq(eventLocations.placeName, placeName));
            dbLogger.query({
                table: 'event_locations',
                action: 'getByPlaceName',
                params: { placeName },
                result
            });
            return result as EventLocationType[];
        } catch (error) {
            dbLogger.error(error, 'EventLocationModel.getByPlaceName');
            throw new Error(
                `Failed to get event locations by place name: ${(error as Error).message}`
            );
        }
    },

    /**
     * Create a new event location.
     */
    async create(input: NewEventLocationInputType): Promise<EventLocationType> {
        const db = getDb();
        try {
            const result = await db.insert(eventLocations).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'event_locations',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as EventLocationType;
        } catch (error) {
            dbLogger.error(error, 'EventLocationModel.create');
            throw new Error(`Failed to create event location: ${(error as Error).message}`);
        }
    },

    /**
     * Update an event location by ID.
     */
    async update(
        id: string,
        input: UpdateEventLocationInputType
    ): Promise<EventLocationType | undefined> {
        const db = getDb();
        try {
            const result = await db
                .update(eventLocations)
                .set(input)
                .where(eq(eventLocations.id, id))
                .returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'event_locations',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as EventLocationType | undefined;
        } catch (error) {
            dbLogger.error(error, 'EventLocationModel.update');
            throw new Error(`Failed to update event location: ${(error as Error).message}`);
        }
    },

    /**
     * Soft delete an event location by ID.
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(eventLocations)
                .set({ deletedAt: now, deletedById })
                .where(eq(eventLocations.id, id))
                .returning({ id: eventLocations.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'event_locations',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'EventLocationModel.delete');
            throw new Error(`Failed to delete event location: ${(error as Error).message}`);
        }
    },

    /**
     * Hard delete an event location by ID.
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db
                .delete(eventLocations)
                .where(eq(eventLocations.id, id))
                .returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'event_locations',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'EventLocationModel.hardDelete');
            throw new Error(`Failed to hard delete event location: ${(error as Error).message}`);
        }
    },

    /**
     * List event locations with pagination and optional ordering.
     */
    async list(params: EventLocationPaginationParams): Promise<EventLocationType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(
                eventLocationOrderableColumns,
                orderBy,
                eventLocations.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(eventLocations)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'event_locations', action: 'list', params, result });
            return result as EventLocationType[];
        } catch (error) {
            dbLogger.error(error, 'EventLocationModel.list');
            throw new Error(`Failed to list event locations: ${(error as Error).message}`);
        }
    },

    /**
     * Search event locations by city, place name, lifecycle, etc.
     *
     * @param params - Search and pagination parameters
     * @returns Array of EventLocationType
     * @throws Error if the query fails
     */
    async search(params: EventLocationSearchParams): Promise<EventLocationType[]> {
        const db = getDb();
        const { q, city, placeName, lifecycle, limit, offset, order, orderBy } = params;
        try {
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(eventLocations.city, prepareLikeQuery(q)));
            }
            if (city) {
                whereClauses.push(ilike(eventLocations.city, prepareLikeQuery(city)));
            }
            if (placeName) {
                whereClauses.push(ilike(eventLocations.placeName, prepareLikeQuery(placeName)));
            }
            if (lifecycle) {
                whereClauses.push(eq(eventLocations.lifecycle, lifecycle));
            }
            const col = getOrderableColumn(
                eventLocationOrderableColumns,
                orderBy,
                eventLocations.createdAt
            );
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(eventLocations)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'event_locations', action: 'search', params, result });
            return result as EventLocationType[];
        } catch (error) {
            dbLogger.error(error, 'EventLocationModel.search');
            throw new Error(`Failed to search event locations: ${(error as Error).message}`);
        }
    },

    /**
     * Count event locations with optional filters.
     *
     * @param params - Search parameters
     * @returns Number of event locations matching the query
     * @throws Error if the query fails
     */
    async count(params?: EventLocationSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { city, placeName, lifecycle, q } = params || {};
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(eventLocations.city, prepareLikeQuery(q)));
            }
            if (city) {
                whereClauses.push(ilike(eventLocations.city, prepareLikeQuery(city)));
            }
            if (placeName) {
                whereClauses.push(ilike(eventLocations.placeName, prepareLikeQuery(placeName)));
            }
            if (lifecycle) {
                whereClauses.push(eq(eventLocations.lifecycle, lifecycle));
            }
            const result = await db
                .select({ count: count().as('count') })
                .from(eventLocations)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
            dbLogger.query({ table: 'event_locations', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'EventLocationModel.count');
            throw new Error(`Failed to count event locations: ${(error as Error).message}`);
        }
    },

    /**
     * Get an event location by ID, including specified relations.
     *
     * @template T
     * @param id - EventLocation ID
     * @param withRelations - Relations to include (events)
     * @returns EventLocationType with relations if found, otherwise undefined
     * @throws Error if the query fails
     */
    async getWithRelations<T extends EventLocationRelations>(
        id: string,
        withRelations: T
    ): Promise<(EventLocationWithRelationsType & EventLocationRelationResult<T>) | undefined> {
        const db = getDb();
        try {
            const result = await db.query.eventLocations.findFirst({
                where: (l, { eq }) => eq(l.id, id),
                with: withRelations as Record<string, true>
            });
            dbLogger.query({
                table: 'event_locations',
                action: 'getWithRelations',
                params: { id, with: withRelations },
                result
            });
            return result as
                | (EventLocationWithRelationsType & EventLocationRelationResult<T>)
                | undefined;
        } catch (error) {
            dbLogger.error(error, 'EventLocationModel.getWithRelations');
            throw new Error(
                `Failed to get event location with relations: ${(error as Error).message}`
            );
        }
    },

    /**
     * Get event locations by event ID.
     *
     * @param eventId - Event ID
     * @returns Array of EventLocationType
     * @throws Error if the query fails
     */
    async getByEvent(eventId: string): Promise<EventLocationType[]> {
        const db = getDb();
        try {
            const result = await db
                .select({ eventLocations, events })
                .from(eventLocations)
                .innerJoin(
                    events,
                    and(eq(events.locationId, eventLocations.id), eq(events.id, eventId))
                );
            dbLogger.query({
                table: 'event_locations',
                action: 'getByEvent',
                params: { eventId },
                result
            });
            return result.map((row) => row.eventLocations as EventLocationType);
        } catch (error) {
            dbLogger.error(error, 'EventLocationModel.getByEvent');
            throw new Error(`Failed to get event locations by event: ${(error as Error).message}`);
        }
    }
};
