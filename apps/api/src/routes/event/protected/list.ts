/**
 * Protected list own events endpoint
 * Returns only events authored by the authenticated user.
 */
import { EventProtectedSchema, LifecycleStatusEnum, ModerationStatusEnum } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createProtectedListRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * GET /api/v1/protected/events
 * List own events - Protected endpoint
 *
 * The event twin of the protected post listing (HOS-374 §5.2.2).
 *
 * Deliberately NOT `EventService.getByAuthor`: that one backs the PUBLIC
 * `GET /events/author/{id}` route, where anyone may ask for anyone's events, so
 * it carries the public read floor and can never return a draft. This route is
 * the opposite case — the session identifies the author, so it reads through
 * `service.list`, which carries no floor.
 *
 * Authorship is forced from the session, never accepted as a query parameter.
 */
export const protectedListOwnEventsRoute = createProtectedListRoute({
    method: 'get',
    path: '/',
    summary: 'List own events',
    description:
        'Returns a paginated list of events authored by the authenticated user, in every moderation and lifecycle state. Optionally filter by moderationState or lifecycleState.',
    tags: ['Events'],
    // No permission gate: the handler filters strictly by `authorId = actor.id`.
    // See the post twin for why a *_VIEW_ALL requirement would be wrong here.
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
    responseSchema: EventProtectedSchema,
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

        const result = await eventService.list(actor, {
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
