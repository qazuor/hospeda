/**
 * Protected soft delete attraction endpoint
 * Requires authentication and ownership
 */
import { AttractionIdSchema, PermissionEnum } from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/attractions/:id
 * Soft delete attraction - Protected endpoint
 */
export const protectedSoftDeleteAttractionRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete attraction',
    description: 'Soft deletes an attraction by ID. Requires ATTRACTION_DELETE permission.',
    tags: ['Attractions'],
    requiredPermissions: [PermissionEnum.ATTRACTION_DELETE],
    requestParams: { id: AttractionIdSchema },
    responseSchema: z.object({ id: AttractionIdSchema }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await attractionService.softDelete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { id };
    }
});
