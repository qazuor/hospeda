/**
 * Protected create-post-comment endpoint (SPEC-165 §5.3).
 *
 * POST /api/v1/protected/posts/:postId/comments
 *
 * Requires a session and the POST_COMMENT_CREATE permission. Rate-limited to
 * 5 requests/minute (AC-14). The body carries only the content; entityType is
 * POST (from the route), entityId is the path param, and the author is the
 * session actor. The comment is published immediately as APPROVED and the
 * `posts.comments` counter is incremented by the service. Returns the created
 * comment; 422 for content over 2000 chars (AC-13), 401 unauth (AC-12),
 * 429 when rate-limited (AC-14).
 */
import type { z } from '@hono/zod-openapi';
import {
    CreateCommentBodySchema,
    EntityCommentSchema,
    EntityTypeEnum,
    PermissionEnum,
    PostIdSchema
} from '@repo/schemas';
import { EntityCommentService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import {
    createPerRouteRateLimitMiddleware,
    createSlidingWindowPerUserRateLimit
} from '../../../../middlewares/rate-limit';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createProtectedRoute } from '../../../../utils/route-factory';

/** Per-user hourly write budget: 30 comment submissions per hour. */
const writeCommentRateLimit = createSlidingWindowPerUserRateLimit({
    windowMs: 3_600_000,
    max: 30,
    keyPrefix: 'prot:write:comment'
});

export const protectedCreatePostCommentRoute = createProtectedRoute({
    method: 'post',
    path: '/{postId}/comments',
    summary: 'Create post comment',
    description:
        'Creates a comment on a post. Requires POST_COMMENT_CREATE. Rate-limited to 5/minute.',
    tags: ['Post Comments'],
    requiredPermissions: [PermissionEnum.POST_COMMENT_CREATE],
    requestParams: {
        postId: PostIdSchema
    },
    requestBody: CreateCommentBodySchema,
    responseSchema: EntityCommentSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof CreateCommentBodySchema>;
        const service = new EntityCommentService({ logger: apiLogger });
        const result = await service.create(actor, {
            entityType: EntityTypeEnum.POST,
            entityId: params.postId as string,
            content: input.content
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        // writeCommentRateLimit: per-user hourly ceiling (30/hr, keyed by actor.id).
        // createPerRouteRateLimitMiddleware: per-IP short-burst guard (5/min, AC-14).
        // The per-user check runs first — a user who exhausted their hourly budget
        // gets a clear 429 before the IP burst limiter is consulted.
        middlewares: [
            writeCommentRateLimit,
            createPerRouteRateLimitMiddleware({ requests: 5, windowMs: 60_000 })
        ]
    }
});
