import { describe, expect, it, vi } from 'vitest';
import {
    ProviderError,
    ProviderRateLimitedError,
    ProviderTimeoutError
} from '../../src/engine/provider.js';
import { OpenAIProvider } from '../../src/providers/openai.provider.js';

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
});
