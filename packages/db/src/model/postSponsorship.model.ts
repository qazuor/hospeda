import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { eq, isNull } from 'drizzle-orm';
import type { BaseSelectFilter, UpdateData } from 'src/types/db-types';
import { db } from '../client';
import { postSponsorships } from '../schema/post_sponsorship.dbschema';
import { assertExists, castReturning, rawSelect, sanitizePartialUpdate } from '../utils/db-utils';

/**
 * Scoped logger for PostSponsorshipModel operations.
 */
const log = logger.createLogger('PostSponsorshipModel');

/**
 * Full post sponsorship record as returned by the database.
 */
export type PostSponsorshipRecord = InferSelectModel<typeof postSponsorships>;

/**
 * Data required to create a new post sponsorship.
 */
export type CreatePostSponsorshipData = InferInsertModel<typeof postSponsorships>;

/**
 * Fields allowed for updating a post sponsorship.
 */
export type UpdatePostSponsorshipData = UpdateData<CreatePostSponsorshipData>;

/**
 * Filter options for listing sponsorships.
 */
export interface SelectPostSponsorshipFilter extends BaseSelectFilter {
    /** ID of the post */
    postId: string;
    /** Include soft-deleted if true */
    includeDeleted?: boolean;
}

/**
 * PostSponsorshipModel provides CRUD operations for the post_sponsorship table.
 */
export const PostSponsorshipModel = {
    /**
     * Create a new sponsorship.
     *
     * @param data - Fields required to create the sponsorship
     * @returns The created sponsorship record
     */
    async createSponsorship(data: CreatePostSponsorshipData): Promise<PostSponsorshipRecord> {
        try {
            log.info('creating post sponsorship', 'createSponsorship', data);
            const rows = castReturning<PostSponsorshipRecord>(
                await db.insert(postSponsorships).values(data).returning()
            );
            const sponsorship = assertExists(rows[0], 'createSponsorship: no sponsorship returned');
            log.query('insert', 'post_sponsorship', data, sponsorship);
            return sponsorship;
        } catch (error) {
            log.error('createSponsorship failed', 'createSponsorship', error);
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
            log.info('fetching sponsorship by id', 'getSponsorshipById', { id });
            const [sponsorship] = (await db
                .select()
                .from(postSponsorships)
                .where(eq(postSponsorships.id, id))
                .limit(1)) as PostSponsorshipRecord[];
            log.query('select', 'post_sponsorship', { id }, sponsorship);
            return sponsorship;
        } catch (error) {
            log.error('getSponsorshipById failed', 'getSponsorshipById', error);
            throw error;
        }
    },

    /**
     * List sponsorships for a given post.
     *
     * @param filter - Filtering and pagination options
     * @returns Array of sponsorship records
     */
    async listSponsorships(filter: SelectPostSponsorshipFilter): Promise<PostSponsorshipRecord[]> {
        try {
            log.info('listing sponsorships', 'listSponsorships', filter);

            let query = rawSelect(
                db.select().from(postSponsorships).where(eq(postSponsorships.postId, filter.postId))
            );

            if (!filter.includeDeleted) {
                query = query.where(isNull(postSponsorships.deletedAt));
            }

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)
                .orderBy(postSponsorships.createdAt, 'desc')) as PostSponsorshipRecord[];

            log.query('select', 'post_sponsorship', filter, rows);
            return rows;
        } catch (error) {
            log.error('listSponsorships failed', 'listSponsorships', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing sponsorship.
     *
     * @param id - UUID of the sponsorship to update
     * @param changes - Partial fields to update
     * @returns The updated sponsorship record
     */
    async updateSponsorship(
        id: string,
        changes: UpdatePostSponsorshipData
    ): Promise<PostSponsorshipRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating sponsorship', 'updateSponsorship', {
                id,
                changes: dataToUpdate
            });
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
            log.query('update', 'post_sponsorship', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateSponsorship failed', 'updateSponsorship', error);
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
            log.info('soft deleting sponsorship', 'softDeleteSponsorship', { id });
            await db
                .update(postSponsorships)
                .set({ deletedAt: new Date() })
                .where(eq(postSponsorships.id, id));
            log.query('update', 'post_sponsorship', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteSponsorship failed', 'softDeleteSponsorship', error);
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
            log.info('restoring sponsorship', 'restoreSponsorship', { id });
            await db
                .update(postSponsorships)
                .set({ deletedAt: null })
                .where(eq(postSponsorships.id, id));
            log.query('update', 'post_sponsorship', { id }, { restored: true });
        } catch (error) {
            log.error('restoreSponsorship failed', 'restoreSponsorship', error);
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
            log.info('hard deleting sponsorship', 'hardDeleteSponsorship', { id });
            await db.delete(postSponsorships).where(eq(postSponsorships.id, id));
            log.query('delete', 'post_sponsorship', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteSponsorship failed', 'hardDeleteSponsorship', error);
            throw error;
        }
    }
};
