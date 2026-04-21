/**
 * Protected list own accommodations endpoint
 * Returns only accommodations owned by the authenticated user.
 */
import { AccommodationProtectedSchema, LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createProtectedListRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/protected/accommodations
 * List own accommodations - Protected endpoint
 * Returns only accommodations owned by the currently authenticated user.
 */
export const protectedListOwnAccommodationsRoute = createProtectedListRoute({
    method: 'get',
    path: '/',
    summary: 'List own accommodations',
    description:
        'Returns a paginated list of accommodations owned by the authenticated user. Optionally filter by lifecycleState.',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_LISTING_VIEW],
    requestQuery: {
        lifecycleState: z
            .enum([
                LifecycleStatusEnum.DRAFT,
                LifecycleStatusEnum.ACTIVE,
                LifecycleStatusEnum.ARCHIVED
            ])
            .optional(),
        page: z.coerce.number().int().min(1).default(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).default(50).optional()
    },
    responseSchema: AccommodationProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query ?? {});

        const where: Record<string, unknown> = { ownerId: actor.id };

        if (query?.lifecycleState) {
            where.lifecycleState = query.lifecycleState;
        }

        const result = await accommodationService.list(actor, {
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
