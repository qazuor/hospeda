/**
 * Protected list own owner-promotions endpoint
 * Returns all promotions owned by the authenticated actor, regardless of lifecycleState.
 *
 * Security note (AC-005-01): this route uses `service.list()` which routes through
 * `BaseCrudRead.list()`, NOT through `_executeSearch()`. The public `search()` path
 * hard-forces `lifecycleState = ACTIVE` inside `OwnerPromotionService._executeSearch()`.
 * By using `list()` with an explicit `where: { ownerId: actor.id }` clause, draft and
 * archived promotions are visible to the owner without ever touching the public code path.
 */
import { LifecycleStatusEnum, OwnerPromotionProtectedSchema, PermissionEnum } from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createProtectedListRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * GET /api/v1/protected/owner-promotions
 * List own owner-promotions - Protected endpoint
 *
 * Returns a paginated list of owner promotions belonging to the authenticated user.
 * All lifecycle states (DRAFT, ACTIVE, ARCHIVED) are included so the owner can
 * manage their full promotion portfolio.
 *
 * The actor's ownerId is taken exclusively from the session — the client cannot
 * supply or override it.
 */
export const protectedListOwnOwnerPromotionsRoute = createProtectedListRoute({
    method: 'get',
    path: '/',
    summary: 'List own owner-promotions',
    description:
        'Returns a paginated list of owner promotions owned by the authenticated user across all lifecycle states (DRAFT, ACTIVE, ARCHIVED). Requires OWNER_PROMOTION_VIEW_OWN or OWNER_PROMOTION_VIEW_ANY permission.',
    tags: ['Owner Promotions'],
    requiredPermissions: [PermissionEnum.OWNER_PROMOTION_VIEW_OWN],
    requestQuery: {
        lifecycleState: z
            .enum([
                LifecycleStatusEnum.DRAFT,
                LifecycleStatusEnum.ACTIVE,
                LifecycleStatusEnum.ARCHIVED
            ])
            .optional(),
        page: z.coerce.number().int().min(1).default(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
        sortBy: z.string().min(1).max(50).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional()
    },
    responseSchema: OwnerPromotionProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query ?? {});

        // Scope strictly to the authenticated actor's own promotions.
        // The ownerId is taken from the session — the client cannot influence it.
        const where: Record<string, unknown> = { ownerId: actor.id };

        // Optional lifecycle filter supplied by the owner (e.g. to see only DRAFTs).
        if (query?.lifecycleState) {
            where.lifecycleState = query.lifecycleState;
        }

        const result = await ownerPromotionService.list(actor, {
            page,
            pageSize,
            where,
            sortBy: (query?.sortBy as string | undefined) ?? 'createdAt',
            sortOrder: (query?.sortOrder as 'asc' | 'desc' | undefined) ?? 'desc'
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
