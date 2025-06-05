import type {
    EventType,
    EventWithRelationsType,
    NewEventInputType,
    UpdateEventInputType
} from '@repo/types';
import type { DestinationType } from '@repo/types/entities/destination/destination.types';
import type { TagType } from '@repo/types/entities/tag/tag.types';
import type { UserType } from '@repo/types/entities/user/user.types';
import type { EventCategoryEnum } from '@repo/types/enums/event-category.enum';
import { and, asc, count, desc, eq, ilike, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { events } from '../../dbschemas/event/event.dbschema.ts';
import { eventLocations } from '../../dbschemas/event/event_location.dbschema.ts';
import { rEntityTag } from '../../dbschemas/tag/r_entity_tag.dbschema.ts';
import {
    createOrderableColumnsAndMapping,
    getOrderableColumn,
    prepareLikeQuery
} from '../../utils';
import { dbLogger } from '../../utils/logger.ts';

/**
 * Orderable Columns Pattern for EventModel
 * Columns: category, date, isFeatured, visibility, lifecycle, summary
 */
const eventOrderable = createOrderableColumnsAndMapping(
    ['category', 'date', 'isFeatured', 'visibility', 'lifecycle', 'summary', 'createdAt'] as const,
    events
);

export const EVENT_ORDERABLE_COLUMNS = eventOrderable.columns;
export type EventOrderByColumn = typeof eventOrderable.type;
const eventOrderableColumns = eventOrderable.mapping;

export type EventPaginationParams = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: EventOrderByColumn;
};

export type EventSearchParams = EventPaginationParams & {
    q?: string;
    summary?: string;
    category?: EventCategoryEnum;
    organizerId?: string;
    locationId?: string;
    tagId?: string;
    lifecycle?: string;
    visibility?: string;
    isFeatured?: boolean;
    /**
     * If set, only events whose date.start is greater than or equal to this value will be returned.
     */
    minDate?: Date;
    /**
     * If set, only events whose date.start is less than or equal to this value will be returned.
     */
    maxDate?: Date;
};

export type EventRelations = {
    tags?: true;
    organizer?: true;
    location?: true;
};

export type EventRelationResult<T extends EventRelations> = {
    tags: T['tags'] extends true ? TagType[] : never;
    organizer: T['organizer'] extends true ? UserType : never;
    location: T['location'] extends true ? DestinationType : never;
};

export type EventWithRelations = EventType & {
    tags?: TagType[];
    organizer?: UserType;
    location?: DestinationType;
};

