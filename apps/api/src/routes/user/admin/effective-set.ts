import { UserModel } from '@repo/db';
import {
    AdminEffectiveSetQuerySchema,
    AdminEffectiveSetResponseSchema,
    CATALOG_KEY_DEFINITIONS,
    PermissionEnum,
    UserIdSchema,
    type VerticalEnum
} from '@repo/schemas';
import { entityNotFoundError } from '@repo/service-core';
import { encodeFiniteOrInfinite } from '@repo/verticals';
import { getListingAccessPorts } from '../../../utils/listing-access/ports';
import { createAdminRoute } from '../../../utils/route-factory';

const userModel = new UserModel();

/** HOS-1638 AC:B13a:23 Coord-7: read V3's effective set for one admin subject. */
export const adminGetUserEffectiveSetRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/effective-set',
    summary: 'Get user effective set (admin)',
    description: 'Reads V3 effective entitlements and limits for one user and vertical.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT],
    requestParams: { id: UserIdSchema },
    requestQuery: AdminEffectiveSetQuerySchema.shape,
    responseSchema: AdminEffectiveSetResponseSchema,
    handler: async (_ctx, params, _body, query) => {
        const userId = params.id as string;
        const vertical = query?.vertical as VerticalEnum;
        if (!(await userModel.findById(userId))) {
            throw entityNotFoundError({ entityName: 'User' });
        }
        const effective = await getListingAccessPorts().effectiveSet({ userId, vertical });
        const entitlements: Record<string, number | 'Infinity'> = {};
        const limits: Record<string, number | 'Infinity'> = {};
        for (const definition of CATALOG_KEY_DEFINITIONS) {
            const value = (
                definition.kind === 'entitlement' ? effective.entitlements : effective.limits
            ).get({
                key: definition.key,
                userId,
                vertical
            });
            if (value === undefined) continue;
            (definition.kind === 'entitlement' ? entitlements : limits)[definition.key] =
                encodeFiniteOrInfinite(value);
        }
        return {
            userId,
            vertical,
            hasLiveNonTrialTitle: effective.hasLiveNonTrialTitle,
            entitlements,
            limits
        };
    }
});
