/**
 * Public get owner promotion by ID endpoint
 * Returns a single owner promotion by its ID
 */
import {
    LifecycleStatusEnum,
    OwnerPromotionIdSchema,
    OwnerPromotionPublicSchema
} from '@repo/schemas';
import { OwnerPromotionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const ownerPromotionService = new OwnerPromotionService({ logger: apiLogger });

/**
 * GET /api/v1/public/owner-promotions/:id
 * Get owner promotion by ID - Public endpoint
 *
 * Two-part defense for GAP-005 / SPEC-063-gaps T-006:
 *   1. Excludes records whose `lifecycleState !== ACTIVE` so DRAFT/ARCHIVED
 *      promotions cannot be probed by UUID.
 *   2. Parses the returned row through `OwnerPromotionPublicSchema` to strip
 *      admin-only fields (`lifecycleState`, `ownerId`, `currentRedemptions`,
 *      audit columns). Partial close of the systemic issue tracked by SPEC-087.
 */
export const publicGetOwnerPromotionByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get owner promotion by ID',
    description: 'Retrieves an owner promotion by its ID',
    tags: ['Owner Promotions'],
    requestParams: { id: OwnerPromotionIdSchema },
    responseSchema: OwnerPromotionPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await ownerPromotionService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // Gate: only ACTIVE, non-deleted records are visible on the public tier.
        // - lifecycleState !== ACTIVE  → DRAFT/ARCHIVED promos must not be probed by UUID.
        // - deletedAt != null          → soft-deleted promos must not remain fetchable
        //   even when their lifecycleState is still ACTIVE (SPEC-285 FIX 2).
        const row = result.data as
            | { lifecycleState?: string; deletedAt?: unknown }
            | null
            | undefined;
        if (!row || row.lifecycleState !== LifecycleStatusEnum.ACTIVE || row.deletedAt != null) {
            return null;
        }

        // Strip admin-only fields before the response leaves the public tier.
        return OwnerPromotionPublicSchema.parse(row);
    },
    options: {
        cacheTTL: 300
    }
});
