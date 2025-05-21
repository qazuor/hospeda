import { dbLogger } from '@repo/db/utils/logger.js';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '../client.js';
import { postSponsorships } from '../schema/post_sponsorship.dbschema.js';
import type {
    InsertPostSponsorship,
    SelectPostSponsorshipFilter,
    UpdatePostSponsorshipData
} from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Full post sponsorship record as returned by the database.
 */
export type PostSponsorshipRecord = InferSelectModel<typeof postSponsorships>;

/**
 * PostSponsorshipModel provides CRUD operations for the post_sponsorship table.
 */
export const PostSponsorshipModel = {
    /**
     * Create a new sponsorship.
     *
     * @param data - Fields required to create the sponsorship (InsertPostSponsorship type from db-types)
     * @returns The created sponsorship record
     */
    async createSponsorship(data: InsertPostSponsorship): Promise<PostSponsorshipRecord> {
        try {
            dbLogger.info(data, 'creating post sponsorship');
            const db = getDb();
            const rows = castReturning<PostSponsorshipRecord>(
                await db.insert(postSponsorships).values(data).returning()
            );
            const sponsorship = assertExists(rows[0], 'createSponsorship: no sponsorship returned');
            dbLogger.query({
                table: 'post_sponsorship',
                action: 'insert',
                params: data,
                result: sponsorship
            });
            return sponsorship;
        } catch (error) {
            dbLogger.error(error, 'createSponsorship failed');
            throw error;
        }
    },

    /**
     * Fetch a single sponsorship by ID.
     *
     * @param id - UUID of the sponsorship
     * @returns The sponsorship record or undefined if not found
     */
    async getSponsorshipById(id: string): Promise<PostSponsorshipRecord | undefined> {
        try {
            dbLogger.info({ id }, 'fetching sponsorship by id');
            const db = getDb();
            const [sponsorship] = await db
                .select()
                .from(postSponsorships)
                .where(eq(postSponsorships.id, id))
                .limit(1);
            dbLogger.query({
                table: 'post_sponsorship',
                action: 'select',
                params: { id },
                result: sponsorship
            });
            return sponsorship ? (sponsorship as PostSponsorshipRecord) : undefined;
        } catch (error) {
            dbLogger.error(error, 'getSponsorshipById failed');
            throw error;
        }
    },

    /**
     * List sponsorships with optional filters and pagination.
     *
     * @param filter - Filtering and pagination options (SelectPostSponsorshipFilter type from db-types)
     * @returns Array of sponsorship records
     */
    async listSponsorships(filter: SelectPostSponsorshipFilter): Promise<PostSponsorshipRecord[]> {
        try {
            dbLogger.info(filter, 'listing sponsorships');
            const db = getDb();
            let query = db.select().from(postSponsorships).$dynamic();

            if (filter.postId) {
                query = query.where(eq(postSponsorships.postId, filter.postId));
            }

            if (filter.sponsorId) {
                query = query.where(eq(postSponsorships.sponsorId, filter.sponsorId));
            }

            if (typeof filter.isHighlighted === 'boolean') {
                query = query.where(eq(postSponsorships.isHighlighted, filter.isHighlighted));
            }

            if (filter.state) {
                // Using inherited 'state' filter
                query = query.where(eq(postSponsorships.state, filter.state));
            }

            if (filter.createdById) {
                // Added createdById filter
                query = query.where(eq(postSponsorships.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                // Added updatedById filter
                query = query.where(eq(postSponsorships.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                // Added deletedById filter
                query = query.where(eq(postSponsorships.deletedById, filter.deletedById));
            }

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                // Assuming search applies to message or description
                query = query.where(
                    or(
                        ilike(postSponsorships.message, term),
                        ilike(postSponsorships.description, term)
                    )
                );
            }

            if (!filter.includeDeleted) {
                // This table might not have deletedAt
                query = query.where(isNull(postSponsorships.deletedAt)); // Assuming deletedAt exists based on BaseSelectFilter
            }

            // Use the getOrderByColumn utility
            const orderByColumn = getOrderByColumn(
                postSponsorships,
                filter.orderBy,
                postSponsorships.createdAt
            );
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as PostSponsorshipRecord[];

            dbLogger.query({
                table: 'post_sponsorship',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listSponsorships failed');
            throw error;
        }
    },

    /**
     * Update fields on an existing sponsorship.
     *
     * @param id - UUID of the sponsorship to update
     * @param changes - Partial fields to update (UpdatePostSponsorshipData type from db-types)
     * @returns The updated sponsorship record
     */
    async updateSponsorship(
        id: string,
        changes: UpdatePostSponsorshipData
    ): Promise<PostSponsorshipRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            dbLogger.info({ id, changes: dataToUpdate }, 'updating sponsorship');
            const db = getDb();
            const rows = castReturning<PostSponsorshipRecord>(
                await db
                    .update(postSponsorships)
                    .set(dataToUpdate)
                    .where(eq(postSponsorships.id, id))
                    .returning()
            );
            const updated = assertExists(
                rows[0],
                `updateSponsorship: no sponsorship found for id ${id}`
            );
            dbLogger.query({
                table: 'post_sponsorship',
                action: 'update',
                params: { id, changes: dataToUpdate },
                result: updated
            });
            return updated;
        } catch (error) {
            dbLogger.error(error, 'updateSponsorship failed');
            throw error;
        }
    },

    /**
     * Soft-delete a sponsorship by setting the deletedAt timestamp.
     *
     * @param id - UUID of the sponsorship
     */
    async softDeleteSponsorship(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'soft deleting sponsorship');
            const db = getDb();
            await db
                .update(postSponsorships)
                .set({ deletedAt: new Date() })
                .where(eq(postSponsorships.id, id));
            dbLogger.query({
                table: 'post_sponsorship',
                action: 'update',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'softDeleteSponsorship failed');
            throw error;
        }
    },

    /**
     * Restore a soft-deleted sponsorship by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the sponsorship
     */
    async restoreSponsorship(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'restoring sponsorship');
            const db = getDb();
            await db
                .update(postSponsorships)
                .set({ deletedAt: null })
                .where(eq(postSponsorships.id, id));
            dbLogger.query({
                table: 'post_sponsorship',
                action: 'update',
                params: { id },
                result: { restored: true }
            });
        } catch (error) {
            dbLogger.error(error, 'restoreSponsorship failed');
            throw error;
        }
    },

    /**
     * Permanently delete a sponsorship record from the database.
     *
     * @param id - UUID of the sponsorship
     */
    async hardDeleteSponsorship(id: string): Promise<void> {
        try {
            dbLogger.info({ id }, 'hard deleting sponsorship');
            const db = getDb();
            await db.delete(postSponsorships).where(eq(postSponsorships.id, id));
            dbLogger.query({
                table: 'post_sponsorship',
                action: 'delete',
                params: { id },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'hardDeleteSponsorship failed');
            throw error;
        }
    }
};
