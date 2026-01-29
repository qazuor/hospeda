/**
 * Protected create attraction endpoint
 * Requires authentication
 */
import {
    type AttractionCreateInput,
    AttractionCreateInputSchema,
    AttractionProtectedSchema,
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
 * POST /api/v1/protected/attractions
 * Create attraction - Protected endpoint
 */
export const protectedCreateAttractionRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create attraction',
    description: 'Creates a new attraction. Requires ATTRACTION_CREATE permission.',
    tags: ['Attractions'],
    requiredPermissions: [PermissionEnum.ATTRACTION_CREATE],
    requestBody: AttractionCreateInputSchema,
    responseSchema: AttractionProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await attractionService.create(actor, body as AttractionCreateInput);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
