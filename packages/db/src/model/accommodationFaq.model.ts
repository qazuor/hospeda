import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '../client.js';
import { accommodationFaqs } from '../schema/accommodation_faq.dbschema.js';
import type { BaseSelectFilter, UpdateData } from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    rawSelect,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Full accommodation FAQ record as returned by the database.
 */
export type AccommodationFaqRecord = InferSelectModel<typeof accommodationFaqs>;

/**
 * Data required to create a new accommodation FAQ.
 */
export type CreateAccommodationFaqData = InferInsertModel<typeof accommodationFaqs>;

/**
 * Fields allowed for updating an accommodation FAQ.
 */
export type UpdateAccommodationFaqData = UpdateData<CreateAccommodationFaqData>;

/**
 * Filter options for listing FAQs.
 */
export interface SelectAccommodationFaqFilter extends BaseSelectFilter {
    /** ID of the accommodation */
    accommodationId: string;
    /** Optional fuzzy search on question or answer */
    query?: string;
    /** Include soft-deleted if true */
    includeDeleted?: boolean;
}

/**
 * AccommodationFaqModel provides CRUD operations for the accommodation_faq table.
 */
export const AccommodationFaqModel = {
    /**
     * Create a new FAQ entry.
     *
     * @param data - Fields required to create the FAQ
     * @returns The created FAQ record
     */
    async createFaq(data: CreateAccommodationFaqData): Promise<AccommodationFaqRecord> {
        try {
            dbLogger.info(data, 'creating accommodation FAQ');
            const db = getDb();
            const rows = castReturning<AccommodationFaqRecord>(
                await db.insert(accommodationFaqs).values(data).returning()
            );
            const faq = assertExists(rows[0], 'createFaq: no FAQ returned');
            dbLogger.query({
                table: 'accommodation_faq',
                action: 'insert',
                params: data,
                result: faq
            });
            return faq;
        } catch (error) {
            dbLogger.error(error, 'createFaq failed');
            throw error;
        }
    },

    /**
     * Fetch a single FAQ by ID.
     *
     * @param id - UUID of the FAQ
     * @returns The FAQ record or undefined if not found
     */
    async getFaqById(id: string): Promise<AccommodationFaqRecord | undefined> {
        try {
            dbLogger.info({ id }, 'fetching FAQ by id');
            const db = getDb();
            const [faq] = (await db
                .select()
                .from(accommodationFaqs)
                .where(eq(accommodationFaqs.id, id))
                .limit(1)) as AccommodationFaqRecord[];
            dbLogger.query({
                table: 'accommodation_faq',
                action: 'select',
                params: { id },
                result: faq
            });
            return faq;
        } catch (error) {
            dbLogger.error(error, 'getFaqById failed');
            throw error;
        }
    },

    /**
     * List FAQs for a given accommodation.
     *
     * @param filter - Filtering and pagination options
     * @returns Array of FAQ records
     */
    async listFaqs(filter: SelectAccommodationFaqFilter): Promise<AccommodationFaqRecord[]> {
        try {
            dbLogger.info(filter, 'listing FAQs');
            const db = getDb();
            let query = rawSelect(
                db
                    .select()
                    .from(accommodationFaqs)
                    .where(eq(accommodationFaqs.accommodationId, filter.accommodationId))
            );

            if (filter.query) {
                const term = `%${filter.query}%`;
                query = query.where(
                    or(
                        ilike(accommodationFaqs.question, term),
                        ilike(accommodationFaqs.answer, term)
                    )
                );
            }
            if (!filter.includeDeleted) {
                query = query.where(isNull(accommodationFaqs.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(accommodationFaqs.createdAt, 'desc')) as AccommodationFaqRecord[];

            dbLogger.query({
                table: 'accommodation_faq',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listFaqs failed');
            throw error;
        }
    },

    /**
     * Update fields on an existing FAQ.
     *
     * @param id - UUID of the FAQ to update
     * @param changes - Partial fields to update
     * @returns The updated FAQ record
     */
    async updateFaq(
        id: string,
        changes: UpdateAccommodationFaqData
    ): Promise<AccommodationFaqRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            dbLogger.info({ id, changes: dataToUpdate }, 'updating FAQ');
            const db = getDb();
            const rows = castReturning<AccommodationFaqRecord>(
                await db
                    .update(accommodationFaqs)
                    .set(dataToUpdate)
                    .where(eq(accommodationFaqs.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateFaq: no FAQ found for id ${id}`);
            dbLogger.query({
                table: 'accommodation_faq',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateFaq failed');
            throw error;
        }
    },

    /**
     * Soft-delete a FAQ by setting the deletedAt timestamp.
     *
     * @param id - UUID of the FAQ
     */
    async softDeleteFaq(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'soft deleting FAQ');
            const db = getDb();
            await db
                .update(accommodationFaqs)
                .set({ deletedAt: new Date() })
                .where(eq(accommodationFaqs.id, id));
            dbLogger.query({
                table: 'accommodation_faq',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteFaq failed');
            throw error;
        }
    },

    /**
     * Restore a soft-deleted FAQ by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the FAQ
     */
    async restoreFaq(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'restoring FAQ');
            const db = getDb();
            await db
                .update(accommodationFaqs)
                .set({ deletedAt: null })
                .where(eq(accommodationFaqs.id, id));
            dbLogger.query({
                table: 'accommodation_faq',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreFaq failed');
            throw error;
        }
    },

    /**
     * Permanently delete a FAQ record from the database.
     *
     * @param id - UUID of the FAQ
     */
    async hardDeleteFaq(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'hard deleting FAQ');
            const db = getDb();
            await db.delete(accommodationFaqs).where(eq(accommodationFaqs.id, id));
            dbLogger.query({
                table: 'accommodation_faq',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteFaq failed');
            throw error;
        }
    }
};
