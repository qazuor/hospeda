import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, isNull } from 'drizzle-orm';
import type { BaseSelectFilter, UpdateData } from 'src/types/db.types';
import { db } from '../client';
import { accommodationReviews } from '../schema/accommodation_review.dbschema';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

/**
 * Scoped logger for AccommodationReviewModel operations.
 */
const log = logger.createLogger('AccommodationReviewModel');

/**
 * Full accommodation review record as returned by the database.
 */
export type AccommodationReviewRecord = InferSelectModel<typeof accommodationReviews>;

/**
 * Data required to create a new accommodation review.
 */
export type CreateAccommodationReviewData = InferInsertModel<typeof accommodationReviews>;

/**
 * Fields allowed for updating an accommodation review.
 */
export type UpdateAccommodationReviewData = UpdateData<CreateAccommodationReviewData>;

/**
 * Filter options for listing reviews.
 */
export interface SelectAccommodationReviewFilter extends BaseSelectFilter {
    /** ID of the accommodation */
    accommodationId: string;
    /** Include soft-deleted if true */
    includeDeleted?: boolean;
}

/**
 * AccommodationReviewModel provides CRUD operations for the accommodation_review table.
 */
export const AccommodationReviewModel = {
    /**
     * Create a new review.
     *
     * @param data - Fields required to create the review
     * @returns The created review record
     */
    async createReview(data: CreateAccommodationReviewData): Promise<AccommodationReviewRecord> {
        try {
            log.info('creating accommodation review', 'createReview', data);
            const rows = castReturning<AccommodationReviewRecord>(
                await db.insert(accommodationReviews).values(data).returning()
            );
            const review = assertExists(rows[0], 'createReview: no review returned');
            log.query('insert', 'accommodation_review', data, review);
            return review;
        } catch (error) {
            log.error('createReview failed', 'createReview', error);
            throw error;
        }
    },

    /**
     * Fetch a single review by ID.
     *
     * @param id - UUID of the review
     * @returns The review record or undefined if not found
     */
    async getReviewById(id: string): Promise<AccommodationReviewRecord | undefined> {
        try {
            log.info('fetching review by id', 'getReviewById', { id });
            const [review] = (await db
                .select()
                .from(accommodationReviews)
                .where(eq(accommodationReviews.id, id))
                .limit(1)) as AccommodationReviewRecord[];
            log.query('select', 'accommodation_review', { id }, review);
            return review;
        } catch (error) {
            log.error('getReviewById failed', 'getReviewById', error);
            throw error;
        }
    },

    /**
     * List reviews for a given accommodation.
     *
     * @param filter - Filtering and pagination options
     * @returns Array of review records
     */
    async listReviews(
        filter: SelectAccommodationReviewFilter
    ): Promise<AccommodationReviewRecord[]> {
        try {
            log.info('listing reviews', 'listReviews', filter);

            let query = rawSelect(
                db
                    .select()
                    .from(accommodationReviews)
                    .where(eq(accommodationReviews.accommodationId, filter.accommodationId))
            );

            if (!filter.includeDeleted) {
                query = query.where(isNull(accommodationReviews.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(accommodationReviews.createdAt, 'desc')) as AccommodationReviewRecord[];

            log.query('select', 'accommodation_review', filter, rows);
            return rows;
        } catch (error) {
            log.error('listReviews failed', 'listReviews', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing review.
     *
     * @param id - UUID of the review to update
     * @param changes - Partial fields to update
     * @returns The updated review record
     */
    async updateReview(
        id: string,
        changes: UpdateAccommodationReviewData
    ): Promise<AccommodationReviewRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating review', 'updateReview', { id, changes: dataToUpdate });
            const rows = castReturning<AccommodationReviewRecord>(
                await db
                    .update(accommodationReviews)
                    .set(dataToUpdate)
                    .where(eq(accommodationReviews.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateReview: no review found for id ${id}`);
            log.query('update', 'accommodation_review', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateReview failed', 'updateReview', error);
            throw error;
        }
    },

    /**
     * Soft-delete a review by setting the deletedAt timestamp.
     *
     * @param id - UUID of the review
     */
    async softDeleteReview(id: string): Promise<void> {
        try {
            log.info('soft deleting review', 'softDeleteReview', { id });
            await db
                .update(accommodationReviews)
                .set({ deletedAt: new Date() })
                .where(eq(accommodationReviews.id, id));
            log.query('update', 'accommodation_review', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteReview failed', 'softDeleteReview', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted review by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the review
     */
    async restoreReview(id: string): Promise<void> {
        try {
            log.info('restoring review', 'restoreReview', { id });
            await db
                .update(accommodationReviews)
                .set({ deletedAt: null })
                .where(eq(accommodationReviews.id, id));
            log.query('update', 'accommodation_review', { id }, { restored: true });
        } catch (error) {
            log.error('restoreReview failed', 'restoreReview', error);
            throw error;
        }
    },

    /**
     * Permanently delete a review record from the database.
     *
     * @param id - UUID of the review
     */
    async hardDeleteReview(id: string): Promise<void> {
        try {
            log.info('hard deleting review', 'hardDeleteReview', { id });
            await db.delete(accommodationReviews).where(eq(accommodationReviews.id, id));
            log.query('delete', 'accommodation_review', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteReview failed', 'hardDeleteReview', error);
            throw error;
        }
    }
};
