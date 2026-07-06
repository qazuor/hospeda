/**
 * Tests for the sync-models orchestration service (HOS-94, T-008).
 *
 * ## Coverage
 *
 * 1. Happy path: decrypt → fetch → filter → merge → result validates against
 *    `AiSyncModelsResultSchema`.
 * 2. `baseURL` from the credential's `metadata` is forwarded to
 *    `listProviderModels`.
 * 3. Fetcher warnings propagate into the service's `warnings` field.
 * 4. No active credential → the vault's own error (`NOT_FOUND`) passes
 *    through unchanged.
 * 5. Fetcher throws `ListModelsAuthError` → mapped to
 *    `ServiceErrorCode.VALIDATION_ERROR` (HTTP 400 — a rejected key is a
 *    client/config error, not a 5xx server fault).
 * 6. Fetcher throws `ListModelsUpstreamError` → mapped to
 *    `ServiceErrorCode.SERVICE_UNAVAILABLE` (the "SYNC_MODELS_FAILED"-style
 *    bucket — see the service's module doc for why no dedicated
 *    `ServiceErrorCode` was added).
 * 7. R-5 secret hygiene: the decrypted API key never appears in the returned
 *    success object nor in any thrown/mapped error's message.
 *
 * @module test/services/ai-sync-models.service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state (vi.hoisted runs before vi.mock factories)
// ---------------------------------------------------------------------------

const {
    mockListProviderModels,
    mockGetDecryptedAiProviderCredential,
    mockApiLogger,
    mockDbSelectLimit
} = vi.hoisted(() => {
    const mockDbSelectLimit = vi.fn().mockResolvedValue([]);
    const mockListProviderModels = vi.fn();
    const mockGetDecryptedAiProviderCredential = vi.fn();
    const mockApiLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
    };

    return {
        mockListProviderModels,
        mockGetDecryptedAiProviderCredential,
        mockApiLogger,
        mockDbSelectLimit
    };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@repo/ai-core', async (importOriginal) => {
    // Keep the real ListModelsError subclasses so `instanceof` checks in the
    // service under test work correctly — only `listProviderModels` itself
    // is replaced with a controllable mock.
    const actual = await importOriginal<typeof import('@repo/ai-core')>();
    return {
        ...actual,
        listProviderModels: mockListProviderModels
    };
});

vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: mockDbSelectLimit
                })
            })
        })
    }),
    aiProviderCredentials: {
        providerId: 'providerId',
        metadata: 'metadata',
        deletedAt: 'deletedAt'
    }
}));

vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        and: vi.fn((...args: unknown[]) => ({ _and: args })),
        eq: vi.fn((col: unknown, val: unknown) => ({ _eq: { col, val } })),
        isNull: vi.fn((col: unknown) => ({ _isNull: col }))
    };
});

vi.mock('../../src/services/ai-credential-vault.service.js', () => ({
    getDecryptedAiProviderCredential: mockGetDecryptedAiProviderCredential
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: mockApiLogger
}));

// ---------------------------------------------------------------------------
// Import SUT (after mocks)
// ---------------------------------------------------------------------------

import { AiProviderModelSchema, AiSyncModelsResultSchema, ServiceErrorCode } from '@repo/schemas';
import { syncAiProviderModels } from '../../src/services/ai-sync-models.service';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const PROVIDER_ID = 'openai';
const PLAINTEXT_KEY = 'sk-live-test-key-do-not-log-or-return';

function resetAllMocks(): void {
    vi.clearAllMocks();

    mockDbSelectLimit.mockResolvedValue([]);

    mockGetDecryptedAiProviderCredential.mockResolvedValue({
        data: { providerId: PROVIDER_ID, plaintextKey: PLAINTEXT_KEY }
    });

    mockListProviderModels.mockResolvedValue({
        ids: ['gpt-4o', 'text-embedding-3-large']
    });
}

beforeEach(() => {
    resetAllMocks();
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncAiProviderModels', () => {
    describe('happy path', () => {
        it('should decrypt, fetch, filter, and merge into a schema-valid result', async () => {
            // Arrange — fixture already set in beforeEach.

            // Act
            const result = await syncAiProviderModels({ providerId: PROVIDER_ID });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();

            const parsed = AiSyncModelsResultSchema.safeParse(result.data);
            expect(parsed.success).toBe(true);

            expect(result.data?.providerId).toBe(PROVIDER_ID);
            // text-embedding-3-large is denylisted by the T-006 filter — must
            // not appear anywhere in the merged output.
            expect(result.data?.models.some((m) => m.id === 'text-embedding-3-large')).toBe(false);
            // gpt-4o is a confident chat match and part of the curated OpenAI
            // catalog — expect it present, annotated 'both'.
            const gpt4o = result.data?.models.find((m) => m.id === 'gpt-4o');
            expect(gpt4o).toBeDefined();
            for (const model of result.data?.models ?? []) {
                expect(AiProviderModelSchema.safeParse(model).success).toBe(true);
            }
        });

        it('should call listProviderModels with the decrypted apiKey and providerId', async () => {
            // Act
            await syncAiProviderModels({ providerId: PROVIDER_ID });

            // Assert
            expect(mockListProviderModels).toHaveBeenCalledWith(
                expect.objectContaining({ providerId: PROVIDER_ID, apiKey: PLAINTEXT_KEY })
            );
        });

        it('should forward metadata.baseURL from the stored credential to listProviderModels', async () => {
            // Arrange
            mockDbSelectLimit.mockResolvedValue([
                { metadata: { baseURL: 'https://custom.example.com/v1' } }
            ]);

            // Act
            await syncAiProviderModels({ providerId: PROVIDER_ID });

            // Assert
            expect(mockListProviderModels).toHaveBeenCalledWith(
                expect.objectContaining({ baseURL: 'https://custom.example.com/v1' })
            );
        });

        it('should omit baseURL from the fetch input when metadata has none', async () => {
            // Arrange — mockDbSelectLimit resolves [] by default (no row).

            // Act
            await syncAiProviderModels({ providerId: PROVIDER_ID });

            // Assert
            const callArgs = mockListProviderModels.mock.calls[0]?.[0];
            expect(callArgs).toBeDefined();
            expect(Object.hasOwn(callArgs, 'baseURL')).toBe(false);
        });

        it('should propagate fetcher warnings into the result', async () => {
            // Arrange
            mockListProviderModels.mockResolvedValue({
                ids: ['gpt-4o'],
                warnings: ['Skipped a model entry with a missing or non-string "id" field.']
            });

            // Act
            const result = await syncAiProviderModels({ providerId: PROVIDER_ID });

            // Assert
            expect(result.data?.warnings).toEqual([
                'Skipped a model entry with a missing or non-string "id" field.'
            ]);
        });

        it('should omit warnings from the result when the fetcher reports none', async () => {
            // Act
            const result = await syncAiProviderModels({ providerId: PROVIDER_ID });

            // Assert
            expect(result.data?.warnings).toBeUndefined();
        });
    });

    describe('no active credential', () => {
        it('should pass through the vault NOT_FOUND error unchanged', async () => {
            // Arrange
            mockGetDecryptedAiProviderCredential.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: `No active credential found for provider '${PROVIDER_ID}'`
                }
            });

            // Act
            const result = await syncAiProviderModels({ providerId: PROVIDER_ID });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(mockListProviderModels).not.toHaveBeenCalled();
        });
    });

    describe('fetcher failures', () => {
        it('should map an auth error (invalid/expired key) to VALIDATION_ERROR (HTTP 400)', async () => {
            // Arrange
            const { ListModelsAuthError } = await import('@repo/ai-core');
            mockListProviderModels.mockRejectedValue(new ListModelsAuthError(PROVIDER_ID, 401));

            // Act
            const result = await syncAiProviderModels({ providerId: PROVIDER_ID });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).not.toContain(PLAINTEXT_KEY);
        });

        it('should map an upstream failure to SERVICE_UNAVAILABLE (SYNC_MODELS_FAILED-style)', async () => {
            // Arrange
            const { ListModelsUpstreamError } = await import('@repo/ai-core');
            mockListProviderModels.mockRejectedValue(
                new ListModelsUpstreamError(PROVIDER_ID, 500, 'HTTP 500 Internal Server Error')
            );

            // Act
            const result = await syncAiProviderModels({ providerId: PROVIDER_ID });

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
            expect(result.error?.message).not.toContain(PLAINTEXT_KEY);
        });

        it('should map a rate-limit failure to SERVICE_UNAVAILABLE', async () => {
            // Arrange
            const { ListModelsRateLimitError } = await import('@repo/ai-core');
            mockListProviderModels.mockRejectedValue(new ListModelsRateLimitError(PROVIDER_ID));

            // Act
            const result = await syncAiProviderModels({ providerId: PROVIDER_ID });

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
        });

        it('should map an unexpected non-ListModelsError to INTERNAL_ERROR', async () => {
            // Arrange
            mockListProviderModels.mockRejectedValue(new Error('totally unexpected'));

            // Act
            const result = await syncAiProviderModels({ providerId: PROVIDER_ID });

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        });
    });

    describe('secret hygiene (R-5)', () => {
        it('should never include the plaintext apiKey in the success result', async () => {
            // Act
            const result = await syncAiProviderModels({ providerId: PROVIDER_ID });

            // Assert
            const serialized = JSON.stringify(result);
            expect(serialized).not.toContain(PLAINTEXT_KEY);
        });

        it('should never log the plaintext apiKey on any logger call', async () => {
            // Arrange
            const { ListModelsAuthError } = await import('@repo/ai-core');
            mockListProviderModels.mockRejectedValue(new ListModelsAuthError(PROVIDER_ID, 401));

            // Act
            await syncAiProviderModels({ providerId: PROVIDER_ID });

            // Assert
            const allCalls = [
                ...mockApiLogger.info.mock.calls,
                ...mockApiLogger.warn.mock.calls,
                ...mockApiLogger.debug.mock.calls,
                ...mockApiLogger.error.mock.calls
            ];
            const serializedCalls = JSON.stringify(allCalls);
            expect(serializedCalls).not.toContain(PLAINTEXT_KEY);
        });
    });
});
