import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '../client.js';
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
            dbLogger.info(data, 'creating event organizer');
            const db = getDb();
            const rows = castReturning<EventOrganizerRecord>(
                await db.insert(eventOrganizers).values(data).returning()
            );
            const org = assertExists(rows[0], 'createOrganizer: no organizer returned');
            dbLogger.query({
                table: 'event_organizer',
                action: 'insert',
                params: data,
                result: org
            });
            return org;
        } catch (error) {
            dbLogger.error(error, 'createOrganizer failed');
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
            dbLogger.info({ id }, 'fetching organizer by id');
            const db = getDb();
            const [org] = await db
                .select()
                .from(eventOrganizers)
                .where(eq(eventOrganizers.id, id))
                .limit(1);
            dbLogger.query({
                table: 'event_organizer',
                action: 'select',
                params: { id },
                result: org
            });
            return org ? (org as EventOrganizerRecord) : undefined;
        } catch (error) {
            dbLogger.error(error, 'getOrganizerById failed');
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
            dbLogger.info(filter, 'listing organizers');
            const db = getDb();
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

            dbLogger.query({
                table: 'event_organizer',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listOrganizers failed');
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
            dbLogger.info({ id, changes: dataToUpdate }, 'updating organizer');
            const db = getDb();
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
            dbLogger.query({
                table: 'event_organizer',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateOrganizer failed');
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
            dbLogger.info({ id }, 'soft deleting organizer');
            const db = getDb();
            await db
                .update(eventOrganizers)
                .set({ deletedAt: new Date() })
                .where(eq(eventOrganizers.id, id));
            dbLogger.query({
                table: 'event_organizer',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteOrganizer failed');
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
            dbLogger.info({ id }, 'restoring organizer');
            const db = getDb();
            await db
                .update(eventOrganizers)
                .set({ deletedAt: null })
                .where(eq(eventOrganizers.id, id));
            dbLogger.query({
                table: 'event_organizer',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreOrganizer failed');
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
            dbLogger.info({ id }, 'hard deleting organizer');
            const db = getDb();
            await db.delete(eventOrganizers).where(eq(eventOrganizers.id, id));
            dbLogger.query({
                table: 'event_organizer',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteOrganizer failed');
            throw error;
        }
    }
};
