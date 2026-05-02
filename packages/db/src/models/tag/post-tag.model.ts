/**
 * PostTagModel — PostTag subsystem model (SPEC-086 T-016).
 *
 * Provides type-safe query methods for the `post_tags` table.
 * PostTags are a public, SEO-driven taxonomy for blog posts,
 * completely separate from the User-Tag subsystem.
 *
 * References:
 * - SPEC-086 D-001 (two separate subsystems)
 * - SPEC-086 D-013 (public endpoint: ACTIVE only, no pagination)
 * - SPEC-086 D-014 (safeIlike on name only)
 * - SPEC-086 D-018 (final schema shape)
 * - AC-F13 (public listing returns only ACTIVE PostTags)
 */
import type { PostTag } from '@repo/schemas';
import { type SQL, and, asc, count, eq, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { postTags } from '../../schemas/tag/post_tag.dbschema.ts';
import { rPostPostTag } from '../../schemas/tag/r_post_post_tag.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * A PostTag row augmented with the count of posts that use it.
 * Returned by findActiveWithCounts.
 */
export type PostTagWithCount = PostTag & { usageCount: number };

/**
 * Repository for the `post_tags` table.
 *
 * Extends BaseModelImpl for standard CRUD operations and adds
 * PostTag-specific query methods per SPEC-086.
 */
export class PostTagModel extends BaseModelImpl<PostTag> {
    protected table = postTags;
    public entityName = 'postTags';

    protected getTableName(): string {
        return 'postTags';
    }

    /**
     * Finds a PostTag by its UUID.
     *
     * Returns null for soft-deleted rows.
     *
     * @param id - UUID of the PostTag
     * @param tx - Optional transaction client
     * @returns The PostTag or null
     */
    async findById(id: string, tx?: DrizzleClient): Promise<PostTag | null> {
        const db = this.getClient(tx);
        const logContext = { id };

        try {
            const result = await db
                .select()
                .from(postTags)
                .where(and(eq(postTags.id, id), isNull(postTags.deletedAt)))
                .limit(1);

            logQuery(this.entityName, 'findById', logContext, result);
            // DRIZZLE-LIMITATION: select(*) returns InferSelect with branded enum columns; cast back to the canonical PostTag type used by services.
            return (result[0] as unknown as PostTag) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findById', logContext, err);
            throw new DbError(this.entityName, 'findById', logContext, err.message);
        }
    }

    /**
     * Finds a PostTag by its URL-safe slug.
     *
     * Used by the service layer to validate slug uniqueness before creating
     * or updating a PostTag, and by the public route to resolve slug → PostTag.
     *
     * @param slug - The URL-safe slug (e.g. "gastronomia")
     * @param tx - Optional transaction client
     * @returns The PostTag or null if not found / soft-deleted
     */
    async findBySlug(slug: string, tx?: DrizzleClient): Promise<PostTag | null> {
        const db = this.getClient(tx);
        const logContext = { slug };

        try {
            const result = await db
                .select()
                .from(postTags)
                .where(and(eq(postTags.slug, slug), isNull(postTags.deletedAt)))
                .limit(1);

            logQuery(this.entityName, 'findBySlug', logContext, result);
            // DRIZZLE-LIMITATION: select(*) returns InferSelect with branded enum columns; cast back to the canonical PostTag type used by services.
            return (result[0] as unknown as PostTag) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findBySlug', logContext, err);
            throw new DbError(this.entityName, 'findBySlug', logContext, err.message);
        }
    }

    /**
     * Finds PostTags with optional filters.
     *
     * Used by admin list views. Applies pagination via BaseModelImpl.findAll.
     *
     * @param query - Filter object with optional lifecycleState and name
     * @param options - Optional pagination/sorting
     * @param tx - Optional transaction client
     * @returns Paginated result
     */
    async findMany(
        query: { lifecycleState?: PostTag['lifecycleState']; name?: string } = {},
        options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
        tx?: DrizzleClient
    ): Promise<{ items: PostTag[]; total: number }> {
        const additionalConditions: SQL[] = [isNull(postTags.deletedAt)];

        if (query.lifecycleState) {
            additionalConditions.push(
                eq(
                    postTags.lifecycleState,
                    // DRIZZLE-LIMITATION: pgEnum branded `_.data` type rejects raw enum strings until cast.
                    query.lifecycleState as unknown as typeof postTags.lifecycleState._.data
                )
            );
        }
        if (query.name?.trim()) {
            additionalConditions.push(safeIlike(postTags.name, query.name.trim()));
        }

        return this.findAll({}, options, additionalConditions, tx) as Promise<{
            items: PostTag[];
            total: number;
        }>;
    }

    /**
     * Returns all ACTIVE PostTags ordered by name.
     *
     * Intended for the public endpoint (D-013) and the admin PostTag picker.
     * No pagination — realistic volume is 50–200 PostTags (D-013).
     *
     * @param tx - Optional transaction client
     * @returns Array of ACTIVE PostTags sorted alphabetically by name
     */
    async findActive(tx?: DrizzleClient): Promise<PostTag[]> {
        const db = this.getClient(tx);
        const logContext = {};

        try {
            const result = await db
                .select()
                .from(postTags)
                .where(
                    and(
                        eq(
                            postTags.lifecycleState,
                            // DRIZZLE-LIMITATION: pgEnum branded `_.data` type rejects raw 'ACTIVE' string until cast.
                            'ACTIVE' as unknown as typeof postTags.lifecycleState._.data
                        ),
                        isNull(postTags.deletedAt)
                    )
                )
                .orderBy(asc(postTags.name));

            logQuery(this.entityName, 'findActive', logContext, result);
            // DRIZZLE-LIMITATION: select(*) returns InferSelect with branded enum columns; cast back to the canonical PostTag[] used by services.
            return result as unknown as PostTag[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findActive', logContext, err);
            throw new DbError(this.entityName, 'findActive', logContext, err.message);
        }
    }

    /**
     * Returns all ACTIVE PostTags with usage counts, ordered by name.
     *
     * Used by `GET /api/v1/public/posts/tags?withCounts=true` (D-013).
     * Performs a LEFT JOIN on r_post_post_tag grouped by post_tags.id so that
     * PostTags with zero assigned posts still appear in the result.
     *
     * @param tx - Optional transaction client
     * @returns Array of PostTag rows augmented with usageCount
     */
    async findActiveWithCounts(tx?: DrizzleClient): Promise<PostTagWithCount[]> {
        const db = this.getClient(tx);
        const logContext = {};

        try {
            const result = await db
                .select({
                    id: postTags.id,
                    name: postTags.name,
                    slug: postTags.slug,
                    color: postTags.color,
                    icon: postTags.icon,
                    description: postTags.description,
                    lifecycleState: postTags.lifecycleState,
                    createdAt: postTags.createdAt,
                    updatedAt: postTags.updatedAt,
                    createdById: postTags.createdById,
                    updatedById: postTags.updatedById,
                    deletedAt: postTags.deletedAt,
                    deletedById: postTags.deletedById,
                    usageCount: count(rPostPostTag.postTagId).as('usageCount')
                })
                .from(postTags)
                .leftJoin(rPostPostTag, eq(postTags.id, rPostPostTag.postTagId))
                .where(
                    and(
                        eq(
                            postTags.lifecycleState,
                            // DRIZZLE-LIMITATION: pgEnum branded `_.data` type rejects raw 'ACTIVE' string until cast.
                            'ACTIVE' as unknown as typeof postTags.lifecycleState._.data
                        ),
                        isNull(postTags.deletedAt)
                    )
                )
                .groupBy(
                    postTags.id,
                    postTags.name,
                    postTags.slug,
                    postTags.color,
                    postTags.icon,
                    postTags.description,
                    postTags.lifecycleState,
                    postTags.createdAt,
                    postTags.updatedAt,
                    postTags.createdById,
                    postTags.updatedById,
                    postTags.deletedAt,
                    postTags.deletedById
                )
                .orderBy(asc(postTags.name));

            const mapped = result.map((row) => ({
                ...row,
                usageCount: Number(row.usageCount)
            }));

            logQuery(this.entityName, 'findActiveWithCounts', logContext, mapped);
            // DRIZZLE-LIMITATION: explicit projection with COUNT() returns a row shape Drizzle infers without the brand; PostTagWithCount adds the augmented shape.
            return mapped as unknown as PostTagWithCount[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findActiveWithCounts', logContext, err);
            throw new DbError(this.entityName, 'findActiveWithCounts', logContext, err.message);
        }
    }

    /**
     * Returns the count of posts that use this PostTag.
     *
     * Used by the impact endpoint before deletion (`GET .../:id/impact`).
     *
     * @param id - UUID of the PostTag
     * @param tx - Optional transaction client
     * @returns Number of r_post_post_tag rows for this postTagId
     */
    async getImpactCount(id: string, tx?: DrizzleClient): Promise<number> {
        const db = this.getClient(tx);
        const logContext = { id };

        try {
            const result = await db
                .select({ total: count() })
                .from(rPostPostTag)
                .where(eq(rPostPostTag.postTagId, id));

            const total = Number(result[0]?.total ?? 0);
            logQuery(this.entityName, 'getImpactCount', logContext, { total });
            return total;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'getImpactCount', logContext, err);
            throw new DbError(this.entityName, 'getImpactCount', logContext, err.message);
        }
    }
}

/** Singleton instance of PostTagModel for use across the application. */
export const postTagModel = new PostTagModel();
