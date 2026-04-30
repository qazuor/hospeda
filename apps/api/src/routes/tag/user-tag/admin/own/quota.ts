/**
 * Admin own USER tag quota status endpoint
 * Returns the calling actor's current USER tag quota utilization
 *
 * Used to populate the quota indicator bar in the user tag manager UI (AC-003-03).
 * `used` counts only ACTIVE USER tags (quota definition per D-021, D-022).
 * `limit` is the configured quota from HOSPEDA_TAG_USER_QUOTA_PER_USER env var (default 50).
 *
 * @see SPEC-086 D-021, D-022, AC-003-03
 */
import { PermissionEnum } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../../utils/actor';
import { apiLogger } from '../../../../../utils/logger';
import { createAdminRoute } from '../../../../../utils/route-factory';

const tagService = new TagService({ logger: apiLogger });

/** Response schema for quota status */
const QuotaStatusResponseSchema = z.object({
    used: z.number().int().nonnegative(),
    limit: z.number().int().positive()
});

/**
 * GET /api/v1/admin/tags/own/quota
 * Get USER tag quota status — Admin endpoint
 *
 * Returns { used, limit } for the calling actor's USER tag quota.
 * `used` = count of ACTIVE USER tags. `limit` = configured quota.
 * Requires TAG_USER_VIEW_OWN permission.
 *
 * NOTE: This route MUST be registered BEFORE /:id routes in the own/ sub-router
 * to prevent Hono from matching /quota as a tag UUID parameter.
 */
export const adminGetOwnTagQuotaRoute = createAdminRoute({
    method: 'get',
    path: '/quota',
    summary: 'Get own USER tag quota status',
    description:
        "Returns the calling actor's USER tag quota utilization. used=count of ACTIVE USER tags. limit=configured quota (default 50, override via HOSPEDA_TAG_USER_QUOTA_PER_USER). Requires TAG_USER_VIEW_OWN permission.",
    tags: ['Tags', 'OwnTags'],
    requiredPermissions: [PermissionEnum.TAG_USER_VIEW_OWN],
    responseSchema: QuotaStatusResponseSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        apiLogger.debug(`[adminGetOwnTagQuota] actor=${actor.id}`);

        const result = await tagService.getQuotaStatus(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
