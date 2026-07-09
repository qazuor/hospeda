/**
 * @file client.test.ts
 * @description Tests for the centralized API client's request timeout handling.
 *
 * Covers:
 *  - Default request timeout (10s) aborts a slow response with a 408 error.
 *  - Per-request `timeoutMs` override (BETA-135) lets a call exceed the
 *    default 10s budget without aborting — used by the AI translate endpoint.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
    getApiUrl: vi.fn(() => 'http://api.test'),
    getInternalApiUrl: vi.fn(() => undefined),
    getInternalRequestSecret: vi.fn(() => undefined)
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mock `fetch` that resolves after `delayMs` unless aborted first, mirroring
 * the real `fetch` contract of rejecting with an `AbortError` when the
 * request's `AbortSignal` fires before the response is ready.
 */
function mockDelayedFetch(delayMs: number) {
    return vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                resolve({
                    ok: true,
                    json: async () => ({ success: true, data: { done: true } })
                } as Response);
            }, delayMs);

            init?.signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
            });
        });
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('apiClient request timeout', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('aborts with a 408 timeout error after the default 10s budget', async () => {
        const { apiClient } = await import('@/lib/api/client');
        global.fetch = mockDelayedFetch(15_000);

        const resultPromise = apiClient.postProtected({
            path: '/api/v1/protected/example',
            body: {}
        });

        // Advance past the default 10s timeout — the abort should fire and
        // reject the in-flight fetch.
        await vi.advanceTimersByTimeAsync(11_000);

        const result = await resultPromise;

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.status).toBe(408);
            expect(result.error.message).toBe('Request timeout after 10000ms');
        }
    });

    it('honors a per-request timeoutMs override and does not abort a slow response', async () => {
        const { apiClient } = await import('@/lib/api/client');
        global.fetch = mockDelayedFetch(15_000);

        // BETA-135: AI translate legitimately takes longer than the default
        // 10s budget — the override must let it complete undisturbed.
        const resultPromise = apiClient.postProtected({
            path: '/api/v1/protected/ai/translate',
            body: {},
            timeoutMs: 90_000
        });

        // Advance well past the DEFAULT 10s timeout but before the response
        // resolves at 15s — the request must still be in flight, not aborted.
        await vi.advanceTimersByTimeAsync(15_000);

        const result = await resultPromise;

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data).toEqual({ done: true });
        }
    });
});
