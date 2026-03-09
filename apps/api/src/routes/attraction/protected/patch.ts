/**
 * Protected patch attraction endpoint
 * Requires authentication and ownership
 */
import {
    AttractionIdSchema,
    AttractionProtectedSchema,
    type AttractionUpdateInput,
    AttractionUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/attractions/:id
 * Patch attraction - Protected endpoint
 */
export const protectedPatchAttractionRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Patch attraction',
    description: 'Partially updates an attraction by ID. Requires ATTRACTION_UPDATE permission.',
    tags: ['Attractions'],
    requiredPermissions: [PermissionEnum.ATTRACTION_UPDATE],
    requestParams: { id: AttractionIdSchema },
    requestBody: AttractionUpdateInputSchema.partial(),
    responseSchema: AttractionProtectedSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await attractionService.update(
            actor,
            id,
            body as Partial<AttractionUpdateInput>
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
