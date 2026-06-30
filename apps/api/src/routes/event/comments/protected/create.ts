/**
 * Protected create-event-comment endpoint (SPEC-165 §5.3).
 *
 * POST /api/v1/protected/events/:eventId/comments
 *
 * Requires a session and the EVENT_COMMENT_CREATE permission. Rate-limited to
 * 5 requests/minute. Same contract as the post variant, but events have no
 * counter (AC-26), so no `posts.comments` update occurs.
 */
import type { z } from '@hono/zod-openapi';
import {
    CreateCommentBodySchema,
    EntityCommentSchema,
    EntityTypeEnum,
    EventIdSchema,
    PermissionEnum
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

export const protectedCreateEventCommentRoute = createProtectedRoute({
    method: 'post',
    path: '/{eventId}/comments',
    summary: 'Create event comment',
    description:
        'Creates a comment on an event. Requires EVENT_COMMENT_CREATE. Rate-limited to 5/minute.',
    tags: ['Event Comments'],
    requiredPermissions: [PermissionEnum.EVENT_COMMENT_CREATE],
    requestParams: {
        eventId: EventIdSchema
    },
    requestBody: CreateCommentBodySchema,
    responseSchema: EntityCommentSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof CreateCommentBodySchema>;
        const service = new EntityCommentService({ logger: apiLogger });
        const result = await service.create(actor, {
            entityType: EntityTypeEnum.EVENT,
            entityId: params.eventId as string,
            content: input.content
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        // writeCommentRateLimit: per-user hourly ceiling (30/hr, keyed by actor.id).
        // createPerRouteRateLimitMiddleware: per-IP short-burst guard (5/min).
        // The per-user check runs first — a user who exhausted their hourly budget
        // gets a clear 429 before the IP burst limiter is consulted.
        middlewares: [
            writeCommentRateLimit,
            createPerRouteRateLimitMiddleware({ requests: 5, windowMs: 60_000 })
        ]
    }
});
