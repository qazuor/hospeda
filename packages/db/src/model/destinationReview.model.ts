import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, isNull } from 'drizzle-orm';
import { getDb } from '../client.js';
import { destinationReviews } from '../schema/destination_review.dbschema.js';
import type { BaseSelectFilter, UpdateData } from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    rawSelect,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

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
            dbLogger.info(data, 'creating destination review');
            const db = getDb();
            const rows = castReturning<DestinationReviewRecord>(
                await db.insert(destinationReviews).values(data).returning()
            );
            const review = assertExists(rows[0], 'createReview: no review returned');
            dbLogger.query({
                table: 'destination_review',
                action: 'insert',
                params: data,
                result: review
            });
            return review;
        } catch (error) {
            dbLogger.error(error, 'createReview failed');
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
            dbLogger.info({ id }, 'fetching review by id');
            const db = getDb();
            const [review] = (await db
                .select()
                .from(destinationReviews)
                .where(eq(destinationReviews.id, id))
                .limit(1)) as DestinationReviewRecord[];
            dbLogger.query({
                table: 'destination_review',
                action: 'select',
                params: { id },
                result: review
            });
            return review;
        } catch (error) {
            dbLogger.error(error, 'getReviewById failed');
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
            dbLogger.info(filter, 'listing reviews');
            const db = getDb();
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

            dbLogger.query({
                table: 'destination_review',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listReviews failed');
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
            dbLogger.info({ id, changes: dataToUpdate }, 'updating review');
            const db = getDb();
            const rows = castReturning<DestinationReviewRecord>(
                await db
                    .update(destinationReviews)
                    .set(dataToUpdate)
                    .where(eq(destinationReviews.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateReview: no review found for id ${id}`);
            dbLogger.query({
                table: 'destination_review',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateReview failed');
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
            dbLogger.info({ id }, 'soft deleting review');
            const db = getDb();
            await db
                .update(destinationReviews)
                .set({ deletedAt: new Date() })
                .where(eq(destinationReviews.id, id));
            dbLogger.query({
                table: 'destination_review',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteReview failed');
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
            dbLogger.info({ id }, 'restoring review');
            const db = getDb();
            await db
                .update(destinationReviews)
                .set({ deletedAt: null })
                .where(eq(destinationReviews.id, id));
            dbLogger.query({
                table: 'destination_review',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreReview failed');
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
            dbLogger.info({ id }, 'hard deleting review');
            const db = getDb();
            await db.delete(destinationReviews).where(eq(destinationReviews.id, id));
            dbLogger.query({
                table: 'destination_review',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteReview failed');
            throw error;
        }
    }
};
