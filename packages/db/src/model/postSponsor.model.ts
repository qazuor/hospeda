import { logger } from '@repo/logger';
import type { InferSelectModel } from 'drizzle-orm';
import { asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../client.js';
import { postSponsors } from '../schema/post_sponsor.dbschema.js';
import type {
    InsertPostSponsor,
    SelectPostSponsorFilter,
    UpdatePostSponsorData
} from '../types/db-types.js';
import {
    assertExists,
    castReturning,
    getOrderByColumn,
    prepareLikeQuery,
    sanitizePartialUpdate
} from '../utils/db-utils.js';

/**
 * Scoped logger for PostSponsorModel operations.
 */
const log = logger.createLogger('PostSponsorModel');

/**
 * Full post sponsor record as returned by the database.
 */
export type PostSponsorRecord = InferSelectModel<typeof postSponsors>;

/**
 * PostSponsorModel provides CRUD operations for the post_sponsor table.
 */
export const PostSponsorModel = {
    /**
     * Create a new sponsor.
     *
     * @param data - Fields required to create the sponsor (InsertPostSponsor type from db-types)
     * @returns The created sponsor record
     */
    async createSponsor(data: InsertPostSponsor): Promise<PostSponsorRecord> {
        try {
            log.info('creating post sponsor', 'createSponsor', data);
            const rows = castReturning<PostSponsorRecord>(
                await db.insert(postSponsors).values(data).returning()
            );
            const sponsor = assertExists(rows[0], 'createSponsor: no sponsor returned');
            log.query('insert', 'post_sponsor', data, sponsor);
            return sponsor;
        } catch (error) {
            log.error('createSponsor failed', 'createSponsor', error);
            throw error;
        }
    },

    /**
     * Fetch a single sponsor by ID.
     *
     * @param id - UUID of the sponsor
     * @returns The sponsor record or undefined if not found
     */
    async getSponsorById(id: string): Promise<PostSponsorRecord | undefined> {
        try {
            log.info('fetching sponsor by id', 'getSponsorById', { id });
            const [sponsor] = await db
                .select()
                .from(postSponsors)
                .where(eq(postSponsors.id, id))
                .limit(1);
            log.query('select', 'post_sponsor', { id }, sponsor);
            return sponsor ? (sponsor as PostSponsorRecord) : undefined;
        } catch (error) {
            log.error('getSponsorById failed', 'getSponsorById', error);
            throw error;
        }
    },

    /**
     * List sponsors with optional filters, pagination, and search.
     *
     * @param filter - Filtering and pagination options (SelectPostSponsorFilter type from db-types)
     * @returns Array of sponsor records
     */
    async listSponsors(filter: SelectPostSponsorFilter): Promise<PostSponsorRecord[]> {
        try {
            log.info('listing sponsors', 'listSponsors', filter);

            let query = db.select().from(postSponsors).$dynamic();

            if (filter.query) {
                const term = prepareLikeQuery(filter.query);
                query = query.where(
                    or(ilike(postSponsors.name, term), ilike(postSponsors.displayName, term)) // Changed description to displayName based on schema
                );
            }

            if (filter.type) {
                query = query.where(eq(postSponsors.type, filter.type));
            }

            if (filter.state) {
                // Using inherited 'state' filter
                query = query.where(eq(postSponsors.state, filter.state));
            }

            if (filter.createdById) {
                // Added createdById filter
                query = query.where(eq(postSponsors.createdById, filter.createdById));
            }
            if (filter.updatedById) {
                // Added updatedById filter
                query = query.where(eq(postSponsors.updatedById, filter.updatedById));
            }
            if (filter.deletedById) {
                // Added deletedById filter
                query = query.where(eq(postSponsors.deletedById, filter.deletedById));
            }

            if (!filter.includeDeleted) {
                query = query.where(isNull(postSponsors.deletedAt));
            }

            // Use the getOrderByColumn utility
            const orderByColumn = getOrderByColumn(
                postSponsors,
                filter.orderBy,
                postSponsors.createdAt
            );
            query = query.orderBy(
                filter.order === 'asc' ? asc(orderByColumn) : desc(orderByColumn)
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as PostSponsorRecord[];

            log.query('select', 'post_sponsor', filter, rows);
            return rows;
        } catch (error) {
            log.error('listSponsors failed', 'listSponsors', error);
            throw error;
        }
    },

    /**
     * Update fields on an existing sponsor.
     *
     * @param id - UUID of the sponsor to update
     * @param changes - Partial fields to update (UpdatePostSponsorData type from db-types)
     * @returns The updated sponsor record
     */
    async updateSponsor(id: string, changes: UpdatePostSponsorData): Promise<PostSponsorRecord> {
        try {
            const dataToUpdate = sanitizePartialUpdate(changes);
            log.info('updating sponsor', 'updateSponsor', {
                id,
                changes: dataToUpdate
            });
            const rows = castReturning<PostSponsorRecord>(
                await db
                    .update(postSponsors)
                    .set(dataToUpdate)
                    .where(eq(postSponsors.id, id))
                    .returning()
            );
            const updated = assertExists(rows[0], `updateSponsor: no sponsor found for id ${id}`);
            log.query('update', 'post_sponsor', { id, changes: dataToUpdate }, updated);
            return updated;
        } catch (error) {
            log.error('updateSponsor failed', 'updateSponsor', error);
            throw error;
        }
    },

    /**
     * Soft-delete a sponsor by setting the deletedAt timestamp.
     *
     * @param id - UUID of the sponsor
     */
    async softDeleteSponsor(id: string): Promise<void> {
        try {
            log.info('soft deleting sponsor', 'softDeleteSponsor', { id });
            await db
                .update(postSponsors)
                .set({ deletedAt: new Date() })
                .where(eq(postSponsors.id, id));
            log.query('update', 'post_sponsor', { id }, { deleted: true });
        } catch (error) {
            log.error('softDeleteSponsor failed', 'softDeleteSponsor', error);
            throw error;
        }
    },

    /**
     * Restore a soft-deleted sponsor by clearing the deletedAt timestamp.
     *
     * @param id - UUID of the sponsor
     */
    async restoreSponsor(id: string): Promise<void> {
        try {
            log.info('restoring sponsor', 'restoreSponsor', { id });
            await db.update(postSponsors).set({ deletedAt: null }).where(eq(postSponsors.id, id));
            log.query('update', 'post_sponsor', { id }, { restored: true });
        } catch (error) {
            log.error('restoreSponsor failed', 'restoreSponsor', error);
            throw error;
        }
    },

    /**
     * Permanently delete a sponsor record from the database.
     *
     * @param id - UUID of the sponsor
     */
    async hardDeleteSponsor(id: string): Promise<void> {
        try {
            log.info('hard deleting sponsor', 'hardDeleteSponsor', { id });
            await db.delete(postSponsors).where(eq(postSponsors.id, id));
            log.query('delete', 'post_sponsor', { id }, { deleted: true });
        } catch (error) {
            log.error('hardDeleteSponsor failed', 'hardDeleteSponsor', error);
            throw error;
        }
    }
};
