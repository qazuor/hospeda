/**
 * Admin update social credential metadata endpoint (HOS-64 G-4, T-027).
 *
 * Updates the `label` metadata for an existing credential. Does NOT touch
 * the encrypted secret.
 */
import { PermissionEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getClientIp } from '../../../../middlewares/rate-limit';
import {
    SOCIAL_CREDENTIAL_KEYS,
    updateSocialCredentialMetadata
} from '../../../../services/social-credential-vault.service';
import { getActorFromContext } from '../../../../utils/actor';
import { createAdminRoute } from '../../../../utils/route-factory';

/** Request body for updating a social credential's metadata. */
const SocialCredentialUpdateInputSchema = z.object({
    label: z.string().max(255).optional()
});

/** Mutation result — never the plaintext or ciphertext. */
const SocialCredentialMutationResultSchema = z.object({
    id: z.string().uuid(),
    key: z.enum(SOCIAL_CREDENTIAL_KEYS)
});

/**
 * PATCH /api/v1/admin/social/credentials/{key}
 * Updates the label metadata for an existing credential. Does not touch the
 * encrypted secret. Requires SOCIAL_SETTINGS_MANAGE permission.
 */
export const adminUpdateSocialCredentialRoute = createAdminRoute({
    method: 'patch',
    path: '/{key}',
    summary: 'Update social credential metadata',
    description:
        'Updates the label for an existing credential. Does not touch the encrypted secret. ' +
        'Fails with 404 when no active credential exists for the key. ' +
        'Requires SOCIAL_SETTINGS_MANAGE permission.',
    tags: ['Social Credentials'],
    requiredPermissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE],
    requestParams: { key: z.enum(SOCIAL_CREDENTIAL_KEYS) },
    requestBody: SocialCredentialUpdateInputSchema,
    responseSchema: SocialCredentialMutationResultSchema,
    handler: async (ctx, params, body) => {
        const actor = getActorFromContext(ctx);
        const ipAddress = getClientIp({ c: ctx }) ?? null;
        const key = params.key as (typeof SOCIAL_CREDENTIAL_KEYS)[number];
        const parsed = SocialCredentialUpdateInputSchema.parse(body);

        const result = await updateSocialCredentialMetadata({
            key,
            label: parsed.label,
            actorId: actor.id,
            ipAddress
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { id: result.data.id, key: result.data.key };
    }
});
