/**
 * Unit tests for `listProviderModels` (HOS-94, T-003).
 *
 * All provider calls are mocked via `vi.stubGlobal('fetch', ...)` — no
 * network calls, no real API keys, per `ai-core` testing rules.
 *
 * Guarantees:
 * - Parses `data[].id` from the OpenAI/OpenAI-compatible `GET /models` shape.
 * - Handles an empty `data` array.
 * - HTTP 401/403 → `ListModelsAuthError`.
 * - HTTP 429 → `ListModelsRateLimitError`.
 * - HTTP 5xx → `ListModelsUpstreamError`.
 * - A custom `baseURL` is used instead of the OpenAI default.
 * - Malformed entries are skipped with a warning, not thrown.
 * - Unsupported provider families (anthropic/gemini/ollama) throw
 *   `ListModelsUnsupportedProviderError` (dispatch seam for T-004/T-005).
 *
 * AAA pattern: Arrange / Act / Assert.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ListModelsAuthError,
    ListModelsRateLimitError,
    ListModelsUnsupportedProviderError,
    ListModelsUpstreamError,
    listProviderModels,
    resolveProviderFamily
} from '../src/providers/list-models.js';

const TEST_API_KEY = 'sk-test-key-never-logged';

afterEach(() => {
    vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// resolveProviderFamily
// ---------------------------------------------------------------------------

describe('resolveProviderFamily', () => {
    it('should resolve "anthropic" to the anthropic family', () => {
        expect(resolveProviderFamily('anthropic')).toBe('anthropic');
    });

    it('should resolve "google" to the gemini family', () => {
        expect(resolveProviderFamily('google')).toBe('gemini');
    });

    it('should resolve "ollama" to the ollama family', () => {
        expect(resolveProviderFamily('ollama')).toBe('ollama');
    });

    it('should default any other provider id to openai-compatible', () => {
        expect(resolveProviderFamily('openai')).toBe('openai-compatible');
        expect(resolveProviderFamily('groq')).toBe('openai-compatible');
        expect(resolveProviderFamily('deepseek')).toBe('openai-compatible');
        expect(resolveProviderFamily('some-unknown-provider')).toBe('openai-compatible');
    });
});

// ---------------------------------------------------------------------------
// listProviderModels — OpenAI / OpenAI-compatible
// ---------------------------------------------------------------------------

describe('listProviderModels — OpenAI / OpenAI-compatible', () => {
    it('should parse data[].id from a successful response', async () => {
        // Arrange
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }, { id: 'text-embedding-3-small' }]
            })
        });
        vi.stubGlobal('fetch', mockFetch);

        // Act
        const result = await listProviderModels({ providerId: 'openai', apiKey: TEST_API_KEY });

        // Assert
        expect(result.ids).toEqual(['gpt-4o', 'gpt-4o-mini', 'text-embedding-3-small']);
        expect(result.warnings).toBeUndefined();
        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.openai.com/v1/models',
            expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({ Authorization: `Bearer ${TEST_API_KEY}` })
            })
        );
    });

    it('should return an empty ids array when data is empty', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [] })
            })
        );

        // Act
        const result = await listProviderModels({ providerId: 'openai', apiKey: TEST_API_KEY });

        // Assert
        expect(result.ids).toEqual([]);
        expect(result.warnings).toBeUndefined();
    });

    it('should skip entries with a missing or non-string id and add a warning', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [{ id: 'gpt-4o' }, { id: 42 }, {}, { id: 'gpt-4o-mini' }]
                })
            })
        );

        // Act
        const result = await listProviderModels({ providerId: 'openai', apiKey: TEST_API_KEY });

        // Assert
        expect(result.ids).toEqual(['gpt-4o', 'gpt-4o-mini']);
        expect(result.warnings).toHaveLength(2);
    });

    it('should throw ListModelsUpstreamError when the response body has no data array', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => ({ unexpected: true })
            })
        );

        // Act + Assert
        await expect(
            listProviderModels({ providerId: 'openai', apiKey: TEST_API_KEY })
        ).rejects.toThrow(ListModelsUpstreamError);
    });

    it('should throw ListModelsAuthError on HTTP 401', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized'
            })
        );

        // Act + Assert
        const promise = listProviderModels({ providerId: 'openai', apiKey: TEST_API_KEY });
        await expect(promise).rejects.toThrow(ListModelsAuthError);
        await expect(promise).rejects.toMatchObject({
            code: 'LIST_MODELS_AUTH_FAILED',
            providerId: 'openai'
        });
    });

    it('should throw ListModelsAuthError on HTTP 403', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 403,
                statusText: 'Forbidden'
            })
        );

        // Act + Assert
        await expect(
            listProviderModels({ providerId: 'groq', apiKey: TEST_API_KEY })
        ).rejects.toThrow(ListModelsAuthError);
    });

    it('should throw ListModelsRateLimitError on HTTP 429', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests'
            })
        );

        // Act + Assert
        const promise = listProviderModels({ providerId: 'openai', apiKey: TEST_API_KEY });
        await expect(promise).rejects.toThrow(ListModelsRateLimitError);
        await expect(promise).rejects.toMatchObject({ code: 'LIST_MODELS_RATE_LIMITED' });
    });

    it('should throw ListModelsUpstreamError on HTTP 5xx', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 503,
                statusText: 'Service Unavailable'
            })
        );

        // Act + Assert
        const promise = listProviderModels({ providerId: 'openai', apiKey: TEST_API_KEY });
        await expect(promise).rejects.toThrow(ListModelsUpstreamError);
        await expect(promise).rejects.toMatchObject({
            code: 'LIST_MODELS_UPSTREAM_ERROR',
            status: 503
        });
    });

    it('should throw ListModelsUpstreamError when the fetch call itself rejects', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')));

        // Act + Assert
        await expect(
            listProviderModels({ providerId: 'openai', apiKey: TEST_API_KEY })
        ).rejects.toThrow(ListModelsUpstreamError);
    });

    it('should use a custom baseURL for OpenAI-compatible providers', async () => {
        // Arrange
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [{ id: 'llama-3.3-70b' }] })
        });
        vi.stubGlobal('fetch', mockFetch);

        // Act
        const result = await listProviderModels({
            providerId: 'groq',
            apiKey: TEST_API_KEY,
            baseURL: 'https://api.groq.com/openai/v1'
        });

        // Assert
        expect(result.ids).toEqual(['llama-3.3-70b']);
        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.groq.com/openai/v1/models',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('should never include the apiKey anywhere but the Authorization header', async () => {
        // Arrange
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [{ id: 'gpt-4o' }] })
        });
        vi.stubGlobal('fetch', mockFetch);

        // Act
        const result = await listProviderModels({ providerId: 'openai', apiKey: TEST_API_KEY });

        // Assert — the key only ever appears inside the Authorization header value
        expect(JSON.stringify(result)).not.toContain(TEST_API_KEY);
        const [, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = requestInit.headers as Record<string, string>;
        expect(headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`);
    });
});

// ---------------------------------------------------------------------------
// Dispatch seam — unsupported families (T-004 / T-005 slot in here later)
// ---------------------------------------------------------------------------

describe('listProviderModels — dispatch seam for not-yet-implemented families', () => {
    it('should throw ListModelsUnsupportedProviderError for anthropic', async () => {
        await expect(
            listProviderModels({ providerId: 'anthropic', apiKey: TEST_API_KEY })
        ).rejects.toThrow(ListModelsUnsupportedProviderError);
    });

    it('should throw ListModelsUnsupportedProviderError for gemini (google)', async () => {
        await expect(
            listProviderModels({ providerId: 'google', apiKey: TEST_API_KEY })
        ).rejects.toThrow(ListModelsUnsupportedProviderError);
    });

    it('should throw ListModelsUnsupportedProviderError for ollama', async () => {
        await expect(
            listProviderModels({ providerId: 'ollama', apiKey: TEST_API_KEY })
        ).rejects.toThrow(ListModelsUnsupportedProviderError);
    });
});
