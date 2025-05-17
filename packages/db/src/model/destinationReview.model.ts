import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, isNull } from 'drizzle-orm';
import { db } from '../client.js';
import { destinationReviews } from '../schema/destination_review.dbschema.js';
import type { BaseSelectFilter, UpdateData } from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    rawSelect,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Scoped logger for DestinationReviewModel operations.
 */
const log = logger.createLogger('DestinationReviewModel');

/**
 * Full destination review record as returned by the database.
 */
export type DestinationReviewRecord = InferSelectModel<typeof destinationReviews>;

/**
 * Data required to create a new destination review.
 */
export type CreateDestinationReviewData = InferInsertModel<typeof destinationReviews>;

/**
 * Fields allowed for updating a destination review.
 */
export type UpdateDestinationReviewData = UpdateData<CreateDestinationReviewData>;

/**
 * Filter options for listing reviews.
 */
export interface SelectDestinationReviewFilter extends BaseSelectFilter {
    /** ID of the destination */
    destinationId: string;
    /** Include soft-deleted if true */
    includeDeleted?: boolean;
}

/**
 * DestinationReviewModel provides CRUD operations for the destination_review table.
 */
export const DestinationReviewModel = {
    /**
     * Create a new review.
     *
     * @param data - Fields required to create the review
     * @returns The created review record
     */
    async createReview(data: CreateDestinationReviewData): Promise<DestinationReviewRecord> {
        try {
            log.info('creating destination review', 'createReview', data);
            const rows = castReturning<DestinationReviewRecord>(
                await db.insert(destinationReviews).values(data).returning()
            );
            const review = assertExists(rows[0], 'createReview: no review returned');
            log.query('insert', 'destination_review', data, review);
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
    async getReviewById(id: string): Promise<DestinationReviewRecord | undefined> {
        try {
            log.info('fetching review by id', 'getReviewById', { id });
            const [review] = (await db
                .select()
                .from(destinationReviews)
                .where(eq(destinationReviews.id, id))
                .limit(1)) as DestinationReviewRecord[];
            log.query('select', 'destination_review', { id }, review);
            return review;
        } catch (error) {
            log.error('getReviewById failed', 'getReviewById', error);
            throw error;
        }
    },

    /**
     * List reviews for a given destination.
     *
     * @param filter - Filtering and pagination options
     * @returns Array of review records
     */
    async listReviews(filter: SelectDestinationReviewFilter): Promise<DestinationReviewRecord[]> {
        try {
            log.info('listing reviews', 'listReviews', filter);

            let query = rawSelect(
                db
                    .select()
                    .from(destinationReviews)
                    .where(eq(destinationReviews.destinationId, filter.destinationId))
            );

            if (!filter.includeDeleted) {
                query = query.where(isNull(destinationReviews.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(destinationReviews.createdAt, 'desc')) as DestinationReviewRecord[];

            log.query('select', 'destination_review', filter, rows);
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
        changes: UpdateDestinationReviewData
    ): Promise<DestinationReviewRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating review', 'updateReview', { id, changes: dataToUpdate });
            const rows = castReturning<DestinationReviewRecord>(
                await db
                    .update(destinationReviews)
                    .set(dataToUpdate)
                    .where(eq(destinationReviews.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateReview: no review found for id ${id}`);
            log.query('update', 'destination_review', { id, changes: dataToUpdate }, updated);
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
                .update(destinationReviews)
                .set({ deletedAt: new Date() })
                .where(eq(destinationReviews.id, id));
            log.query('update', 'destination_review', { id }, { deleted: true });
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
                .update(destinationReviews)
                .set({ deletedAt: null })
                .where(eq(destinationReviews.id, id));
            log.query('update', 'destination_review', { id }, { restored: true });
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
            await db.delete(destinationReviews).where(eq(destinationReviews.id, id));
            log.query('delete', 'destination_review', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteReview failed', 'hardDeleteReview', error);
            throw error;
        }
    }
};
