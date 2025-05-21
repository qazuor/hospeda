import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '../client.js';
import { events } from '../schema/event.dbschema.js';
import type { InsertEvent, SelectEventFilter, UpdateEventData } from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Full event record as returned by the database.
 */
export type EventRecord = InferSelectModel<typeof events>;

/**
 * EventModel provides CRUD operations for the events table.
 */
export const EventModel = {
    /**
     * Create a new event record.
     *
     * @param data - Fields required to create the event (InsertEvent type from db-types)
     * @returns The created event record
     */
    async createEvent(data: InsertEvent): Promise<EventRecord> {
        try {
            dbLogger.info(data, 'creating a new event');
            const db = getDb();
            const rows = castReturning<EventRecord>(
                await db.insert(events).values(data).returning()
            );
            const event = assertExists(rows[0], 'createEvent: no record returned');
            dbLogger.query({
                table: 'events',
                action: 'insert',
                params: data,
                result: event
            });
            return event;
        } catch (error) {
            dbLogger.error(error, 'createEvent failed');
            throw error;
        }
    },

    /**
     * Fetch a single event by ID.
     *
     * @param id - UUID of the event
     * @returns The event record or undefined if not found
     */
    async getEventById(id: string): Promise<EventRecord | undefined> {
        try {
            dbLogger.info({ id }, 'fetching event by id');
            const db = getDb();
            const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
            dbLogger.query({
                table: 'events',
                action: 'select',
                params: { id },
                result: event
            });
            return event ? (event as EventRecord) : undefined;
        } catch (error) {
            dbLogger.error(error, 'getEventById failed');
            throw error;
        }
    },

    /**
     * List events with optional filters, pagination, and search.
     *
     * @param filter - Pagination and filtering options (SelectEventFilter type from db-types)
     * @returns Array of event records
     */
    async listEvents(filter: SelectEventFilter): Promise<EventRecord[]> {
        try {
            dbLogger.info(filter, 'listing events');
            const db = getDb();
            let query = db.select().from(events).$dynamic();

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(
                    or(
                        ilike(events.name, term),
                        ilike(events.displayName, term),
                        ilike(events.summary, term),
                        ilike(events.description, term),
                        ilike(events.slug, term)
                    )
                );
            }

            if (filter.category) {
                query = query.where(eq(events.category, filter.category));
            }

            if (filter.authorId) {
                query = query.where(eq(events.authorId, filter.authorId));
            }

            if (filter.locationId) {
                query = query.where(eq(events.locationId, filter.locationId));
            }

            if (filter.organizerId) {
                query = query.where(eq(events.organizerId, filter.organizerId));
            }

            if (filter.visibility) {
                query = query.where(eq(events.visibility, filter.visibility));
            }

            if (typeof filter.isFeatured === 'boolean') {
                query = query.where(eq(events.isFeatured, filter.isFeatured));
            }

            if (filter.state) {
                query = query.where(eq(events.state, filter.state));
            }

            if (filter.createdById) {
                // Added createdById filter
                query = query.where(eq(events.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                // Added updatedById filter
                query = query.where(eq(events.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                // Added deletedById filter
                query = query.where(eq(events.deletedById, filter.deletedById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(events.deletedAt));
            }

            // Use the getOrderByColumn utility
            const orderByColumn = getOrderByColumn(events, filter.orderBy, events.createdAt);
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as EventRecord[];

            dbLogger.query({
                table: 'events',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listEvents failed');
            throw error;
        }
    },

    /**
     * Update fields on an existing event.
     *
     * @param id - UUID of the event to update
     * @param changes - Partial fields to update (UpdateEventData type from db-types)
     * @returns The updated event record
     */
    async updateEvent(id: string, changes: UpdateEventData): Promise<EventRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            dbLogger.info({ id, changes: dataToUpdate }, 'updating event');
            const db = getDb();
            const rows = castReturning<EventRecord>(
                await db.update(events).set(dataToUpdate).where(eq(events.id, id)).returning()
            );
            const updated = assertExists(rows[0], `updateEvent: no event found for id ${id}`);
            dbLogger.query({
                table: 'events',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateEvent failed');
            throw error;
        }
    },

    /**
     * Soft-delete an event by setting the deletedAt timestamp.
     *
     * @param id - UUID of the event
     */
    async softDeleteEvent(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'soft deleting event');
            const db = getDb();
            await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, id));
            dbLogger.query({
                table: 'events',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteEvent failed');
            throw error;
        }
    },

    /**
     * Restore a soft-deleted event by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the event
     */
    async restoreEvent(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'restoring event');
            const db = getDb();
            await db.update(events).set({ deletedAt: null }).where(eq(events.id, id));
            dbLogger.query({
                table: 'events',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreEvent failed');
            throw error;
        }
    },

    /**
     * Permanently delete an event record from the database.
     *
     * @param id - UUID of the event
     */
    async hardDeleteEvent(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'hard deleting event');
            const db = getDb();
            await db.delete(events).where(eq(events.id, id));
            dbLogger.query({
                table: 'events',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteEvent failed');
            throw error;
        }
    }
};
