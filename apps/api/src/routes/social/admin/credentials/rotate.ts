/**
 * Admin rotate social credential endpoint (HOS-64 G-4, T-027).
 *
 * Replaces the encrypted secret for the active credential of the given key.
 * The old ciphertext is permanently overwritten.
 */
import { PermissionEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getClientIp } from '../../../../middlewares/rate-limit';
import {
    SOCIAL_CREDENTIAL_KEYS,
    rotateSocialCredential
} from '../../../../services/social-credential-vault.service';
import { getActorFromContext } from '../../../../utils/actor';
import { createAdminRoute } from '../../../../utils/route-factory';

/** Request body for rotating an existing social credential. */
const SocialCredentialRotateInputSchema = z.object({
    newPlaintext: z.string().min(1, 'newPlaintext must not be empty')
});

/** Mutation result — never the plaintext or ciphertext. */
const SocialCredentialMutationResultSchema = z.object({
    id: z.string().uuid(),
    key: z.enum(SOCIAL_CREDENTIAL_KEYS)
});

/**
 * POST /api/v1/admin/social/credentials/{key}/rotate
 * Rotates the active credential for a key by overwriting its ciphertext.
 * Requires SOCIAL_SETTINGS_MANAGE permission.
 */
export const adminRotateSocialCredentialRoute = createAdminRoute({
    method: 'post',
    path: '/{key}/rotate',
    summary: 'Rotate social credential',
    description:
        'Replaces the encrypted secret for the active credential of the given key. ' +
        'The old ciphertext is permanently overwritten. ' +
        'Fails with 404 when no active credential exists for the key. ' +
        'Requires SOCIAL_SETTINGS_MANAGE permission.',
    tags: ['Social Credentials'],
    requiredPermissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE],
    requestParams: { key: z.enum(SOCIAL_CREDENTIAL_KEYS) },
    requestBody: SocialCredentialRotateInputSchema,
    responseSchema: SocialCredentialMutationResultSchema,
    handler: async (ctx, params, body) => {
        const actor = getActorFromContext(ctx);
        const ipAddress = getClientIp({ c: ctx }) ?? null;
        const key = params.key as (typeof SOCIAL_CREDENTIAL_KEYS)[number];
        const parsed = SocialCredentialRotateInputSchema.parse(body);

        const result = await rotateSocialCredential({
            key,
            newPlaintext: parsed.newPlaintext,
            actorId: actor.id,
            ipAddress
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { id: result.data.id, key: result.data.key };
    }
});
