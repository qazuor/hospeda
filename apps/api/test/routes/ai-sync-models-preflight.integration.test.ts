/**
 * E2E integration tests for the BETA-129 part 1 model-sync preflight endpoint.
 *
 * Exercises `POST /api/v1/admin/ai/credentials/sync-models/preview`
 * end-to-end through `initApp()` + `app.request()` — the real route, the
 * real `syncAiProviderModelsPreflight` orchestration service, the real
 * `filterChatCapableModels` classifier, and the real
 * `mergeDetectedAndCuratedModels` merge all run unmocked. Only the outbound
 * `listProviderModels` boundary is mocked, matching
 * `test/routes/ai-sync-models.integration.test.ts` (the stored-credential
 * sibling route). Unlike that sibling, this route never touches the
 * credential vault or the DB — there is no stored credential yet, so no
 * `getDecryptedAiProviderCredential` / `getDb` mocks are needed here.
 *
 * @module test/routes/ai-sync-models-preflight.integration
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state (vi.hoisted runs before vi.mock factories)
// ---------------------------------------------------------------------------

const { mockListProviderModels } = vi.hoisted(() => ({
    mockListProviderModels: vi.fn()
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Keep the real ListModelsError subclasses so the service's `instanceof`
// error-mapping (mapListModelsError) works correctly — only the fetcher
// function itself is replaced.
vi.mock('@repo/ai-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/ai-core')>();
    return {
        ...actual,
        listProviderModels: mockListProviderModels
    };
});

// The global `test/setup.ts` mock of `@repo/service-core` substitutes
// `ServiceError` with an unrelated local class, while the route factory's
// error handler imports the REAL `ServiceError` from `@repo/service-core`.
// This local override reverts `@repo/service-core` to its real
// implementation for this file only, so the route's actual
// VALIDATION_ERROR -> 400 mapping is exercised for real (mirrors the
// stored-credential sibling test's identical override).
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ListModelsAuthError } from '@repo/ai-core';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const ADMIN_ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAINTEXT_KEY = 'sk-test-not-yet-saved-do-not-log-or-return';

/** Auth headers for a SUPER_ADMIN actor with AI_SETTINGS_MANAGE. */
function adminHeaders(): Record<string, string> {
    return {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': ADMIN_ACTOR_ID,
        'x-mock-actor-role': RoleEnum.SUPER_ADMIN,
        'x-mock-actor-permissions': JSON.stringify([
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.AI_SETTINGS_MANAGE
        ])
    };
}

/** POSTs to the preflight sync-models endpoint with the given body. */
function syncModelsPreview(body: Record<string, unknown>) {
    return app.request('/api/v1/admin/ai/credentials/sync-models/preview', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify(body)
    });
}

let app: AppOpenAPI;

describe('POST /api/v1/admin/ai/credentials/sync-models/preview (BETA-129 part 1)', () => {
    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockListProviderModels.mockResolvedValue({ ids: ['gpt-4o'] });
    });

    it('returns the merged model catalog for a caller-supplied plaintext key, never persisting anything', async () => {
        // Arrange
        mockListProviderModels.mockResolvedValue({
            ids: ['gpt-4o', 'text-embedding-3-large']
        });

        // Act
        const res = await syncModelsPreview({
            providerId: 'openai',
            plaintextKey: PLAINTEXT_KEY
        });

        // Assert — action-POST routes default to 201 (route-factory.ts).
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.providerId).toBe('openai');

        const ids = (body.data.models as Array<{ id: string }>).map((m) => m.id);
        expect(ids).not.toContain('text-embedding-3-large');
        expect(body.data.hiddenModelIds).toEqual(['text-embedding-3-large']);
        expect(ids).toContain('gpt-4o');

        // The key must never be echoed back.
        expect(JSON.stringify(body)).not.toContain(PLAINTEXT_KEY);
    });

    it('forwards the caller-supplied apiKey and baseURL to listProviderModels, unmediated by any stored credential', async () => {
        // Act
        await syncModelsPreview({
            providerId: 'ollama',
            plaintextKey: PLAINTEXT_KEY,
            baseURL: 'http://localhost:11434'
        });

        // Assert
        expect(mockListProviderModels).toHaveBeenCalledWith(
            expect.objectContaining({
                providerId: 'ollama',
                apiKey: PLAINTEXT_KEY,
                baseURL: 'http://localhost:11434'
            })
        );
    });

    it('rejects a body missing plaintextKey with a 400 validation error', async () => {
        // Act
        const res = await syncModelsPreview({ providerId: 'openai' });

        // Assert
        expect(res.status).toBe(400);
        expect(mockListProviderModels).not.toHaveBeenCalled();
    });

    // Note: `.strict()` rejection of unknown body fields is asserted at the
    // Zod-schema unit level (`AiSyncModelsPreflightInputSchema` in
    // `packages/schemas`) instead of here. The route factory's
    // `createOpenAPISchema` (`apps/api/src/utils/openapi-schema.ts`) rebuilds
    // a plain `z.object(shape)` from any `ZodObject`'s shape for OpenAPI doc
    // generation, which loses `.strict()`'s `unknownKeys: 'strict'` config —
    // a pre-existing, codebase-wide framework limitation (verified true of
    // the sibling `AiCredentialCreateInputSchema` route too), not specific to
    // this new route and out of scope for BETA-129 part 1 to fix.

    it('surfaces a rejected key as VALIDATION_ERROR -> HTTP 400, never 500', async () => {
        // Arrange
        mockListProviderModels.mockRejectedValue(new ListModelsAuthError('openai', 401));

        // Act
        const res = await syncModelsPreview({ providerId: 'openai', plaintextKey: PLAINTEXT_KEY });

        // Assert
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(JSON.stringify(body)).not.toContain(PLAINTEXT_KEY);
    });

    it('never calls the real fetch boundary — only the mocked listProviderModels', async () => {
        // Arrange
        const fetchSpy = vi.spyOn(globalThis, 'fetch');

        // Act
        await syncModelsPreview({ providerId: 'openai', plaintextKey: PLAINTEXT_KEY });

        // Assert
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(mockListProviderModels).toHaveBeenCalledTimes(1);
        fetchSpy.mockRestore();
    });
});
