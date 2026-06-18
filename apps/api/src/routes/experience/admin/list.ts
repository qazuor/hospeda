/**
 * Admin experience list endpoint
 * Returns all experience listings with full admin access.
 */
import { ExperienceAdminSchema, ExperienceAdminSearchSchema } from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * GET /api/v1/admin/experiences
 * List experience listings — Admin endpoint.
 *
 * Permission model: the entity-specific permission (COMMERCE_VIEW_ALL) is
 * enforced in the service (`_canAdminList` → `checkExperienceCanAdminList`).
 * The route gate only requires admin-panel access, matching the accommodation
 * admin list pattern.
 */
export const adminListExperiencesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List experience listings (admin)',
    description: 'Returns a paginated list of experience listings with full admin details',
    tags: ['Experience'],
    requestQuery: ExperienceAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: ExperienceAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await experienceService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
