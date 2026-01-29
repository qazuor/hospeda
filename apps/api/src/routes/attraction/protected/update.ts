/**
 * Protected update attraction endpoint
 * Requires authentication and ownership
 */
import {
    AttractionIdSchema,
    AttractionProtectedSchema,
    type AttractionUpdateInput,
    AttractionUpdateInputSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * PUT /api/v1/protected/attractions/:id
 * Update attraction - Protected endpoint
 */
export const protectedUpdateAttractionRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update attraction',
    description: 'Updates an attraction by ID. Requires ATTRACTION_UPDATE permission.',
    tags: ['Attractions'],
    requiredPermissions: [PermissionEnum.ATTRACTION_UPDATE],
    requestParams: { id: AttractionIdSchema },
    requestBody: AttractionUpdateInputSchema,
    responseSchema: AttractionProtectedSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await attractionService.update(actor, id, body as AttractionUpdateInput);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
