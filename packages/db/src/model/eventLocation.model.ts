import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull, or } from 'drizzle-orm';
import type { BaseSelectFilter, UpdateData } from 'src/types/db.types';
import { db } from '../client';
import { eventLocations } from '../schema/event_location.dbschema';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

/**
 * Scoped logger for EventLocationModel operations.
 */
const log = logger.createLogger('EventLocationModel');

/**
 * Full event location record as returned by the database.
 */
export type EventLocationRecord = InferSelectModel<typeof eventLocations>;

/**
 * Data required to create a new event location.
 */
export type CreateEventLocationData = InferInsertModel<typeof eventLocations>;

/**
 * Fields allowed for updating an event location.
 */
export type UpdateEventLocationData = UpdateData<CreateEventLocationData>;

/**
 * Filter options for listing locations.
 */
export interface SelectEventLocationFilter extends BaseSelectFilter {
    /** Optional fuzzy search on placeName or city */
    query?: string;
    /** Include soft-deleted if true */
    includeDeleted?: boolean;
}

/**
 * EventLocationModel provides CRUD operations for the event_location table.
 */
export const EventLocationModel = {
    /**
     * Create a new location.
     *
     * @param data - Fields required to create the location
     * @returns The created location record
     */
    async createLocation(data: CreateEventLocationData): Promise<EventLocationRecord> {
        try {
            log.info('creating event location', 'createLocation', data);
            const rows = castReturning<EventLocationRecord>(
                await db.insert(eventLocations).values(data).returning()
            );
            const loc = assertExists(rows[0], 'createLocation: no location returned');
            log.query('insert', 'event_location', data, loc);
            return loc;
        } catch (error) {
            log.error('createLocation failed', 'createLocation', error);
            throw error;
        }
    },

    /**
     * Fetch a single location by ID.
     *
     * @param id - UUID of the location
     * @returns The location record or undefined if not found
     */
    async getLocationById(id: string): Promise<EventLocationRecord | undefined> {
        try {
            log.info('fetching location by id', 'getLocationById', { id });
            const [loc] = (await db
                .select()
                .from(eventLocations)
                .where(eq(eventLocations.id, id))
                .limit(1)) as EventLocationRecord[];
            log.query('select', 'event_location', { id }, loc);
            return loc;
        } catch (error) {
            log.error('getLocationById failed', 'getLocationById', error);
            throw error;
        }
    },

    /**
     * List locations with optional search.
     *
     * @param filter - Filtering and pagination options
     * @returns Array of location records
     */
    async listLocations(filter: SelectEventLocationFilter): Promise<EventLocationRecord[]> {
        try {
            log.info('listing locations', 'listLocations', filter);

            let query = rawSelect(db.select().from(eventLocations));

            if (filter.query) {
                const term = `%${filter.query}%`;
                query = query.where(
                    or(ilike(eventLocations.placeName, term), ilike(eventLocations.city, term))
                );
            }
            if (!filter.includeDeleted) {
                query = query.where(isNull(eventLocations.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(eventLocations.createdAt, 'desc')) as EventLocationRecord[];

            log.query('select', 'event_location', filter, rows);
            return rows;
        } catch (error) {
            log.error('listLocations failed', 'listLocations', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing location.
     *
     * @param id - UUID of the location to update
     * @param changes - Partial fields to update
     * @returns The updated location record
     */
    async updateLocation(
        id: string,
        changes: UpdateEventLocationData
    ): Promise<EventLocationRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating location', 'updateLocation', { id, changes: dataToUpdate });
            const rows = castReturning<EventLocationRecord>(
                await db
                    .update(eventLocations)
                    .set(dataToUpdate)
                    .where(eq(eventLocations.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateLocation: no location for id ${id}`);
            log.query('update', 'event_location', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateLocation failed', 'updateLocation', error);
            throw error;
        }
    },

    /**
     * Soft-delete a location by setting the deletedAt timestamp.
     *
     * @param id - UUID of the location
     */
    async softDeleteLocation(id: string): Promise<void> {
        try {
            log.info('soft deleting location', 'softDeleteLocation', { id });
            await db
                .update(eventLocations)
                .set({ deletedAt: new Date() })
                .where(eq(eventLocations.id, id));
            log.query('update', 'event_location', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteLocation failed', 'softDeleteLocation', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted location by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the location
     */
    async restoreLocation(id: string): Promise<void> {
        try {
            log.info('restoring location', 'restoreLocation', { id });
            await db
                .update(eventLocations)
                .set({ deletedAt: null })
                .where(eq(eventLocations.id, id));
            log.query('update', 'event_location', { id }, { restored: true });
        } catch (error) {
            log.error('restoreLocation failed', 'restoreLocation', error);
            throw error;
        }
    },

    /**
     * Permanently delete a location record from the database.
     *
     * @param id - UUID of the location
     */
    async hardDeleteLocation(id: string): Promise<void> {
        try {
            log.info('hard deleting location', 'hardDeleteLocation', { id });
            await db.delete(eventLocations).where(eq(eventLocations.id, id));
            log.query('delete', 'event_location', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteLocation failed', 'hardDeleteLocation', error);
            throw error;
        }
    }
};
