/**
 * Admin SYSTEM tag list endpoint
 * Returns paginated list of SYSTEM tags only
 *
 * SYSTEM tags are shared organizational labels usable by any authenticated user.
 * They appear in all authenticated users' pickers (D-006).
 *
 * @see SPEC-086 D-002, D-006, D-017
 */
import { PermissionEnum, TagAdminSearchSchema, TagSchema } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import { getActorFromContext } from '../../../../../utils/actor';
import { apiLogger } from '../../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../../utils/pagination';
import { createAdminListRoute } from '../../../../../utils/route-factory';

const tagService = new TagService({ logger: apiLogger });

/**
 * GET /api/v1/admin/tags/system
 * List all SYSTEM tags — Admin endpoint
 *
 * Returns all SYSTEM tags (including INACTIVE and ARCHIVED).
 * Requires TAG_SYSTEM_VIEW permission.
 */
export const adminListSystemTagsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List SYSTEM tags (admin)',
    description:
        'Returns a paginated list of all SYSTEM tags including inactive and archived. SYSTEM tags are shared labels usable by any authenticated user (D-002). Requires TAG_SYSTEM_VIEW permission.',
    tags: ['Tags', 'System'],
    requiredPermissions: [PermissionEnum.TAG_SYSTEM_VIEW],
    requestQuery: TagAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: TagSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query ?? {});

        // Force type=SYSTEM filter — this endpoint only exposes SYSTEM tags
        const result = await tagService.adminList(actor, {
            ...(query ?? {}),
            type: 'SYSTEM'
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
