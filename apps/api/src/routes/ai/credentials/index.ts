/**
 * Admin AI credentials routes (SPEC-173 T-026).
 *
 * Manages encrypted AI provider API keys via the credential vault.
 * All routes require `AI_SETTINGS_MANAGE` permission (SUPER_ADMIN-only).
 *
 * Routes:
 * - GET  /                      — paginated list of masked credentials
 * - POST /                      — create (encrypt + store) a new credential
 * - POST /{providerId}/rotate   — rotate an existing credential in-place
 * - DELETE /{providerId}        — soft-delete an existing credential
 *
 * SECURITY: plaintext keys, ciphertext, IV, and authTag NEVER appear in any
 * response.  Only the masked subset (`id`, `providerId`, `label`, `metadata`,
 * timestamps) is exposed.
 *
 * @module routes/ai/credentials
 */

import {
    AiCredentialCreateInputSchema,
    AiCredentialMaskedSchema,
    AiCredentialMutationResultSchema,
    AiCredentialRotateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getClientIp } from '../../../middlewares/rate-limit.js';
import {
    createAiProviderCredential,
    deleteAiProviderCredential,
    listAiProviderCredentials,
    rotateAiProviderCredential
} from '../../../services/ai-credential-vault.service.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { createRouter } from '../../../utils/create-app.js';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination.js';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory.js';

// ---------------------------------------------------------------------------
// Query schema for list route
// ---------------------------------------------------------------------------

/** Query params accepted by the credential list endpoint. */
const CredentialListQuerySchema = z.object({
    includeDeleted: z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional()
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/admin/ai/credentials
 * Paginated list of masked AI provider credentials.
 * Never returns ciphertext, IV, or authTag.
 */
const listCredentialsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List AI provider credentials',
    description:
        'Returns paginated, masked AI provider credentials. ' +
        'Sensitive fields (ciphertext, iv, authTag) are excluded. ' +
        'Requires AI_SETTINGS_MANAGE permission.',
    tags: ['AI Credentials'],
    requiredPermissions: [PermissionEnum.AI_SETTINGS_MANAGE],
    requestQuery: CredentialListQuerySchema.shape,
    responseSchema: AiCredentialMaskedSchema,
    handler: async (_c, _params, _body, query) => {
        const { page, pageSize } = extractPaginationParams(query ?? {});
        // After the route factory's Zod validation, includeDeleted is a boolean.
        // We also guard against the raw string form for test compatibility.
        const rawIncludeDeleted = query?.includeDeleted;
        const includeDeleted = rawIncludeDeleted === true || rawIncludeDeleted === 'true';

        const result = await listAiProviderCredentials({ includeDeleted });
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

/**
 * POST /api/v1/admin/ai/credentials
 * Creates a new encrypted AI provider credential.
 * Returns only { id, providerId } — NEVER the plaintext key or ciphertext.
 */
const createCredentialRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create AI provider credential',
    description:
        'Encrypts a plaintext API key and stores it in the credential vault. ' +
        'Returns only the credential ID and provider ID — never the plaintext. ' +
        'Fails with 422 when an active credential already exists for the provider. ' +
        'Requires AI_SETTINGS_MANAGE permission.',
    tags: ['AI Credentials'],
    requiredPermissions: [PermissionEnum.AI_SETTINGS_MANAGE],
    requestBody: AiCredentialCreateInputSchema,
    responseSchema: AiCredentialMutationResultSchema,
    successStatusCode: 201,
    handler: async (c, _params, body) => {
        const actor = getActorFromContext(c);
        const ipAddress = getClientIp({ c }) ?? null;
        const parsed = AiCredentialCreateInputSchema.parse(body);

        const result = await createAiProviderCredential({
            actor,
            ipAddress,
            providerId: parsed.providerId,
            plaintextKey: parsed.plaintextKey,
            label: parsed.label,
            metadata: parsed.metadata
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // Only id + providerId — no plaintext, no ciphertext.
        return { id: result.data.id, providerId: result.data.providerId };
    }
});

/**
 * POST /api/v1/admin/ai/credentials/{providerId}/rotate
 * Rotates the active credential for a provider by overwriting the ciphertext.
 */
const rotateCredentialRoute = createAdminRoute({
    method: 'post',
    path: '/{providerId}/rotate',
    summary: 'Rotate AI provider credential',
    description:
        'Replaces the encrypted key for the active credential of the given provider. ' +
        'The old ciphertext is permanently overwritten. ' +
        'Requires AI_SETTINGS_MANAGE permission.',
    tags: ['AI Credentials'],
    requiredPermissions: [PermissionEnum.AI_SETTINGS_MANAGE],
    requestParams: { providerId: z.string().min(1) },
    requestBody: AiCredentialRotateInputSchema,
    responseSchema: AiCredentialMutationResultSchema,
    handler: async (c, params, body) => {
        const actor = getActorFromContext(c);
        const ipAddress = getClientIp({ c }) ?? null;
        const providerId = params.providerId as string;
        const parsed = AiCredentialRotateInputSchema.parse(body);

        const result = await rotateAiProviderCredential({
            actor,
            ipAddress,
            providerId,
            newPlaintextKey: parsed.newPlaintextKey
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { id: result.data.id, providerId: result.data.providerId };
    }
});

/**
 * DELETE /api/v1/admin/ai/credentials/{providerId}
 * Soft-deletes the active credential for a provider.
 */
const deleteCredentialRoute = createAdminRoute({
    method: 'delete',
    path: '/{providerId}',
    summary: 'Delete AI provider credential',
    description:
        'Soft-deletes the active credential for the given provider. ' +
        'The row is retained in the database but is no longer active. ' +
        'Requires AI_SETTINGS_MANAGE permission.',
    tags: ['AI Credentials'],
    requiredPermissions: [PermissionEnum.AI_SETTINGS_MANAGE],
    requestParams: { providerId: z.string().min(1) },
    responseSchema: z.object({ providerId: z.string() }),
    handler: async (c, params) => {
        const actor = getActorFromContext(c);
        const ipAddress = getClientIp({ c }) ?? null;
        const providerId = params.providerId as string;

        const result = await deleteAiProviderCredential({ actor, ipAddress, providerId });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { providerId: result.data.providerId };
    }
});

// ---------------------------------------------------------------------------
// Router assembly
// ---------------------------------------------------------------------------

const app = createRouter();

app.route('/', listCredentialsRoute);
app.route('/', createCredentialRoute);
app.route('/', rotateCredentialRoute);
app.route('/', deleteCredentialRoute);

export { app as adminAiCredentialsRoutes };
