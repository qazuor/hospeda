import { logger } from '@repo/logger';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../client.js';
import { eventOrganizers } from '../schema/event_organizer.dbschema.js';
import type {
    InsertEventOrganizer,
    SelectEventOrganizerFilter,
    UpdateEventOrganizerData
} from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Scoped logger for EventOrganizerModel operations.
 */
const log = logger.createLogger('EventOrganizerModel');

/**
 * Full event organizer record as returned by the database.
 */
export type EventOrganizerRecord = InferSelectModel<typeof eventOrganizers>;

/**
 * EventOrganizerModel provides CRUD operations for the event_organizer table.
 */
export const EventOrganizerModel = {
    /**
     * Create a new organizer.
     *
     * @param data - Fields required to create the organizer (InsertEventOrganizer type from db-types)
     * @returns The created organizer record
     */
    async createOrganizer(data: InsertEventOrganizer): Promise<EventOrganizerRecord> {
        try {
            log.info('creating event organizer', 'createOrganizer', data);
            const rows = castReturning<EventOrganizerRecord>(
                await db.insert(eventOrganizers).values(data).returning()
            );
            const org = assertExists(rows[0], 'createOrganizer: no organizer returned');
            log.query('insert', 'event_organizer', data, org);
            return org;
        } catch (error) {
            log.error('createOrganizer failed', 'createOrganizer', error);
            throw error;
        }
    },

    /**
     * Fetch a single organizer by ID.
     *
     * @param id - UUID of the organizer
     * @returns The organizer record or undefined if not found
     */
    async getOrganizerById(id: string): Promise<EventOrganizerRecord | undefined> {
        try {
            log.info('fetching organizer by id', 'getOrganizerById', { id });
            const [org] = await db
                .select()
                .from(eventOrganizers)
                .where(eq(eventOrganizers.id, id))
                .limit(1);
            log.query('select', 'event_organizer', { id }, org);
            return org ? (org as EventOrganizerRecord) : undefined;
        } catch (error) {
            log.error('getOrganizerById failed', 'getOrganizerById', error);
            throw error;
        }
    },

    /**
     * List organizers with optional filters, pagination, and search.
     *
     * @param filter - Filtering and pagination options (SelectEventOrganizerFilter type from db-types)
     * @returns Array of organizer records
     */
    async listOrganizers(filter: SelectEventOrganizerFilter): Promise<EventOrganizerRecord[]> {
        try {
            log.info('listing organizers', 'listOrganizers', filter);

            let query = db.select().from(eventOrganizers).$dynamic();

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(
                    or(ilike(eventOrganizers.name, term), ilike(eventOrganizers.displayName, term)) // Changed description to displayName based on schema
                );
            }

            if (filter.state) {
                // Using the inherited 'state' filter
                query = query.where(eq(eventOrganizers.state, filter.state));
            }

            if (filter.createdById) {
                // Added createdById filter
                query = query.where(eq(eventOrganizers.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                // Added updatedById filter
                query = query.where(eq(eventOrganizers.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                // Added deletedById filter
                query = query.where(eq(eventOrganizers.deletedById, filter.deletedById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(eventOrganizers.deletedAt));
            }

            // Use the getOrderByColumn utility
            const orderByColumn = getOrderByColumn(
                eventOrganizers,
                filter.orderBy,
                eventOrganizers.createdAt
            );
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as EventOrganizerRecord[];

            log.query('select', 'event_organizer', filter, rows);
            return rows;
        } catch (error) {
            log.error('listOrganizers failed', 'listOrganizers', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing organizer.
     *
     * @param id - UUID of the organizer to update
     * @param changes - Partial fields to update (UpdateEventOrganizerData type from db-types)
     * @returns The updated organizer record
     */
    async updateOrganizer(
        id: string,
        changes: UpdateEventOrganizerData
    ): Promise<EventOrganizerRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating organizer', 'updateOrganizer', {
                id,
                changes: dataToUpdate
            });
            const rows = castReturning<EventOrganizerRecord>(
                await db
                    .update(eventOrganizers)
                    .set(dataToUpdate)
                    .where(eq(eventOrganizers.id, id))
                    .returning()
            );
            const updated = assertExists(
                rows[0],
                `updateOrganizer: no organizer found for id ${id}`
            );
            log.query('update', 'event_organizer', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateOrganizer failed', 'updateOrganizer', error);
            throw error;
        }
    },

    /**
     * Soft-delete an organizer by setting the deletedAt timestamp.
     *
     * @param id - UUID of the organizer
     */
    async softDeleteOrganizer(id: string): Promise<void> {
        try {
            log.info('soft deleting organizer', 'softDeleteOrganizer', { id });
            await db
                .update(eventOrganizers)
                .set({ deletedAt: new Date() })
                .where(eq(eventOrganizers.id, id));
            log.query('update', 'event_organizer', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteOrganizer failed', 'softDeleteOrganizer', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted organizer by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the organizer
     */
    async restoreOrganizer(id: string): Promise<void> {
        try {
            log.info('restoring organizer', 'restoreOrganizer', { id });
            await db
                .update(eventOrganizers)
                .set({ deletedAt: null })
                .where(eq(eventOrganizers.id, id));
            log.query('update', 'event_organizer', { id }, { restored: true });
        } catch (error) {
            log.error('restoreOrganizer failed', 'restoreOrganizer', error);
            throw error;
        }
    },

    /**
     * Permanently delete an organizer record from the database.
     *
     * @param id - UUID of the organizer
     */
    async hardDeleteOrganizer(id: string): Promise<void> {
        try {
            log.info('hard deleting organizer', 'hardDeleteOrganizer', { id });
            await db.delete(eventOrganizers).where(eq(eventOrganizers.id, id));
            log.query('delete', 'event_organizer', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteOrganizer failed', 'hardDeleteOrganizer', error);
            throw error;
        }
    }
};
