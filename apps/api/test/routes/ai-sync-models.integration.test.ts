/**
 * E2E integration tests for the HOS-94 admin model-sync endpoint (T-013).
 *
 * Exercises `POST /api/v1/admin/ai/credentials/{providerId}/sync-models`
 * end-to-end through `initApp()` + `app.request()` — the real route, the
 * real `syncAiProviderModels` orchestration service, the real
 * `filterChatCapableModels` (T-006) classifier, and the real
 * `mergeDetectedAndCuratedModels` (T-007) merge all run unmocked. Only the
 * two outbound boundaries are mocked:
 *
 * - `listProviderModels` (`@repo/ai-core`) — the plain-`fetch` per-provider
 *   list-models dispatcher. Mocked to return controllable raw model id
 *   lists (or to throw a `ListModelsAuthError` for the bad-key case),
 *   matching the pattern of `test/services/ai-sync-models.service.test.ts`.
 * - `getDecryptedAiProviderCredential` (`ai-credential-vault.service.ts`) —
 *   avoids exercising real AES-GCM decryption / a real Postgres row; returns
 *   a controllable plaintext key (or the vault's own `NOT_FOUND`/error shape
 *   when relevant).
 * - `getDb` (`@repo/db`) — the service's own `getCredentialBaseUrl()` helper
 *   reads `metadata.baseURL` via a direct `db.select(...)` (see the module
 *   doc in `ai-sync-models.service.ts` — `getDecryptedAiProviderCredential`
 *   does not expose metadata). This is reconfigured per-test via
 *   `vi.mocked(getDb).mockReturnValue(...)` (same technique as
 *   `test/routes/billing/admin/subscription-promo-effect.test.ts`) so the
 *   rest of the global `@repo/db` mock (`test/setup.ts` /
 *   `test/helpers/mocks/db-mock.ts`, needed by `initApp()`'s other
 *   module-scope model instantiations) stays intact.
 *
 * No real network call is made anywhere in this file.
 *
 * @module test/routes/ai-sync-models.integration
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state (vi.hoisted runs before vi.mock factories)
// ---------------------------------------------------------------------------

const { mockListProviderModels, mockGetDecryptedAiProviderCredential } = vi.hoisted(() => ({
    mockListProviderModels: vi.fn(),
    mockGetDecryptedAiProviderCredential: vi.fn()
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

// Whole-module mock: the credentials route also imports
// create/rotate/delete/list functions from this module, but none of those
// routes are exercised here, so leaving them undefined is safe (matches
// `test/services/ai-sync-models.service.test.ts`).
vi.mock('../../src/services/ai-credential-vault.service.js', () => ({
    getDecryptedAiProviderCredential: mockGetDecryptedAiProviderCredential
}));

// `@repo/db` is already mocked globally (`test/setup.ts` -> `createDbMock()`),
// which every other module-scope model instantiation reached by `initApp()`
// depends on. That global mock does NOT export `aiProviderCredentials`
// though (it is only needed by this HOS-94 feature), and
// `ai-sync-models.service.ts`'s `getCredentialBaseUrl()` reads
// `aiProviderCredentials.metadata` directly at the top of its query — an
// `undefined` export there throws before the mocked `getDb()` chain is even
// reached. So this file re-derives the SAME base mock and adds the missing
// table export, keeping every other export intact for `initApp()`.
vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock.js');
    return {
        ...createDbMock(),
        aiProviderCredentials: {
            providerId: 'providerId',
            metadata: 'metadata',
            deletedAt: 'deletedAt'
        }
    };
});

// The global `test/setup.ts` mock of `@repo/service-core` substitutes
// `ServiceError` with an unrelated local class (`test/helpers/mocks/
// content-services.ts`), while `apps/api/src/utils/response-helpers.ts`
// (the route factory's error handler) imports the REAL `ServiceError` from
// `@repo/service-core/types` (a separate specifier the global mock does not
// touch). Under the global mock alone, a `ServiceError` thrown by this
// route (which imports `ServiceError` from the bare `@repo/service-core`
// specifier, per `routes/ai/credentials/index.ts`) fails the handler's
// `instanceof ServiceError` check and is misreported as a generic 500. This
// local override reverts `@repo/service-core` to its real implementation for
// this file only, so `ServiceError` is the same class on both sides of the
// check and the route's actual VALIDATION_ERROR -> 400 mapping is exercised
// for real (this is a test-infrastructure-only fix; no production file is
// changed).
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ListModelsAuthError } from '@repo/ai-core';
import { getDb } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const mockGetDb = vi.mocked(getDb);

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const ADMIN_ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAINTEXT_KEY = 'sk-test-key-do-not-log-or-return';

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

/** POSTs to the sync-models endpoint for the given provider. */
function syncModels(providerId: string) {
    return app.request(`/api/v1/admin/ai/credentials/${providerId}/sync-models`, {
        method: 'POST',
        headers: adminHeaders()
    });
}

