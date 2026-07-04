/**
 * Admin list social credentials endpoint (HOS-64 G-4, T-026).
 *
 * Returns the masked (non-secret) subset of social credential vault rows.
 * `ciphertext`, `iv`, and `authTag` are never included in the response.
 */
import { PermissionEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { z } from 'zod';
import {
    SOCIAL_CREDENTIAL_KEYS,
    listSocialCredentials
} from '../../../../services/social-credential-vault.service';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

/** Query params accepted by the credential list endpoint. */
const SocialCredentialListQuerySchema = z.object({
    includeDeleted: z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional()
});

/** Masked social credential shape — never ciphertext, iv, or authTag. */
const SocialCredentialMaskedSchema = z.object({
    id: z.string().uuid(),
    key: z.enum(SOCIAL_CREDENTIAL_KEYS),
    label: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable()
});

/**
 * GET /api/v1/admin/social/credentials
 * Paginated list of masked social credentials — Admin endpoint.
 * Requires SOCIAL_SETTINGS_MANAGE permission (reuses the permission that
 * already gates `make_webhook_url` via the settings route, per T-001).
 */
export const adminListSocialCredentialsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List social credentials (admin)',
    description:
        'Returns paginated, masked social credential vault rows. ' +
        'Sensitive fields (ciphertext, iv, authTag) are excluded. ' +
        'Requires SOCIAL_SETTINGS_MANAGE permission.',
    tags: ['Social Credentials'],
    requiredPermissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE],
    requestQuery: SocialCredentialListQuerySchema.shape,
    responseSchema: SocialCredentialMaskedSchema,
    handler: async (_ctx, _params, _body, query) => {
        const { page, pageSize } = extractPaginationParams(query ?? {});
        const rawIncludeDeleted = query?.includeDeleted;
        const includeDeleted = rawIncludeDeleted === true || rawIncludeDeleted === 'true';

        const result = await listSocialCredentials({ includeDeleted });
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const allItems = result.data?.items ?? [];
        const total = result.data?.total ?? 0;
        const start = (page - 1) * pageSize;
        const items = allItems.slice(start, start + pageSize);

        return {
            items,
            pagination: getPaginationResponse(total, { page, pageSize })
        };
    }
});
