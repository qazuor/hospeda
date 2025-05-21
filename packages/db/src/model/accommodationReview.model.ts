import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, isNull } from 'drizzle-orm';
import { getDb } from '../client.js';
import { accommodationReviews } from '../schema/accommodation_review.dbschema.js';
import type { BaseSelectFilter, UpdateData } from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    rawSelect,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

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
            dbLogger.info(data, 'creating accommodation review');
            const db = getDb();
            const rows = castReturning<AccommodationReviewRecord>(
                await db.insert(accommodationReviews).values(data).returning()
            );
            const review = assertExists(rows[0], 'createReview: no review returned');
            dbLogger.query({
                table: 'accommodation_review',
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
    async getReviewById(id: string): Promise<AccommodationReviewRecord | undefined> {
        try {
            dbLogger.info({ id }, 'fetching review by id');
            const db = getDb();
            const [review] = (await db
                .select()
                .from(accommodationReviews)
                .where(eq(accommodationReviews.id, id))
                .limit(1)) as AccommodationReviewRecord[];
            dbLogger.query({
                table: 'accommodation_review',
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
     * List reviews for a given accommodation.
     *
     * @param filter - Filtering and pagination options
     * @returns Array of review records
     */
    async listReviews(
        filter: SelectAccommodationReviewFilter
    ): Promise<AccommodationReviewRecord[]> {
        try {
            dbLogger.info(filter, 'listing reviews');
            const db = getDb();
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

            dbLogger.query({
                table: 'accommodation_review',
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
        changes: UpdateAccommodationReviewData
    ): Promise<AccommodationReviewRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            dbLogger.info({ id, changes: dataToUpdate }, 'updating review');
            const db = getDb();
            const rows = castReturning<AccommodationReviewRecord>(
                await db
                    .update(accommodationReviews)
                    .set(dataToUpdate)
                    .where(eq(accommodationReviews.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateReview: no review found for id ${id}`);
            dbLogger.query({
                table: 'accommodation_review',
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
                .update(accommodationReviews)
                .set({ deletedAt: new Date() })
                .where(eq(accommodationReviews.id, id));
            dbLogger.query({
                table: 'accommodation_review',
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
                .update(accommodationReviews)
                .set({ deletedAt: null })
                .where(eq(accommodationReviews.id, id));
            dbLogger.query({
                table: 'accommodation_review',
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
            await db.delete(accommodationReviews).where(eq(accommodationReviews.id, id));
            dbLogger.query({
                table: 'accommodation_review',
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
