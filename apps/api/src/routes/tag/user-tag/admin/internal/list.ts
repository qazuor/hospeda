/**
 * Admin INTERNAL tag list endpoint
 * Returns paginated list of INTERNAL tags only (admin only)
 *
 * INTERNAL tags are operational labels visible only to admins and super-admins.
 * Regular users never see INTERNAL tags in any picker or listing (D-006).
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
 * GET /api/v1/admin/tags/internal
 * List all INTERNAL tags — Admin endpoint
 *
 * Returns all INTERNAL tags (including INACTIVE and ARCHIVED).
 * Requires TAG_INTERNAL_VIEW permission.
 */
export const adminListInternalTagsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List INTERNAL tags (admin)',
    description:
        'Returns a paginated list of all INTERNAL tags including inactive and archived. INTERNAL tags are admin-only operational labels (D-002). Requires TAG_INTERNAL_VIEW permission.',
    tags: ['Tags', 'Internal'],
    requiredPermissions: [PermissionEnum.TAG_INTERNAL_VIEW],
    requestQuery: TagAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: TagSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query ?? {});

        // Force type=INTERNAL filter — this endpoint only exposes INTERNAL tags
        const result = await tagService.adminList(actor, {
            ...(query ?? {}),
            type: 'INTERNAL'
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
