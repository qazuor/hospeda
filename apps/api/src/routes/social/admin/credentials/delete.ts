/**
 * Admin delete social credential endpoint (HOS-64 G-4, T-027).
 *
 * Soft-deletes the active credential for the given key.
 */
import { PermissionEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getClientIp } from '../../../../middlewares/rate-limit';
import {
    deleteSocialCredential,
    SOCIAL_CREDENTIAL_KEYS
} from '../../../../services/social-credential-vault.service';
import { getActorFromContext } from '../../../../utils/actor';
import { createAdminRoute } from '../../../../utils/route-factory';

/**
 * DELETE /api/v1/admin/social/credentials/{key}
 * Soft-deletes the active credential for the given key.
 * Fails with 404 when no active credential exists for the key.
 * Requires SOCIAL_SETTINGS_MANAGE permission.
 */
export const adminDeleteSocialCredentialRoute = createAdminRoute({
    method: 'delete',
    path: '/{key}',
    summary: 'Delete social credential',
    description:
        'Soft-deletes the active credential for the given key. ' +
        'The row is retained in the database but is no longer active. ' +
        'Fails with 404 when no active credential exists for the key. ' +
        'Requires SOCIAL_SETTINGS_MANAGE permission.',
    tags: ['Social Credentials'],
    requiredPermissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE],
    requestParams: { key: z.enum(SOCIAL_CREDENTIAL_KEYS) },
    responseSchema: z.object({ key: z.enum(SOCIAL_CREDENTIAL_KEYS) }),
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const ipAddress = getClientIp({ c: ctx }) ?? null;
        const key = params.key as (typeof SOCIAL_CREDENTIAL_KEYS)[number];

        const result = await deleteSocialCredential({ key, actorId: actor.id, ipAddress });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { key: result.data.key };
    }
});
