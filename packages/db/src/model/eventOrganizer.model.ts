import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull, or } from 'drizzle-orm';
import type { BaseSelectFilter, UpdateData } from 'src/types/db-types';
import { db } from '../client';
import { eventOrganizers } from '../schema/event_organizer.dbschema';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

/**
 * Scoped logger for EventOrganizerModel operations.
 */
const log = logger.createLogger('EventOrganizerModel');

/**
 * Full event organizer record as returned by the database.
 */
export type EventOrganizerRecord = InferSelectModel<typeof eventOrganizers>;

/**
 * Data required to create a new event organizer.
 */
export type CreateEventOrganizerData = InferInsertModel<typeof eventOrganizers>;

/**
 * Fields allowed for updating an event organizer.
 */
export type UpdateEventOrganizerData = UpdateData<CreateEventOrganizerData>;

/**
 * Filter options for listing organizers.
 */
export interface SelectEventOrganizerFilter extends BaseSelectFilter {
    /** Optional fuzzy search on name or description */
    query?: string;
    /** Include soft-deleted if true */
    includeDeleted?: boolean;
}

/**
 * EventOrganizerModel provides CRUD operations for the event_organizer table.
 */
export const EventOrganizerModel = {
    /**
     * Create a new organizer.
     *
     * @param data - Fields required to create the organizer
     * @returns The created organizer record
     */
    async createOrganizer(data: CreateEventOrganizerData): Promise<EventOrganizerRecord> {
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
            const [org] = (await db
                .select()
                .from(eventOrganizers)
                .where(eq(eventOrganizers.id, id))
                .limit(1)) as EventOrganizerRecord[];
            log.query('select', 'event_organizer', { id }, org);
            return org;
        } catch (error) {
            log.error('getOrganizerById failed', 'getOrganizerById', error);
            throw error;
        }
    },

    /**
     * List organizers with optional search.
     *
     * @param filter - Filtering and pagination options
     * @returns Array of organizer records
     */
    async listOrganizers(filter: SelectEventOrganizerFilter): Promise<EventOrganizerRecord[]> {
        try {
            log.info('listing organizers', 'listOrganizers', filter);

            let query = rawSelect(db.select().from(eventOrganizers));

            if (filter.query) {
                const term = `%${filter.query}%`;
                query = query.where(
                    or(ilike(eventOrganizers.name, term), ilike(eventOrganizers.description, term))
                );
            }
            if (!filter.includeDeleted) {
                query = query.where(isNull(eventOrganizers.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(eventOrganizers.createdAt, 'desc')) as EventOrganizerRecord[];

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
     * @param changes - Partial fields to update
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
