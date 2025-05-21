import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '../client.js';
import { eventLocations } from '../schema/event_location.dbschema.js';
import type {
    InsertEventLocation,
    SelectEventLocationFilter,
    UpdateEventLocationData
} from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

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
            dbLogger.info(data, 'creating event location');
            const db = getDb();
            const rows = castReturning<EventLocationRecord>(
                await db.insert(eventLocations).values(data).returning()
            );
            const loc = assertExists(rows[0], 'createLocation: no location returned');
            dbLogger.query({
                table: 'event_locations',
                action: 'insert',
                params: data,
                result: loc
            });
            return loc;
        } catch (error) {
            dbLogger.error(error, 'createLocation failed');
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
            dbLogger.info({ id }, 'fetching location by id');
            const db = getDb();
            const [loc] = await db
                .select()
                .from(eventLocations)
                .where(eq(eventLocations.id, id))
                .limit(1);
            dbLogger.query({
                table: 'event_locations',
                action: 'select',
                params: { id },
                result: loc
            });
            return loc ? (loc as EventLocationRecord) : undefined;
        } catch (error) {
            dbLogger.error(error, 'getLocationById failed');
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
            dbLogger.info(filter, 'listing locations');
            const db = getDb();
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

            dbLogger.query({
                table: 'event_locations',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listLocations failed');
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
            dbLogger.info({ id, changes: dataToUpdate }, 'updating location');
            const db = getDb();
            const rows = castReturning<EventLocationRecord>(
                await db
                    .update(eventLocations)
                    .set(dataToUpdate)
                    .where(eq(eventLocations.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateLocation: no location found for id ${id}`);
            dbLogger.query({
                table: 'event_locations',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateLocation failed');
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
            dbLogger.info({ id }, 'soft deleting location');
            const db = getDb();
            await db
                .update(eventLocations)
                .set({ deletedAt: new Date() })
                .where(eq(eventLocations.id, id));
            dbLogger.query({
                table: 'event_locations',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteLocation failed');
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
            dbLogger.info({ id }, 'restoring location');
            const db = getDb();
            await db
                .update(eventLocations)
                .set({ deletedAt: null })
                .where(eq(eventLocations.id, id));
            dbLogger.query({
                table: 'event_locations',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreLocation failed');
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
            dbLogger.info({ id }, 'hard deleting location');
            const db = getDb();
            await db.delete(eventLocations).where(eq(eventLocations.id, id));
            dbLogger.query({
                table: 'event_locations',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteLocation failed');
            throw error;
        }
    }
};
