/**
 * Protected list own posts endpoint
 * Returns only posts authored by the authenticated user.
 */
import { LifecycleStatusEnum, ModerationStatusEnum, PostProtectedSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createProtectedListRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/protected/posts
 * List own posts - Protected endpoint
 *
 * The editor's own content, including what the public cannot see: the whole
 * point of this route is that an author reviews their own drafts and their
 * rejected posts (HOS-374 §5.2.2). It therefore reaches the DB through
 * `service.list`, which is a separate path from `search`/`_executeSearch` and
 * deliberately carries no public read floor.
 *
 * Authorship is forced from the session — `authorId` is NOT accepted as a query
 * parameter. A route that took it from the caller would be an author-scoped
 * listing in name only.
 */
export const protectedListOwnPostsRoute = createProtectedListRoute({
    method: 'get',
    path: '/',
    summary: 'List own posts',
    description:
        'Returns a paginated list of posts authored by the authenticated user, in every moderation and lifecycle state. Optionally filter by moderationState or lifecycleState.',
    tags: ['Posts'],
    // No permission gate, matching the accommodation precedent: the handler
    // filters strictly by `authorId = actor.id`, so any authenticated user sees
    // only their own posts. Requiring POST_VIEW_ALL here would 403 exactly the
    // editors this page exists for — they deliberately do not hold it (§7.6.2).
    requestQuery: {
        moderationState: z
            .enum([
                ModerationStatusEnum.PENDING,
                ModerationStatusEnum.APPROVED,
                ModerationStatusEnum.REJECTED
            ])
            .optional(),
        lifecycleState: z
            .enum([
                LifecycleStatusEnum.DRAFT,
                LifecycleStatusEnum.ACTIVE,
                LifecycleStatusEnum.ARCHIVED
            ])
            .optional(),
        page: z.coerce.number().int().min(1).default(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).default(50).optional(),
        sortBy: z.string().min(1).max(50).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional()
    },
    responseSchema: PostProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query ?? {});

        // Assigned last so no caller-supplied filter can widen the scope past
        // the acting author.
        const where: Record<string, unknown> = {};
        if (query?.moderationState) {
            where.moderationState = query.moderationState;
        }
        if (query?.lifecycleState) {
            where.lifecycleState = query.lifecycleState;
        }
        where.authorId = actor.id;

        const result = await postService.list(actor, {
            page,
            pageSize,
            where,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    }
});
