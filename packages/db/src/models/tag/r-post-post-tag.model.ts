/**
 * RPostPostTagModel — r_post_post_tag join table model (SPEC-086 T-016).
 *
 * Provides type-safe query methods for the `r_post_post_tag` join table.
 * PostTag assignments are editorial (no per-user attribution) — any editor/admin
 * can set the canonical PostTags for a post.
 *
 * References:
 * - SPEC-086 D-001 (no per-user attribution on PostTag assignments)
 * - SPEC-086 D-018 (final schema shape: simple PK (postId, postTagId))
 * - AC-F03 (multiple PostTags per post)
 */
import type { PostTag } from '@repo/schemas';
import { and, eq } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { withTransaction } from '../../client.ts';
import { postTags } from '../../schemas/tag/post_tag.dbschema.ts';
import { rPostPostTag } from '../../schemas/tag/r_post_post_tag.dbschema.ts';
import type {
    InsertRPostPostTag,
    SelectRPostPostTag
} from '../../schemas/tag/r_post_post_tag.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Repository for the `r_post_post_tag` join table.
 *
 * Provides atomic tag-set replacement and lookup helpers for
 * the PostTag-to-post many-to-many relationship.
 */
export class RPostPostTagModel extends BaseModelImpl<SelectRPostPostTag> {
    protected table = rPostPostTag;
    public entityName = 'rPostPostTag';

    protected getTableName(): string {
        return 'rPostPostTag';
    }

    /**
     * Atomically replaces all PostTag assignments for a post.
     *
     * Within a single transaction:
     *   1. Deletes all existing rows for the given postId.
     *   2. Inserts new rows for each postTagId in the provided list.
     *
     * This operation is idempotent: applying the same set twice produces
     * the same final state (AC-F03).
     *
     * @param postId - UUID of the post whose tags are being replaced
     * @param postTagIds - Array of PostTag UUIDs to assign. Pass [] to clear all tags.
     * @param tx - Optional outer transaction client (will be reused if provided)
     * @returns The newly inserted rows
     */
    async setTagsForPost(
        postId: string,
        postTagIds: string[],
        tx?: DrizzleClient
    ): Promise<SelectRPostPostTag[]> {
        const logContext = { postId, postTagIds };

        try {
            const result = await withTransaction(async (innerTx) => {
                // Step 1: delete all existing assignments for this post
                await innerTx.delete(rPostPostTag).where(eq(rPostPostTag.postId, postId));

                // Step 2: insert new assignments (if any)
                if (postTagIds.length === 0) {
                    return [];
                }

                const rows: InsertRPostPostTag[] = postTagIds.map((postTagId) => ({
                    postId,
                    postTagId
                }));

                const inserted = await innerTx.insert(rPostPostTag).values(rows).returning();

                return inserted;
            }, tx);

            logQuery(this.entityName, 'setTagsForPost', logContext, result);
            return result as SelectRPostPostTag[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'setTagsForPost', logContext, err);
            throw new DbError(this.entityName, 'setTagsForPost', logContext, err.message);
        }
    }

    /**
     * Removes a single PostTag assignment from a post.
     *
     * Deletes exactly the row identified by (postId, postTagId).
     *
     * @param postId - UUID of the post
     * @param postTagId - UUID of the PostTag to remove
     * @param tx - Optional transaction client
     * @returns Number of rows deleted (0 or 1)
     */
    async removeTagFromPost(
        postId: string,
        postTagId: string,
        tx?: DrizzleClient
    ): Promise<number> {
        const db = this.getClient(tx);
        const logContext = { postId, postTagId };

        try {
            const result = await db
                .delete(rPostPostTag)
                .where(and(eq(rPostPostTag.postId, postId), eq(rPostPostTag.postTagId, postTagId)))
                .returning();

            logQuery(this.entityName, 'removeTagFromPost', logContext, { deleted: result.length });
            return result.length;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'removeTagFromPost', logContext, err);
            throw new DbError(this.entityName, 'removeTagFromPost', logContext, err.message);
        }
    }

    /**
     * Returns the full PostTag rows for all tags assigned to a post.
     *
     * Performs an inner join on `post_tags` to hydrate the full PostTag object.
     * Excludes soft-deleted PostTags (deletedAt IS NULL).
     *
     * @param postId - UUID of the post
     * @param tx - Optional transaction client
     * @returns Array of PostTag rows assigned to this post
     */
    async findByPostId(postId: string, tx?: DrizzleClient): Promise<PostTag[]> {
        const db = this.getClient(tx);
        const logContext = { postId };

        try {
            const result = await db
                .select({ postTag: postTags })
                .from(rPostPostTag)
                .innerJoin(postTags, eq(rPostPostTag.postTagId, postTags.id))
                .where(eq(rPostPostTag.postId, postId));

            const hydrated = result.map((row) => row.postTag);
            logQuery(this.entityName, 'findByPostId', logContext, hydrated);
            return hydrated as unknown as PostTag[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByPostId', logContext, err);
            throw new DbError(this.entityName, 'findByPostId', logContext, err.message);
        }
    }

    /**
     * Returns the IDs of all posts that have been assigned this PostTag.
     *
     * Used by the impact endpoint to count posts before deletion and for
     * building reverse lookups (e.g., public tag-filtered post listings).
     *
     * @param postTagId - UUID of the PostTag
     * @param tx - Optional transaction client
     * @returns Array of post UUIDs tagged with this PostTag
     */
    async findPostsByPostTagId(postTagId: string, tx?: DrizzleClient): Promise<string[]> {
        const db = this.getClient(tx);
        const logContext = { postTagId };

        try {
            const result = await db
                .select({ postId: rPostPostTag.postId })
                .from(rPostPostTag)
                .where(eq(rPostPostTag.postTagId, postTagId));

            const postIds = result.map((row) => row.postId);
            logQuery(this.entityName, 'findPostsByPostTagId', logContext, {
                count: postIds.length
            });
            return postIds;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findPostsByPostTagId', logContext, err);
            throw new DbError(this.entityName, 'findPostsByPostTagId', logContext, err.message);
        }
    }
}

/** Singleton instance of RPostPostTagModel for use across the application. */
export const rPostPostTagModel = new RPostPostTagModel();
