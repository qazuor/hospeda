import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull, or } from 'drizzle-orm';
import type { BaseSelectFilter, UpdateData } from 'src/types/db.types';
import { db } from '../client';
import { events } from '../schema/event.dbschema';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

/**
 * Scoped logger for event model operations.
 */
const log = logger.createLogger('EventModel');

/**
 * Full event record as returned by the database.
 */
export type EventRecord = InferSelectModel<typeof events>;

/**
 * Data required to create a new event.
 */
export type CreateEventData = InferInsertModel<typeof events>;

/**
 * Fields allowed for updating an event.
 */
export type UpdateEventData = UpdateData<CreateEventData>;

/**
 * Filter options for listing events.
 */
export interface SelectEventFilter extends BaseSelectFilter {
    /** Filter by category */
    category?: string;
}

/**
 * EventModel provides CRUD operations for the events table.
 */
export const EventModel = {
    /**
     * Create a new event record.
     *
     * @param data - Fields required to create the event
     * @returns The created event record
     */
    async createEvent(data: CreateEventData): Promise<EventRecord> {
        try {
            log.info('creating a new event', 'createEvent', data);
            const rows = castReturning<EventRecord>(
                await db.insert(events).values(data).returning()
            );
            const ev = assertExists(rows[0], 'createEvent: no record returned');
            log.query('insert', 'events', data, ev);
            return ev;
        } catch (error) {
            log.error('createEvent failed', 'createEvent', error);
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
            log.info('fetching event by id', 'getEventById', { id });
            const [ev] = (await db
                .select()
                .from(events)
                .where(eq(events.id, id))
                .limit(1)) as EventRecord[];
            log.query('select', 'events', { id }, ev);
            return ev;
        } catch (error) {
            log.error('getEventById failed', 'getEventById', error);
            throw error;
        }
    },

    /**
     * List events with optional filters, pagination, and search.
     *
     * @param filter - Pagination and filtering options
     * @returns Array of event records
     */
    async listEvents(filter: SelectEventFilter): Promise<EventRecord[]> {
        try {
            log.info('listing events', 'listEvents', filter);
            let query = rawSelect(db.select().from(events));

            if (filter.query) {
                const term = `%${filter.query}%`;
                query = query.where(or(ilike(events.name, term), ilike(events.summary, term)));
            }

            if (filter.category) {
                query = query.where(eq(events.category, filter.category));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(events.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(events.createdAt, 'desc')) as EventRecord[];

            log.query('select', 'events', filter, rows);
            return rows;
        } catch (error) {
            log.error('listEvents failed', 'listEvents', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing event.
     *
     * @param id - UUID of the event to update
     * @param changes - Partial fields to update
     * @returns The updated event record
     */
    async updateEvent(id: string, changes: UpdateEventData): Promise<EventRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating event', 'updateEvent', { id, dataToUpdate });
            const rows = castReturning<EventRecord>(
                await db.update(events).set(dataToUpdate).where(eq(events.id, id)).returning()
            );
            const updated = assertExists(rows[0], `updateEvent: no event found for id ${id}`);
            log.query('update', 'events', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateEvent failed', 'updateEvent', error);
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
            log.info('soft deleting event', 'softDeleteEvent', { id });
            await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, id));
            log.query('update', 'events', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteEvent failed', 'softDeleteEvent', error);
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
            log.info('restoring event', 'restoreEvent', { id });
            await db.update(events).set({ deletedAt: null }).where(eq(events.id, id));
            log.query('update', 'events', { id }, { restored: true });
        } catch (error) {
            log.error('restoreEvent failed', 'restoreEvent', error);
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
            log.info('hard deleting event', 'hardDeleteEvent', { id });
            await db.delete(events).where(eq(events.id, id));
            log.query('delete', 'events', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteEvent failed', 'hardDeleteEvent', error);
            throw error;
        }
    }
};
