/**
 * Admin patch attraction endpoint
 * Allows admins to partially update any attraction
 * Note: Attraction does not have a dedicated PatchInputSchema.
 * AttractionUpdateInputSchema is already partial and is used for both PUT and PATCH.
 */
import {
    AttractionAdminSchema,
    AttractionIdSchema,
    AttractionUpdateInputSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/attractions/:id
 * Partial update attraction - Admin endpoint
 */
export const adminPatchAttractionRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update attraction (admin)',
    description: 'Updates specific fields of any attraction. Admin only.',
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
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);

        const result = await attractionService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: { customRateLimit: { requests: 20, windowMs: 60000 } }
});