export const EventModel = {
    /**
     * Get an event by its unique ID.
     */
    async getById(id: string): Promise<EventType | undefined> {
        const db = getDb();
        try {
            const result = await db.select().from(events).where(eq(events.id, id)).limit(1);
            dbLogger.query({ table: 'events', action: 'getById', params: { id }, result });
            return result[0] as EventType | undefined;
        } catch (error) {
            dbLogger.error(error, 'EventModel.getById');
            throw new Error(`Failed to get event by id: ${(error as Error).message}`);
        }
    },

    /**
     * Get an event by its unique slug.
     */
    async getBySlug(slug: string): Promise<EventType | undefined> {
        const db = getDb();
        try {
            const result = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
            dbLogger.query({
                table: 'events',
                action: 'getBySlug',
                params: { slug },
                result
            });
            return result[0] as EventType | undefined;
        } catch (error) {
            dbLogger.error(error, 'EventModel.getBySlug');
            throw new Error(`Failed to get event by slug: ${(error as Error).message}`);
        }
    },

    /**
     * Get events by category.
     */
    async getByCategory(category: EventCategoryEnum): Promise<EventType[]> {
        const db = getDb();
        try {
            const result = await db.select().from(events).where(eq(events.category, category));
            dbLogger.query({
                table: 'events',
                action: 'getByCategory',
                params: { category },
                result
            });
            return result as EventType[];
        } catch (error) {
            dbLogger.error(error, 'EventModel.getByCategory');
            throw new Error(`Failed to get events by category: ${(error as Error).message}`);
        }
    },

    /**
     * Create a new event.
     */
    async create(input: NewEventInputType): Promise<EventType> {
        const db = getDb();
        try {
            const result = await db.insert(events).values(input).returning();
            const created = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'events',
                action: 'create',
                params: { input },
                result: created
            });
            if (!created) throw new Error('Insert failed');
            return created as EventType;
        } catch (error) {
            dbLogger.error(error, 'EventModel.create');
            throw new Error(`Failed to create event: ${(error as Error).message}`);
        }
    },

    /**
     * Update an event by ID.
     */
    async update(id: string, input: UpdateEventInputType): Promise<EventType | undefined> {
        const db = getDb();
        try {
            const result = await db.update(events).set(input).where(eq(events.id, id)).returning();
            const updated = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'events',
                action: 'update',
                params: { id, input },
                result: updated
            });
            return updated as EventType | undefined;
        } catch (error) {
            dbLogger.error(error, 'EventModel.update');
            throw new Error(`Failed to update event: ${(error as Error).message}`);
        }
    },

    /**
     * Soft delete an event by ID.
     */
    async delete(id: string, deletedById: string): Promise<{ id: string } | undefined> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .update(events)
                .set({ deletedAt: now, deletedById })
                .where(eq(events.id, id))
                .returning({ id: events.id });
            const deleted = Array.isArray(result) ? result[0] : undefined;
            dbLogger.query({
                table: 'events',
                action: 'delete',
                params: { id, deletedById },
                result: deleted
            });
            return deleted as { id: string } | undefined;
        } catch (error) {
            dbLogger.error(error, 'EventModel.delete');
            throw new Error(`Failed to delete event: ${(error as Error).message}`);
        }
    },

    /**
     * Hard delete an event by ID.
     */
    async hardDelete(id: string): Promise<boolean> {
        const db = getDb();
        try {
            const result = await db.delete(events).where(eq(events.id, id)).returning();
            const deleted = Array.isArray(result) ? result.length > 0 : false;
            dbLogger.query({
                table: 'events',
                action: 'hardDelete',
                params: { id },
                result: deleted
            });
            return deleted;
        } catch (error) {
            dbLogger.error(error, 'EventModel.hardDelete');
            throw new Error(`Failed to hard delete event: ${(error as Error).message}`);
        }
    },

    /**
     * List events with pagination and optional ordering.
     */
    async list(params: EventPaginationParams): Promise<EventType[]> {
        const db = getDb();
        const { limit, offset, order, orderBy } = params;
        try {
            const col = getOrderableColumn(eventOrderableColumns, orderBy, events.createdAt);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            const result = await db
                .select()
                .from(events)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'events', action: 'list', params, result });
            return result as EventType[];
        } catch (error) {
            dbLogger.error(error, 'EventModel.list');
            throw new Error(`Failed to list events: ${(error as Error).message}`);
        }
    },

    /**
     * Search events by summary, category, organizer, tag, etc.
     */
    async search(params: EventSearchParams): Promise<EventType[]> {
        const db = getDb();
        const {
            q,
            summary,
            category,
            organizerId,
            locationId,
            tagId,
            lifecycle,
            visibility,
            isFeatured,
            limit,
            offset,
            order,
            orderBy,
            minDate,
            maxDate
        } = params;
        try {
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(events.summary, prepareLikeQuery(q)));
            }
            if (summary) {
                whereClauses.push(ilike(events.summary, prepareLikeQuery(summary)));
            }
            if (category) {
                whereClauses.push(eq(events.category, category));
            }
            if (organizerId) {
                whereClauses.push(eq(events.organizerId, organizerId));
            }
            if (locationId) {
                whereClauses.push(eq(events.locationId, locationId));
            }
            if (lifecycle) {
                whereClauses.push(eq(events.lifecycle, lifecycle));
            }
            if (visibility) {
                whereClauses.push(eq(events.visibility, visibility));
            }
            if (typeof isFeatured === 'boolean') {
                whereClauses.push(eq(events.isFeatured, isFeatured));
            }
            if (minDate) {
                // Filter events whose date.start is greater than or equal to minDate (ISO string)
                whereClauses.push(
                    sql`(events.date->>'start')::timestamptz >= ${minDate.toISOString()}`
                );
            }
            if (maxDate) {
                // Filter events whose date.start is less than or equal to maxDate (ISO string)
                whereClauses.push(
                    sql`(events.date->>'start')::timestamptz <= ${maxDate.toISOString()}`
                );
            }
            const col = getOrderableColumn(eventOrderableColumns, orderBy, events.createdAt);
            const orderExpr = order === 'desc' ? desc(col) : asc(col);
            if (tagId) {
                // Query with innerJoin for tag filtering
                const result = await db
                    .select({ events, rEntityTag })
                    .from(events)
                    .innerJoin(
                        rEntityTag,
                        and(
                            eq(rEntityTag.entityId, events.id),
                            eq(rEntityTag.tagId, tagId),
                            eq(rEntityTag.entityType, 'EVENT')
                        )
                    )
                    .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
                    .orderBy(orderExpr)
                    .limit(limit)
                    .offset(offset);
                dbLogger.query({ table: 'events', action: 'search', params, result });
                return result.map((row) => row.events as EventType);
            }
            // Query without innerJoin
            const result = await db
                .select()
                .from(events)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
                .orderBy(orderExpr)
                .limit(limit)
                .offset(offset);
            dbLogger.query({ table: 'events', action: 'search', params, result });
            return result as EventType[];
        } catch (error) {
            dbLogger.error(error, 'EventModel.search');
            throw new Error(`Failed to search events: ${(error as Error).message}`);
        }
    },

    /**
     * Count events with optional filters.
     */
    async count(params?: EventSearchParams): Promise<number> {
        const db = getDb();
        try {
            const { summary, category, organizerId, locationId, tagId, lifecycle, visibility, q } =
                params || {};
            const whereClauses = [];
            if (q) {
                whereClauses.push(ilike(events.summary, prepareLikeQuery(q)));
            }
            if (summary) {
                whereClauses.push(ilike(events.summary, prepareLikeQuery(summary)));
            }
            if (category) {
                whereClauses.push(eq(events.category, category));
            }
            if (organizerId) {
                whereClauses.push(eq(events.organizerId, organizerId));
            }
            if (locationId) {
                whereClauses.push(eq(events.locationId, locationId));
            }
            if (lifecycle) {
                whereClauses.push(eq(events.lifecycle, lifecycle));
            }
            if (visibility) {
                whereClauses.push(eq(events.visibility, visibility));
            }
            if (tagId) {
                // Query con innerJoin
                const result = await db
                    .select({ count: count().as('count'), rEntityTag })
                    .from(events)
                    .innerJoin(
                        rEntityTag,
                        and(
                            eq(rEntityTag.entityId, events.id),
                            eq(rEntityTag.tagId, tagId),
                            eq(rEntityTag.entityType, 'EVENT')
                        )
                    )
                    .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
                dbLogger.query({ table: 'events', action: 'count', params, result });
                return Number(result[0]?.count ?? 0);
            }
            // Query sin innerJoin
            const result = await db
                .select({ count: count().as('count') })
                .from(events)
                .where(whereClauses.length > 0 ? and(...whereClauses) : undefined);
            dbLogger.query({ table: 'events', action: 'count', params, result });
            return Number(result[0]?.count ?? 0);
        } catch (error) {
            dbLogger.error(error, 'EventModel.count');
            throw new Error(`Failed to count events: ${(error as Error).message}`);
        }
    },

    /**
     * Get an event by ID, including specified relations.
     */
    async getWithRelations<T extends EventRelations>(
        id: string,
        withRelations: T
    ): Promise<(EventWithRelationsType & EventRelationResult<T>) | undefined> {
        const db = getDb();
        try {
            const result = await db.query.events.findFirst({
                where: (e, { eq }) => eq(e.id, id),
                with: withRelations as Record<string, true>
            });
            dbLogger.query({
                table: 'events',
                action: 'getWithRelations',
                params: { id, with: withRelations },
                result
            });
            return result as (EventWithRelationsType & EventRelationResult<T>) | undefined;
        } catch (error) {
            dbLogger.error(error, 'EventModel.getWithRelations');
            throw new Error(`Failed to get event with relations: ${(error as Error).message}`);
        }
    },

    /**
     * Get events by tag.
     */
    async getByTag(tagId: string): Promise<EventType[]> {
        const db = getDb();
        try {
            const result = await db
                .select({ events, rEntityTag })
                .from(events)
                .innerJoin(
                    rEntityTag,
                    and(
                        eq(rEntityTag.entityId, events.id),
                        eq(rEntityTag.tagId, tagId),
                        eq(rEntityTag.entityType, 'EVENT')
                    )
                );
            dbLogger.query({
                table: 'events',
                action: 'getByTag',
                params: { tagId },
                result
            });
            return result.map((row) => row.events as EventType);
        } catch (error) {
            dbLogger.error(error, 'EventModel.getByTag');
            throw new Error(`Failed to get events by tag: ${(error as Error).message}`);
        }
    },

    /**
     * Get events by organizer.
     */
    async getByOrganizer(organizerId: string): Promise<EventType[]> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(events)
                .where(eq(events.organizerId, organizerId));
            dbLogger.query({
                table: 'events',
                action: 'getByOrganizer',
                params: { organizerId },
                result
            });
            return result as EventType[];
        } catch (error) {
            dbLogger.error(error, 'EventModel.getByOrganizer');
            throw new Error(`Failed to get events by organizer: ${(error as Error).message}`);
        }
    },

    /**
     * Get events by destination (via event location).
     */
    async getByDestination(city: string): Promise<EventType[]> {
        const db = getDb();
        try {
            // Find events whose location.city matches the destination
            const result = await db
                .select({ events, eventLocations })
                .from(events)
                .innerJoin(
                    eventLocations,
                    and(eq(eventLocations.id, events.locationId), eq(eventLocations.city, city))
                );
            dbLogger.query({
                table: 'events',
                action: 'getByDestination',
                params: { city },
                result
            });
            return result.map((row) => row.events as EventType);
        } catch (error) {
            dbLogger.error(error, 'EventModel.getByDestination');
            throw new Error(`Failed to get events by destination: ${(error as Error).message}`);
        }
    }
};
