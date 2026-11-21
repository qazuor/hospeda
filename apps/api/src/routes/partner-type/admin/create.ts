/**
 * Admin create endpoint for partner types (HOS-2336).
 */
import {
    PartnerTypeAdminSchema,
    type PartnerTypeCreateInput,
    PartnerTypeCreateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { PartnerTypeService, purgePartnerTypesCache, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const partnerTypeService = new PartnerTypeService({ logger: apiLogger });

/**
 * POST /api/v1/admin/partner-types
 * Creates a type (ACTIVE by default), then purges the catalog cache tag.
 * A slug already taken, even by a soft-deleted type, answers 409 ALREADY_EXISTS.
 */
export const adminCreatePartnerTypeRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create partner type',
    description: 'Creates a partner type. The slug is immutable afterwards and never reusable.',
    tags: ['PartnerTypes'],
    requiredPermissions: [PermissionEnum.PARTNER_TYPE_CREATE],
    requestBody: PartnerTypeCreateInputSchema,
    responseSchema: PartnerTypeAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await partnerTypeService.create(actor, body as PartnerTypeCreateInput);
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }
        await purgePartnerTypesCache({ triggeredBy: actor.id });
        return result.data;
    }
});
