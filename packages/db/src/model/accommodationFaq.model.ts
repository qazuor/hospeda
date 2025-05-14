import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, ilike, isNull, or } from 'drizzle-orm';
import type { BaseSelectFilter, UpdateData } from 'src/types/db-types';
import { db } from '../client';
import { accommodationFaqs } from '../schema/accommodation_faq.dbschema';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

/**
 * Scoped logger for AccommodationFaqModel operations.
 */
const log = logger.createLogger('AccommodationFaqModel');

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
            log.info('creating accommodation FAQ', 'createFaq', data);
            const rows = castReturning<AccommodationFaqRecord>(
                await db.insert(accommodationFaqs).values(data).returning()
            );
            const faq = assertExists(rows[0], 'createFaq: no FAQ returned');
            log.query('insert', 'accommodation_faq', data, faq);
            return faq;
        } catch (error) {
            log.error('createFaq failed', 'createFaq', error);
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
            log.info('fetching FAQ by id', 'getFaqById', { id });
            const [faq] = (await db
                .select()
                .from(accommodationFaqs)
                .where(eq(accommodationFaqs.id, id))
                .limit(1)) as AccommodationFaqRecord[];
            log.query('select', 'accommodation_faq', { id }, faq);
            return faq;
        } catch (error) {
            log.error('getFaqById failed', 'getFaqById', error);
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
            log.info('listing FAQs', 'listFaqs', filter);

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

            log.query('select', 'accommodation_faq', filter, rows);
            return rows;
        } catch (error) {
            log.error('listFaqs failed', 'listFaqs', error);
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
            log.info('updating FAQ', 'updateFaq', { id, changes: dataToUpdate });
            const rows = castReturning<AccommodationFaqRecord>(
                await db
                    .update(accommodationFaqs)
                    .set(dataToUpdate)
                    .where(eq(accommodationFaqs.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateFaq: no FAQ found for id ${id}`);
            log.query('update', 'accommodation_faq', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateFaq failed', 'updateFaq', error);
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
            log.info('soft deleting FAQ', 'softDeleteFaq', { id });
            await db
                .update(accommodationFaqs)
                .set({ deletedAt: new Date() })
                .where(eq(accommodationFaqs.id, id));
            log.query('update', 'accommodation_faq', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteFaq failed', 'softDeleteFaq', error);
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
            log.info('restoring FAQ', 'restoreFaq', { id });
            await db
                .update(accommodationFaqs)
                .set({ deletedAt: null })
                .where(eq(accommodationFaqs.id, id));
            log.query('update', 'accommodation_faq', { id }, { restored: true });
        } catch (error) {
            log.error('restoreFaq failed', 'restoreFaq', error);
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
            log.info('hard deleting FAQ', 'hardDeleteFaq', { id });
            await db.delete(accommodationFaqs).where(eq(accommodationFaqs.id, id));
            log.query('delete', 'accommodation_faq', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteFaq failed', 'hardDeleteFaq', error);
            throw error;
        }
    }
};
