import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '../client.js';
import { accommodationIaData } from '../schema/accommodation_ia_data.dbschema.js';
import type { BaseSelectFilter, UpdateData } from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    rawSelect,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Full accommodation IA data record as returned by the database.
 */
export type AccommodationIaDataRecord = InferSelectModel<typeof accommodationIaData>;

/**
 * Data required to create a new accommodation IA data entry.
 */
export type CreateAccommodationIaData = InferInsertModel<typeof accommodationIaData>;

/**
 * Fields allowed for updating an accommodation IA data entry.
 */
export type UpdateAccommodationIaData = UpdateData<CreateAccommodationIaData>;

/**
 * Filter options for listing IA data entries.
 */
export interface SelectAccommodationIaDataFilter extends BaseSelectFilter {
    /** ID of the accommodation */
    accommodationId: string;
    /** Optional fuzzy search on title or content */
    query?: string;
    /** Include soft-deleted if true */
    includeDeleted?: boolean;
}

/**
 * AccommodationIaDataModel provides CRUD operations for the accommodation_ia_data table.
 */
export const AccommodationIaDataModel = {
    /**
     * Create a new IA data entry.
     *
     * @param data - Fields required to create the IA data
     * @returns The created IA data record
     */
    async createIaData(data: CreateAccommodationIaData): Promise<AccommodationIaDataRecord> {
        try {
            dbLogger.info(data, 'creating accommodation IA data');
            const db = getDb();
            const rows = castReturning<AccommodationIaDataRecord>(
                await db.insert(accommodationIaData).values(data).returning()
            );
            const iaData = assertExists(rows[0], 'createIaData: no IA data returned');
            dbLogger.query({
                table: 'accommodation_ia_data',
                action: 'insert',
                params: data,
                result: iaData
            });
            return iaData;
        } catch (error) {
            dbLogger.error(error, 'createIaData failed');
            throw error;
        }
    },

    /**
     * Fetch a single IA data entry by ID.
     *
     * @param id - UUID of the IA data entry
     * @returns The IA data record or undefined if not found
     */
    async getIaDataById(id: string): Promise<AccommodationIaDataRecord | undefined> {
        try {
            dbLogger.info({ id }, 'fetching IA data by id');
            const db = getDb();
            const [iaData] = (await db
                .select()
                .from(accommodationIaData)
                .where(eq(accommodationIaData.id, id))
                .limit(1)) as AccommodationIaDataRecord[];
            dbLogger.query({
                table: 'accommodation_ia_data',
                action: 'select',
                params: { id },
                result: iaData
            });
            return iaData;
        } catch (error) {
            dbLogger.error(error, 'getIaDataById failed');
            throw error;
        }
    },

    /**
     * List IA data entries for a given accommodation.
     *
     * @param filter - Filtering and pagination options
     * @returns Array of IA data records
     */
    async listIaData(
        filter: SelectAccommodationIaDataFilter
    ): Promise<AccommodationIaDataRecord[]> {
        try {
            dbLogger.info(filter, 'listing IA data entries');
            const db = getDb();
            let query = rawSelect(
                db
                    .select()
                    .from(accommodationIaData)
                    .where(eq(accommodationIaData.accommodationId, filter.accommodationId))
            );

            if (filter.query) {
                const term = `%${filter.query}%`;
                query = query.where(
                    or(
                        ilike(accommodationIaData.title, term),
                        ilike(accommodationIaData.content, term)
                    )
                );
            }
            if (!filter.includeDeleted) {
                query = query.where(isNull(accommodationIaData.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(accommodationIaData.createdAt, 'desc')) as AccommodationIaDataRecord[];

            dbLogger.query({
                table: 'accommodation_ia_data',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listIaData failed');
            throw error;
        }
    },

    /**
     * Update fields on an existing IA data entry.
     *
     * @param id - UUID of the IA data entry to update
     * @param changes - Partial fields to update
     * @returns The updated IA data record
     */
    async updateIaData(
        id: string,
        changes: UpdateAccommodationIaData
    ): Promise<AccommodationIaDataRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            dbLogger.info({ id, changes: dataToUpdate }, 'updating IA data');
            const db = getDb();
            const rows = castReturning<AccommodationIaDataRecord>(
                await db
                    .update(accommodationIaData)
                    .set(dataToUpdate)
                    .where(eq(accommodationIaData.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateIaData: no IA data found for id ${id}`);
            dbLogger.query({
                table: 'accommodation_ia_data',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateIaData failed');
            throw error;
        }
    },

    /**
     * Soft-delete an IA data entry by setting the deletedAt timestamp.
     *
     * @param id - UUID of the IA data entry
     */
    async softDeleteIaData(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'soft deleting IA data');
            const db = getDb();
            await db
                .update(accommodationIaData)
                .set({ deletedAt: new Date() })
                .where(eq(accommodationIaData.id, id));
            dbLogger.query({
                table: 'accommodation_ia_data',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteIaData failed');
            throw error;
        }
    },

    /**
     * Restore a soft-deleted IA data entry by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the IA data entry
     */
    async restoreIaData(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'restoring IA data');
            const db = getDb();
            await db
                .update(accommodationIaData)
                .set({ deletedAt: null })
                .where(eq(accommodationIaData.id, id));
            dbLogger.query({
                table: 'accommodation_ia_data',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreIaData failed');
            throw error;
        }
    },

    /**
     * Permanently delete an IA data entry record from the database.
     *
     * @param id - UUID of the IA data entry
     */
    async hardDeleteIaData(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'hard deleting IA data');
            const db = getDb();
            await db.delete(accommodationIaData).where(eq(accommodationIaData.id, id));
            dbLogger.query({
                table: 'accommodation_ia_data',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteIaData failed');
            throw error;
        }
    }
};
