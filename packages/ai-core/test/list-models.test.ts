/**
 * Unit tests for `listProviderModels` (HOS-94, T-003/T-004/T-005).
 *
 * All provider calls are mocked via `vi.stubGlobal('fetch', ...)` — no
 * network calls, no real API keys, per `ai-core` testing rules.
 *
 * Guarantees:
 * - OpenAI/OpenAI-compatible: parses `data[].id`, handles an empty `data`
 *   array, HTTP 401/403 → `ListModelsAuthError`, HTTP 429 →
 *   `ListModelsRateLimitError`, HTTP 5xx → `ListModelsUpstreamError`, a
 *   custom `baseURL` is used instead of the OpenAI default, malformed
 *   entries are skipped with a warning.
 * - Anthropic: parses `data[].id`, sends `x-api-key` + `anthropic-version`
 *   headers to the fixed `https://api.anthropic.com/v1/models` URL.
 * - Gemini: parses `models[].name`, strips the `models/` prefix, sends the
 *   API key as a `?key=` query parameter (no auth header) to the fixed
 *   `.../v1beta/models` URL.
 * - Ollama: parses `models[].name` from `{baseURL}/api/tags`, no auth
 *   header, and requires a `baseURL` (throws when absent).
 * - OQ-5 path convention: each family resolves to the documented URL shape.
 *
 * AAA pattern: Arrange / Act / Assert.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ListModelsAuthError,
    ListModelsRateLimitError,
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
// listProviderModels — Anthropic (T-004)
// ---------------------------------------------------------------------------

describe('listProviderModels — Anthropic', () => {
    it('should parse data[].id and send x-api-key + anthropic-version headers', async () => {
        // Arrange
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: [{ id: 'claude-3-5-sonnet-20241022' }, { id: 'claude-3-opus-20240229' }]
            })
        });
        vi.stubGlobal('fetch', mockFetch);

        // Act
        const result = await listProviderModels({ providerId: 'anthropic', apiKey: TEST_API_KEY });

        // Assert
        expect(result.ids).toEqual(['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229']);
        expect(result.warnings).toBeUndefined();
        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.anthropic.com/v1/models',
            expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({
                    'x-api-key': TEST_API_KEY,
                    'anthropic-version': expect.any(String)
                })
            })
        );
    });

    it('should skip entries with a missing or non-string id and add a warning', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: [{ id: 'claude-3-5-sonnet-20241022' }, { id: 7 }, {}] })
            })
        );

        // Act
        const result = await listProviderModels({ providerId: 'anthropic', apiKey: TEST_API_KEY });

        // Assert
        expect(result.ids).toEqual(['claude-3-5-sonnet-20241022']);
        expect(result.warnings).toHaveLength(2);
    });

    it('should throw ListModelsAuthError on HTTP 401', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })
        );

        // Act + Assert
        const promise = listProviderModels({ providerId: 'anthropic', apiKey: TEST_API_KEY });
        await expect(promise).rejects.toThrow(ListModelsAuthError);
        await expect(promise).rejects.toMatchObject({
            code: 'LIST_MODELS_AUTH_FAILED',
            providerId: 'anthropic'
        });
    });

    it('should throw ListModelsRateLimitError on HTTP 429', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' })
        );

        // Act + Assert
        await expect(
            listProviderModels({ providerId: 'anthropic', apiKey: TEST_API_KEY })
        ).rejects.toThrow(ListModelsRateLimitError);
    });

    it('should throw ListModelsUpstreamError when the response body has no data array', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ unexpected: true }) })
        );

        // Act + Assert
        await expect(
            listProviderModels({ providerId: 'anthropic', apiKey: TEST_API_KEY })
        ).rejects.toThrow(ListModelsUpstreamError);
    });

    it('should never include the apiKey anywhere but the x-api-key header', async () => {
        // Arrange
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [{ id: 'claude-3-5-sonnet-20241022' }] })
        });
        vi.stubGlobal('fetch', mockFetch);

        // Act
        const result = await listProviderModels({ providerId: 'anthropic', apiKey: TEST_API_KEY });

        // Assert
        expect(JSON.stringify(result)).not.toContain(TEST_API_KEY);
        const [, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = requestInit.headers as Record<string, string>;
        expect(headers['x-api-key']).toBe(TEST_API_KEY);
    });
});

// ---------------------------------------------------------------------------
// listProviderModels — Google Gemini (T-005)
// ---------------------------------------------------------------------------

describe('listProviderModels — Gemini', () => {
    it('should parse models[].name, strip the models/ prefix, and pass the key as a query param', async () => {
        // Arrange
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                models: [{ name: 'models/gemini-1.5-pro' }, { name: 'models/gemini-1.5-flash' }]
            })
        });
        vi.stubGlobal('fetch', mockFetch);

        // Act
        const result = await listProviderModels({ providerId: 'google', apiKey: TEST_API_KEY });

        // Assert
        expect(result.ids).toEqual(['gemini-1.5-pro', 'gemini-1.5-flash']);
        expect(result.warnings).toBeUndefined();
        expect(mockFetch).toHaveBeenCalledWith(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${TEST_API_KEY}`,
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('should not send an Authorization or x-api-key header', async () => {
        // Arrange
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ models: [{ name: 'models/gemini-1.5-pro' }] })
        });
        vi.stubGlobal('fetch', mockFetch);

        // Act
        await listProviderModels({ providerId: 'google', apiKey: TEST_API_KEY });

        // Assert
        const [, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit | undefined];
        const headers = (requestInit?.headers ?? {}) as Record<string, string>;
        expect(headers.Authorization).toBeUndefined();
        expect(headers['x-api-key']).toBeUndefined();
    });

    it('should leave a name without the models/ prefix unchanged', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => ({ models: [{ name: 'gemini-1.5-pro' }] })
            })
        );

        // Act
        const result = await listProviderModels({ providerId: 'google', apiKey: TEST_API_KEY });

        // Assert
        expect(result.ids).toEqual(['gemini-1.5-pro']);
    });

    it('should skip entries with a missing or non-string name and add a warning', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => ({ models: [{ name: 'models/gemini-1.5-pro' }, { name: 3 }, {}] })
            })
        );

        // Act
        const result = await listProviderModels({ providerId: 'google', apiKey: TEST_API_KEY });

        // Assert
        expect(result.ids).toEqual(['gemini-1.5-pro']);
        expect(result.warnings).toHaveLength(2);
    });

    it('should throw ListModelsAuthError on HTTP 403', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' })
        );

        // Act + Assert
        await expect(
            listProviderModels({ providerId: 'google', apiKey: TEST_API_KEY })
        ).rejects.toThrow(ListModelsAuthError);
    });

    it('should throw ListModelsUpstreamError when the response body has no models array', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ unexpected: true }) })
        );

        // Act + Assert
        await expect(
            listProviderModels({ providerId: 'google', apiKey: TEST_API_KEY })
        ).rejects.toThrow(ListModelsUpstreamError);
    });
});

// ---------------------------------------------------------------------------
// listProviderModels — Ollama (T-005)
// ---------------------------------------------------------------------------

describe('listProviderModels — Ollama', () => {
    it('should parse models[].name from {baseURL}/api/tags with no auth header', async () => {
        // Arrange
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ models: [{ name: 'llama3.2' }, { name: 'mistral' }] })
        });
        vi.stubGlobal('fetch', mockFetch);

        // Act
        const result = await listProviderModels({
            providerId: 'ollama',
            apiKey: TEST_API_KEY,
            baseURL: 'http://localhost:11434'
        });

        // Assert
        expect(result.ids).toEqual(['llama3.2', 'mistral']);
        expect(mockFetch).toHaveBeenCalledWith(
            'http://localhost:11434/api/tags',
            expect.objectContaining({ method: 'GET' })
        );
        const [, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit | undefined];
        const headers = (requestInit?.headers ?? {}) as Record<string, string>;
        expect(headers.Authorization).toBeUndefined();
    });

    it('should throw ListModelsUpstreamError when no baseURL is provided', async () => {
        // Arrange
        const mockFetch = vi.fn();
        vi.stubGlobal('fetch', mockFetch);

        // Act + Assert
        await expect(
            listProviderModels({ providerId: 'ollama', apiKey: TEST_API_KEY })
        ).rejects.toThrow(ListModelsUpstreamError);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip entries with a missing or non-string name and add a warning', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => ({ models: [{ name: 'llama3.2' }, { name: 9 }, {}] })
            })
        );

        // Act
        const result = await listProviderModels({
            providerId: 'ollama',
            apiKey: TEST_API_KEY,
            baseURL: 'http://localhost:11434'
        });

        // Assert
        expect(result.ids).toEqual(['llama3.2']);
        expect(result.warnings).toHaveLength(2);
    });

    it('should throw ListModelsUpstreamError when the response body has no models array', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ unexpected: true }) })
        );

        // Act + Assert
        await expect(
            listProviderModels({
                providerId: 'ollama',
                apiKey: TEST_API_KEY,
                baseURL: 'http://localhost:11434'
            })
        ).rejects.toThrow(ListModelsUpstreamError);
    });

    it('should propagate a 5xx from the Ollama server as ListModelsUpstreamError', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            })
        );

        // Act + Assert
        await expect(
            listProviderModels({
                providerId: 'ollama',
                apiKey: TEST_API_KEY,
                baseURL: 'http://localhost:11434'
            })
        ).rejects.toThrow(ListModelsUpstreamError);
    });
});

// ---------------------------------------------------------------------------
// OQ-5 — per-provider path convention
// ---------------------------------------------------------------------------

describe('listProviderModels — OQ-5 per-provider path convention', () => {
    it('should resolve openai-compatible to {baseURL ?? default}/models', async () => {
        // Arrange
        const mockFetch = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
        vi.stubGlobal('fetch', mockFetch);

        // Act
        await listProviderModels({ providerId: 'openai', apiKey: TEST_API_KEY });

        // Assert
        expect(mockFetch.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/models');
    });

    it('should resolve anthropic to the fixed /v1/models URL regardless of baseURL', async () => {
        // Arrange
        const mockFetch = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
        vi.stubGlobal('fetch', mockFetch);

        // Act — a baseURL is supplied but must be ignored for this family
        await listProviderModels({
            providerId: 'anthropic',
            apiKey: TEST_API_KEY,
            baseURL: 'https://should-be-ignored.example.com'
        });

        // Assert
        expect(mockFetch.mock.calls[0]?.[0]).toBe('https://api.anthropic.com/v1/models');
    });

    it('should resolve gemini to the fixed /v1beta/models URL regardless of baseURL', async () => {
        // Arrange
        const mockFetch = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) });
        vi.stubGlobal('fetch', mockFetch);

        // Act
        await listProviderModels({
            providerId: 'google',
            apiKey: TEST_API_KEY,
            baseURL: 'https://should-be-ignored.example.com'
        });

        // Assert
        expect(mockFetch.mock.calls[0]?.[0]).toBe(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${TEST_API_KEY}`
        );
    });

    it('should resolve ollama to {baseURL}/api/tags', async () => {
        // Arrange
        const mockFetch = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [] }) });
        vi.stubGlobal('fetch', mockFetch);

        // Act
        await listProviderModels({
            providerId: 'ollama',
            apiKey: TEST_API_KEY,
            baseURL: 'http://localhost:11434'
        });

        // Assert
        expect(mockFetch.mock.calls[0]?.[0]).toBe('http://localhost:11434/api/tags');
    });
});
