/**
 * Admin create attraction endpoint
 * Allows admins to create new attractions
 */
import {
    AttractionAdminSchema,
    type AttractionCreateInput,
    AttractionCreateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * POST /api/v1/admin/attractions
 * Create attraction - Admin endpoint
 */
export const adminCreateAttractionRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create attraction',
    description: 'Creates a new attraction. Admin only.',
    tags: ['Attractions'],
    requiredPermissions: [PermissionEnum.ATTRACTION_CREATE],
    requestBody: AttractionCreateInputSchema,
    responseSchema: AttractionAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as AttractionCreateInput;

        const result = await attractionService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
