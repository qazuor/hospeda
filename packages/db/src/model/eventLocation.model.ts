import { logger } from '@repo/logger';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../client';
import { eventLocations } from '../schema/event_location.dbschema';
import type {
    InsertEventLocation,
    SelectEventLocationFilter,
    UpdateEventLocationData
} from '../types/db-types';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils';

/**
 * Scoped logger for event location model operations.
 */
const log = logger.createLogger('EventLocationModel');

/**
 * Full event location record as returned by the database.
 */
export type EventLocationRecord = InferSelectModel<typeof eventLocations>;

/**
 * EventLocationModel provides CRUD operations for the event_locations table.
 */
export const EventLocationModel = {
    /**
     * Create a new location.
     *
     * @param data - Fields required to create the location (InsertEventLocation type from db-types)
     * @returns The created location record
     */
    async createLocation(data: InsertEventLocation): Promise<EventLocationRecord> {
        try {
            log.info('creating event location', 'createLocation', data);
            const rows = castReturning<EventLocationRecord>(
                await db.insert(eventLocations).values(data).returning()
            );
            const loc = assertExists(rows[0], 'createLocation: no location returned');
            log.query('insert', 'event_locations', data, loc);
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
            const [loc] = await db
                .select()
                .from(eventLocations)
                .where(eq(eventLocations.id, id))
                .limit(1);
            log.query('select', 'event_locations', { id }, loc);
            return loc ? (loc as EventLocationRecord) : undefined;
        } catch (error) {
            log.error('getLocationById failed', 'getLocationById', error);
            throw error;
        }
    },

    /**
     * List locations with optional filters, pagination, and search.
     *
     * @param filter - Filtering and pagination options (SelectEventLocationFilter type from db-types)
     * @returns Array of location records
     */
    async listLocations(filter: SelectEventLocationFilter): Promise<EventLocationRecord[]> {
        try {
            log.info('listing locations', 'listLocations', filter);

            let query = db.select().from(eventLocations).$dynamic();

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(
                    or(
                        ilike(eventLocations.name, term),
                        ilike(eventLocations.displayName, term),
                        ilike(eventLocations.street, term),
                        ilike(eventLocations.city, term),
                        ilike(eventLocations.neighborhood, term),
                        ilike(eventLocations.placeName, term)
                    )
                );
            }

            if (filter.state) {
                // Now using the inherited 'state' filter for the 'state' column
                query = query.where(eq(eventLocations.state, filter.state));
            }

            if (filter.country) {
                query = query.where(eq(eventLocations.country, filter.country));
            }

            if (filter.city) {
                query = query.where(eq(eventLocations.city, filter.city));
            }

            if (filter.zipCode) {
                // Added zipCode filter
                query = query.where(eq(eventLocations.zipCode, filter.zipCode));
            }

            if (filter.createdById) {
                // Added createdById filter
                query = query.where(eq(eventLocations.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                // Added updatedById filter
                query = query.where(eq(eventLocations.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                // Added deletedById filter
                query = query.where(eq(eventLocations.deletedById, filter.deletedById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(eventLocations.deletedAt));
            }

            // Use the getOrderByColumn utility
            const orderByColumn = getOrderByColumn(
                eventLocations,
                filter.orderBy,
                eventLocations.createdAt
            );
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as EventLocationRecord[];

            log.query('select', 'event_locations', filter, rows);
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
     * @param changes - Partial fields to update (UpdateEventLocationData type from db-types)
     * @returns The updated location record
     */
    async updateLocation(
        id: string,
        changes: UpdateEventLocationData
    ): Promise<EventLocationRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating location', 'updateLocation', {
                id,
                changes: dataToUpdate
            });
            const rows = castReturning<EventLocationRecord>(
                await db
                    .update(eventLocations)
                    .set(dataToUpdate)
                    .where(eq(eventLocations.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateLocation: no location found for id ${id}`);
            log.query('update', 'event_locations', { id, changes: dataToUpdate }, updated);
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
            log.query('update', 'event_locations', { id }, { deleted: true });
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
            log.query('update', 'event_locations', { id }, { restored: true });
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
            log.query('delete', 'event_locations', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteLocation failed', 'hardDeleteLocation', error);
            throw error;
        }
    }
};