/**
 * Configures `getDb().select({...}).from(...).where(...).limit(1)` to
 * resolve with a single credential row exposing the given `metadata`
 * (or no row at all when `metadata` is omitted, matching a credential with
 * no stored `baseURL`).
 */
function mockCredentialMetadataRow(metadata?: Record<string, unknown>): void {
    const rows = metadata === undefined ? [] : [{ metadata }];
    const chain = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(rows)
    };
    mockGetDb.mockReturnValue({
        select: vi.fn(() => chain)
    } as unknown as ReturnType<typeof getDb>);
}

// A single active credential is assumed for every provider under test.
function mockActiveCredential(): void {
    mockGetDecryptedAiProviderCredential.mockResolvedValue({
        data: { providerId: 'unused-by-caller', plaintextKey: PLAINTEXT_KEY }
    });
}

let app: AppOpenAPI;

describe('POST /api/v1/admin/ai/credentials/{providerId}/sync-models (HOS-94 T-013)', () => {
    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockActiveCredential();
        mockCredentialMetadataRow(); // no baseURL by default
    });

    // -------------------------------------------------------------------------
    // Per-provider fixtures
    // -------------------------------------------------------------------------

    describe('per-provider detection', () => {
        it('OpenAI: filters denylisted ids and merges with the curated catalog', async () => {
            // Arrange — curated OpenAI models: gpt-4o, gpt-4o-mini, gpt-4.1,
            // gpt-4.1-mini, o3-mini (packages/schemas ai-provider-catalog.ts).
            // 'zzz-mystery-model-2099' matches neither the denylist nor the
            // chat allowlist, landing in the "uncertain" bucket (OQ-1).
            mockListProviderModels.mockResolvedValue({
                ids: [
                    'gpt-4o',
                    'gpt-4o-mini',
                    'text-embedding-3-large',
                    'whisper-1',
                    'zzz-mystery-model-2099'
                ]
            });

            // Act
            const res = await syncModels('openai');

            // Assert — action-POST routes default to 201 (route-factory.ts).
            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.data.providerId).toBe('openai');

            const ids = (body.data.models as Array<{ id: string }>).map((m) => m.id);
            // Denylisted ids never appear in the merged result...
            expect(ids).not.toContain('text-embedding-3-large');
            expect(ids).not.toContain('whisper-1');
            // ...and are surfaced separately in hiddenModelIds.
            expect(body.data.hiddenModelIds).toEqual(
                expect.arrayContaining(['text-embedding-3-large', 'whisper-1'])
            );

            expect(body.data.models).toEqual(
                expect.arrayContaining([
                    { id: 'gpt-4o', source: 'both' },
                    { id: 'gpt-4o-mini', source: 'both' },
                    { id: 'gpt-4.1', source: 'curated' },
                    { id: 'gpt-4.1-mini', source: 'curated' },
                    { id: 'o3-mini', source: 'curated' },
                    {
                        id: 'zzz-mystery-model-2099',
                        source: 'detected',
                        capabilityHint: 'uncertain'
                    }
                ])
            );
        });

        it('Anthropic: merges detected Claude models with the curated catalog', async () => {
            // Arrange — curated Anthropic models: claude-sonnet-4-20250514,
            // claude-3-5-haiku-20241022, claude-3-opus-20240229.
            mockListProviderModels.mockResolvedValue({
                ids: [
                    'claude-3-5-haiku-20241022',
                    'claude-3-5-embedding-test',
                    'claude-4-new-preview'
                ]
            });

            // Act
            const res = await syncModels('anthropic');

            // Assert
            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.data.providerId).toBe('anthropic');

            const ids = (body.data.models as Array<{ id: string }>).map((m) => m.id);
            expect(ids).not.toContain('claude-3-5-embedding-test');
            expect(body.data.hiddenModelIds).toEqual(['claude-3-5-embedding-test']);

            expect(body.data.models).toEqual(
                expect.arrayContaining([
                    { id: 'claude-sonnet-4-20250514', source: 'curated' },
                    { id: 'claude-3-5-haiku-20241022', source: 'both' },
                    { id: 'claude-3-opus-20240229', source: 'curated' },
                    // Confidently matches the claude- allowlist, so no
                    // capabilityHint ('uncertain') is attached.
                    { id: 'claude-4-new-preview', source: 'detected' }
                ])
            );
        });

        it('Google Gemini: merges detected Gemini models with the curated catalog', async () => {
            // Arrange — curated Google models: gemini-2.5-pro, gemini-2.5-flash,
            // gemini-2.0-flash.
            mockListProviderModels.mockResolvedValue({
                ids: ['gemini-2.5-flash', 'gemini-embedding-001', 'gemini-3.0-experimental']
            });

            // Act
            const res = await syncModels('google');

            // Assert
            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.data.providerId).toBe('google');

            const ids = (body.data.models as Array<{ id: string }>).map((m) => m.id);
            expect(ids).not.toContain('gemini-embedding-001');
            expect(body.data.hiddenModelIds).toEqual(['gemini-embedding-001']);

            expect(body.data.models).toEqual(
                expect.arrayContaining([
                    { id: 'gemini-2.5-pro', source: 'curated' },
                    { id: 'gemini-2.5-flash', source: 'both' },
                    { id: 'gemini-2.0-flash', source: 'curated' },
                    { id: 'gemini-3.0-experimental', source: 'detected' }
                ])
            );
        });

        it('Ollama: forwards metadata.baseURL and surfaces an uncertain custom model', async () => {
            // Arrange — curated Ollama models: llama3, mistral, codellama, qwen2.5.
            // Ollama is self-hosted: baseURL is required and comes from the
            // credential's stored metadata (getCredentialBaseUrl).
            mockCredentialMetadataRow({ baseURL: 'http://localhost:11434' });
            mockListProviderModels.mockResolvedValue({
                ids: ['llama3', 'whisper-ggml', 'my-custom-finetune']
            });

            // Act
            const res = await syncModels('ollama');

            // Assert
            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.data.providerId).toBe('ollama');

            expect(mockListProviderModels).toHaveBeenCalledWith(
                expect.objectContaining({
                    providerId: 'ollama',
                    apiKey: PLAINTEXT_KEY,
                    baseURL: 'http://localhost:11434'
                })
            );

            const ids = (body.data.models as Array<{ id: string }>).map((m) => m.id);
            expect(ids).not.toContain('whisper-ggml');
            expect(body.data.hiddenModelIds).toEqual(['whisper-ggml']);

            expect(body.data.models).toEqual(
                expect.arrayContaining([
                    { id: 'llama3', source: 'both' },
                    { id: 'mistral', source: 'curated' },
                    { id: 'codellama', source: 'curated' },
                    { id: 'qwen2.5', source: 'curated' },
                    // Matches neither the denylist nor the chat allowlist ->
                    // kept (not dropped) and flagged uncertain (OQ-1).
                    { id: 'my-custom-finetune', source: 'detected', capabilityHint: 'uncertain' }
                ])
            );
        });

        it('OpenAI-compatible provider: forwards a custom metadata.baseURL, all-detected merge', async () => {
            // Arrange — a fully custom provider id, not part of KNOWN_PROVIDERS,
            // configured with a custom baseURL (metadata.baseURL). Per the
            // merge's documented behavior, an unknown providerId has an empty
            // curated list, so every surfaced model is source: 'detected'.
            mockCredentialMetadataRow({ baseURL: 'https://custom-llm.example.com/v1' });
            mockListProviderModels.mockResolvedValue({
                ids: ['custom-chat-model-v1', 'custom-embedding-model']
            });

            // Act
            const res = await syncModels('my-custom-llm');

            // Assert
            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.data.providerId).toBe('my-custom-llm');

            expect(mockListProviderModels).toHaveBeenCalledWith(
                expect.objectContaining({
                    providerId: 'my-custom-llm',
                    apiKey: PLAINTEXT_KEY,
                    baseURL: 'https://custom-llm.example.com/v1'
                })
            );

            const ids = (body.data.models as Array<{ id: string }>).map((m) => m.id);
            expect(ids).not.toContain('custom-embedding-model');
            expect(body.data.hiddenModelIds).toEqual(['custom-embedding-model']);
            expect(body.data.models).toEqual([
                {
                    id: 'custom-chat-model-v1',
                    source: 'detected',
                    capabilityHint: 'uncertain'
                }
            ]);
        });
    });

    // -------------------------------------------------------------------------
    // Fail-open / bad-key
    // -------------------------------------------------------------------------

    describe('bad key (fail-open contract)', () => {
        it('surfaces a rejected credential as VALIDATION_ERROR -> HTTP 400, never 500', async () => {
            // Arrange
            mockListProviderModels.mockRejectedValue(new ListModelsAuthError('openai', 401));

            // Act
            const res = await syncModels('openai');

            // Assert
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('VALIDATION_ERROR');
            // The plaintext key must never leak into the error response.
            expect(JSON.stringify(body)).not.toContain(PLAINTEXT_KEY);
        });
    });

    // -------------------------------------------------------------------------
    // No real network call
    // -------------------------------------------------------------------------

    describe('boundary isolation', () => {
        it('never calls the real fetch boundary — only the mocked listProviderModels', async () => {
            // Arrange
            const fetchSpy = vi.spyOn(globalThis, 'fetch');
            mockListProviderModels.mockResolvedValue({ ids: ['gpt-4o'] });

            // Act
            await syncModels('openai');

            // Assert
            expect(fetchSpy).not.toHaveBeenCalled();
            expect(mockListProviderModels).toHaveBeenCalledTimes(1);
            fetchSpy.mockRestore();
        });
    });
});
