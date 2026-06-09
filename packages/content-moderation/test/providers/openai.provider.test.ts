import { describe, expect, it, vi } from 'vitest';
import {
    ProviderError,
    ProviderRateLimitedError,
    ProviderTimeoutError
} from '../../src/engine/provider.js';
import { OpenAIProvider } from '../../src/providers/openai.provider.js';

const MAX_OPENAI_INPUT_CHARS = 20_000;

describe('OpenAIProvider', () => {
    it('maps OpenAI category scores into the frozen moderation categories', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                results: [
                    {
                        category_scores: {
                            harassment: 0.8,
                            hate: 0.2,
                            'self-harm': 0.4,
                            violence: 0.1
                        }
                    }
                ]
            })
        });

        const provider = new OpenAIProvider({ apiKey: 'key', timeoutMs: 1500, fetchImpl });
        const result = await provider.classify({ text: 'test' });

        expect(result.source).toBe('openai');
        expect(result.score).toBe(0.8);
        expect(result.categories.harassment).toBe(0.8);
        expect(result.categories.hate).toBe(0.2);
        expect(result.categories.other).toBe(0.4);
    });

    it('throws ProviderRateLimitedError on 429 responses', async () => {
        const provider = new OpenAIProvider({
            apiKey: 'key',
            timeoutMs: 1500,
            fetchImpl: vi
                .fn()
                .mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch
        });

        await expect(provider.classify({ text: 'test' })).rejects.toBeInstanceOf(
            ProviderRateLimitedError
        );
    });

    it('throws ProviderTimeoutError when the request aborts', async () => {
        const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
            init?.signal?.throwIfAborted?.();
            throw new DOMException('Aborted', 'AbortError');
        });

        const provider = new OpenAIProvider({ apiKey: 'key', timeoutMs: 1, fetchImpl });

        await expect(provider.classify({ text: 'test' })).rejects.toBeInstanceOf(
            ProviderTimeoutError
        );
    });

    it('throws ProviderError on non-429 upstream failures', async () => {
        const provider = new OpenAIProvider({
            apiKey: 'key',
            timeoutMs: 1500,
            fetchImpl: vi
                .fn()
                .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch
        });

        await expect(provider.classify({ text: 'test' })).rejects.toBeInstanceOf(ProviderError);
    });

    it('truncates oversized input to MAX_OPENAI_INPUT_CHARS before sending to the API', async () => {
        // Arrange — text that exceeds the cap by 5 chars.
        const oversizedText = 'a'.repeat(MAX_OPENAI_INPUT_CHARS + 5);

        let capturedBody: string | undefined;
        const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
            capturedBody = init?.body as string;
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    results: [{ category_scores: {} }]
                })
            };
        });

        const provider = new OpenAIProvider({ apiKey: 'key', timeoutMs: 1500, fetchImpl });

        await provider.classify({ text: oversizedText });

        // Assert — the body sent must contain the truncated text (not the full one).
        expect(capturedBody).toBeDefined();
        const parsed = JSON.parse(capturedBody ?? '{}') as { input?: string };
        expect(parsed.input?.length).toBe(MAX_OPENAI_INPUT_CHARS);
    });
});
