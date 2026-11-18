/**
 * Admin PATCH endpoint for partner types (HOS-2336).
 */
import {
    PartnerTypeAdminSchema,
    PartnerTypeIdSchema,
    type PartnerTypeUpdateInput,
    PartnerTypeUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { PartnerTypeService, purgePartnerTypesCache, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const partnerTypeService = new PartnerTypeService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/partner-types/:id
 * The update schema is strict: a body with `slug` answers 400 (AC-3.3).
 * Deactivating a type still used by partners answers 409 PARTNER_TYPE_IN_USE
 * with `details.count` (AC-3.4).
 */
export const adminPatchPartnerTypeRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Update partner type',
    description:
        'Partially updates a partner type. `slug` cannot be changed. Deactivating a type in use answers 409 PARTNER_TYPE_IN_USE.',
    tags: ['PartnerTypes'],
    requiredPermissions: [PermissionEnum.PARTNER_TYPE_UPDATE],
    requestParams: { id: PartnerTypeIdSchema },
    requestBody: PartnerTypeUpdateInputSchema,
    responseSchema: PartnerTypeAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await partnerTypeService.update(
            actor,
            params.id as string,
            body as PartnerTypeUpdateInput
        );
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }
        await purgePartnerTypesCache({ triggeredBy: actor.id });
        return result.data;
    }
});
