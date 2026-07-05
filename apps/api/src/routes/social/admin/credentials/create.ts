/**
 * Admin create social credential endpoint (HOS-64 G-4, T-026).
 *
 * Encrypts a plaintext secret and stores it in the social credential vault.
 * Fails with 422 when an active credential already exists for `key` — the
 * caller must rotate instead (T-027).
 */
import { PermissionEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getClientIp } from '../../../../middlewares/rate-limit';
import {
    createSocialCredential,
    SOCIAL_CREDENTIAL_KEYS
} from '../../../../services/social-credential-vault.service';
import { getActorFromContext } from '../../../../utils/actor';
import { createAdminRoute } from '../../../../utils/route-factory';

/** Request body for creating a new social credential. */
const SocialCredentialCreateInputSchema = z.object({
    key: z.enum(SOCIAL_CREDENTIAL_KEYS),
    plaintext: z.string().min(1, 'plaintext must not be empty'),
    label: z.string().max(255).optional()
});

/** Mutation result — never the plaintext or ciphertext. */
const SocialCredentialMutationResultSchema = z.object({
    id: z.string().uuid(),
    key: z.enum(SOCIAL_CREDENTIAL_KEYS)
});

/**
 * POST /api/v1/admin/social/credentials
 * Creates a new encrypted social credential.
 * Returns only `{ id, key }` — never the plaintext or ciphertext.
 * Requires SOCIAL_SETTINGS_MANAGE permission.
 */
export const adminCreateSocialCredentialRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create social credential',
    description:
        'Encrypts a plaintext secret and stores it in the social credential vault. ' +
        'Returns only the credential ID and key — never the plaintext. ' +
        'Fails with 422 when an active credential already exists for the key. ' +
        'Requires SOCIAL_SETTINGS_MANAGE permission.',
    tags: ['Social Credentials'],
    requiredPermissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE],
    requestBody: SocialCredentialCreateInputSchema,
    responseSchema: SocialCredentialMutationResultSchema,
    successStatusCode: 201,
    handler: async (ctx, _params, body) => {
        const actor = getActorFromContext(ctx);
        const ipAddress = getClientIp({ c: ctx }) ?? null;
        const parsed = SocialCredentialCreateInputSchema.parse(body);

        const result = await createSocialCredential({
            key: parsed.key,
            plaintext: parsed.plaintext,
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
