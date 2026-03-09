/**
 * Admin update attraction endpoint
 * Allows admins to update any attraction
 */
import {
    AttractionAdminSchema,
    AttractionIdSchema,
    type AttractionUpdateInput,
    AttractionUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/attractions/:id
 * Update attraction - Admin endpoint
 */
export const adminUpdateAttractionRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update attraction (admin)',
    description: 'Updates any attraction. Admin only.',
    tags: ['Attractions'],
    requiredPermissions: [PermissionEnum.ATTRACTION_UPDATE],
    requestParams: {
        id: AttractionIdSchema
    },
    requestBody: AttractionUpdateInputSchema,
    responseSchema: AttractionAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as AttractionUpdateInput;

        const result = await attractionService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
