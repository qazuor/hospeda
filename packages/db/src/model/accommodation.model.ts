import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull, or } from 'drizzle-orm';
import type { BaseSelectFilter, UpdateData } from 'src/types/db-types';
import { db } from '../client';
import { accommodations } from '../schema/accommodation.dbschema';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

/**
 * Scoped logger for accommodation model operations.
 */
const log = logger.createLogger('AccommodationModel');

/**
 * Full accommodation record as returned by the database.
 */
export type AccommodationRecord = InferSelectModel<typeof accommodations>;

/**
 * Data required to create a new accommodation.
 */
export type CreateAccommodationData = InferInsertModel<typeof accommodations>;

/**
 * Fields allowed for updating an accommodation.
 */
export type UpdateAccommodationData = UpdateData<CreateAccommodationData>;

/**
 * Filter options for listing accommodations.
 */
export interface SelectAccommodationFilter extends BaseSelectFilter {
    /** Filter by destination ID */
    destinationId?: string;
}

/**
 * AccommodationModel provides CRUD operations for the accommodations table.
 */
export const AccommodationModel = {
    /**
     * Create a new accommodation record.
     *
     * @param data - Fields required to create the accommodation
     * @returns The created accommodation record
     */
    async createAccommodation(data: CreateAccommodationData): Promise<AccommodationRecord> {
        try {
            log.info('creating a new accommodation', 'createAccommodation', data);
            const rows = castReturning<AccommodationRecord>(
                await db.insert(accommodations).values(data).returning()
            );
            const acc = assertExists(rows[0], 'createAccommodation: no record returned');
            log.query('insert', 'accommodations', data, acc);
            return acc;
        } catch (error) {
            log.error('createAccommodation failed', 'createAccommodation', error);
            throw error;
        }
    },

    /**
     * Fetch a single accommodation by ID.
     *
     * @param id - UUID of the accommodation
     * @returns The accommodation record or undefined if not found
     */
    async getAccommodationById(id: string): Promise<AccommodationRecord | undefined> {
        try {
            log.info('fetching accommodation by id', 'getAccommodationById', { id });
            const [acc] = (await db
                .select()
                .from(accommodations)
                .where(eq(accommodations.id, id))
                .limit(1)) as AccommodationRecord[];
            log.query('select', 'accommodations', { id }, acc);
            return acc;
        } catch (error) {
            log.error('getAccommodationById failed', 'getAccommodationById', error);
            throw error;
        }
    },

    /**
     * List accommodations with optional filters, pagination, and search.
     *
     * @param filter - Pagination and filtering options
     * @returns Array of accommodation records
     */
    async listAccommodations(filter: SelectAccommodationFilter): Promise<AccommodationRecord[]> {
        try {
            log.info('listing accommodations', 'listAccommodations', filter);
            let query = rawSelect(db.select().from(accommodations));

            if (filter.query) {
                const term = `%${filter.query}%`;
                query = query.where(
                    or(ilike(accommodations.name, term), ilike(accommodations.slug, term))
                );
            }

            if (filter.destinationId) {
                query = query.where(eq(accommodations.destinationId, filter.destinationId));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(accommodations.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(accommodations.createdAt, 'desc')) as AccommodationRecord[];

            log.query('select', 'accommodations', filter, rows);
            return rows;
        } catch (error) {
            log.error('listAccommodations failed', 'listAccommodations', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing accommodation.
     *
     * @param id - UUID of the accommodation to update
     * @param changes - Partial fields to update
     * @returns The updated accommodation record
     */
    async updateAccommodation(
        id: string,
        changes: UpdateAccommodationData
    ): Promise<AccommodationRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating accommodation', 'updateAccommodation', {
                id,
                dataToUpdate
            });
            const rows = castReturning<AccommodationRecord>(
                await db
                    .update(accommodations)
                    .set(dataToUpdate)
                    .where(eq(accommodations.id, id))
                    .returning()
            );
            const updated = assertExists(
                rows[0],
                `updateAccommodation: no record found for id ${id}`
            );
            log.query('update', 'accommodations', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateAccommodation failed', 'updateAccommodation', error);
            throw error;
        }
    },

    /**
     * Soft-delete an accommodation by setting the deletedAt timestamp.
     *
     * @param id - UUID of the accommodation
     */
    async softDeleteAccommodation(id: string): Promise<void> {
        try {
            log.info('soft deleting accommodation', 'softDeleteAccommodation', {
                id
            });
            await db
                .update(accommodations)
                .set({ deletedAt: new Date() })
                .where(eq(accommodations.id, id));
            log.query('update', 'accommodations', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteAccommodation failed', 'softDeleteAccommodation', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted accommodation by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the accommodation
     */
    async restoreAccommodation(id: string): Promise<void> {
        try {
            log.info('restoring accommodation', 'restoreAccommodation', { id });
            await db
                .update(accommodations)
                .set({ deletedAt: null })
                .where(eq(accommodations.id, id));
            log.query('update', 'accommodations', { id }, { restored: true });
        } catch (error) {
            log.error('restoreAccommodation failed', 'restoreAccommodation', error);
            throw error;
        }
    },

    /**
     * Permanently delete an accommodation record from the database.
     *
     * @param id - UUID of the accommodation
     */
    async hardDeleteAccommodation(id: string): Promise<void> {
        try {
            log.info('hard deleting accommodation', 'hardDeleteAccommodation', {
                id
            });
            await db.delete(accommodations).where(eq(accommodations.id, id));
            log.query('delete', 'accommodations', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteAccommodation failed', 'hardDeleteAccommodation', error);
            throw error;
        }
    }
};
