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

// ---------------------------------------------------------------------------
// HOS-605: X-Client-Locale header
// ---------------------------------------------------------------------------

describe('apiClient X-Client-Locale header (HOS-605)', () => {
    const originalPathname = window.location.pathname;

    function setPathname(pathname: string) {
        window.history.replaceState({}, '', pathname);
    }

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        setPathname(originalPathname);
    });

    /** Mock `fetch` that resolves immediately and records the request init. */
    function mockOkFetch() {
        const fetchMock = vi.fn((_url: string, _init?: RequestInit) => {
            return Promise.resolve({
                ok: true,
                json: async () => ({ success: true, data: { done: true } })
            } as Response);
        });
        return fetchMock;
    }

    it('sends X-Client-Locale from the current path on a browser-initiated request', async () => {
        setPathname('/es/mi-cuenta/addons/');
        const { apiClient } = await import('@/lib/api/client');
        const fetchMock = mockOkFetch();
        global.fetch = fetchMock;

        await apiClient.postProtected({ path: '/api/v1/protected/billing/addons/x/purchase' });

        const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const headers = init.headers as Record<string, string>;
        expect(headers['X-Client-Locale']).toBe('es');
    });

    it('reflects a different locale segment (en)', async () => {
        setPathname('/en/mi-cuenta/addons/');
        const { apiClient } = await import('@/lib/api/client');
        const fetchMock = mockOkFetch();
        global.fetch = fetchMock;

        await apiClient.postProtected({ path: '/api/v1/protected/billing/addons/x/purchase' });

        const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const headers = init.headers as Record<string, string>;
        expect(headers['X-Client-Locale']).toBe('en');
    });

    it('omits the header when the path has no valid locale segment', async () => {
        setPathname('/some-non-locale-path/');
        const { apiClient } = await import('@/lib/api/client');
        const fetchMock = mockOkFetch();
        global.fetch = fetchMock;

        await apiClient.postProtected({ path: '/api/v1/protected/billing/addons/x/purchase' });

        const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const headers = init.headers as Record<string, string>;
        expect(headers['X-Client-Locale']).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// HOS-2009: surfacing the API's `Cache-Control: no-store` on a successful read
// ---------------------------------------------------------------------------

describe('apiClient degraded flag (HOS-2009)', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    function mockJsonFetch({ cacheControl }: { readonly cacheControl?: string }) {
        return vi.fn(async () => ({
            ok: true,
            status: 200,
            headers: new Headers(cacheControl ? { 'Cache-Control': cacheControl } : {}),
            json: async () => ({ success: true, data: { id: 'v1' } })
        })) as unknown as typeof fetch;
    }

    it('flags a 2xx answer carrying no-store as degraded', async () => {
        const { apiClient } = await import('@/lib/api/client');
        global.fetch = mockJsonFetch({ cacheControl: 'no-store' });

        const result = await apiClient.get({ path: '/api/v1/public/venues/slug/x' });

        expect(result).toMatchObject({ ok: true, degraded: true });
    });

    it('does not flag a normal answer', async () => {
        const { apiClient } = await import('@/lib/api/client');
        global.fetch = mockJsonFetch({ cacheControl: 'public, max-age=60' });

        const result = await apiClient.get({ path: '/api/v1/public/venues/slug/x' });

        expect(result.ok).toBe(true);
        expect(result).not.toHaveProperty('degraded');
    });

    it('does not flag an answer without Cache-Control', async () => {
        const { apiClient } = await import('@/lib/api/client');
        global.fetch = mockJsonFetch({});

        const result = await apiClient.get({ path: '/api/v1/public/venues/slug/x' });

        expect(result).not.toHaveProperty('degraded');
    });

    it('flags list answers too', async () => {
        const { apiClient } = await import('@/lib/api/client');
        global.fetch = mockJsonFetch({ cacheControl: 'No-Store' });

        const result = await apiClient.getList({ path: '/api/v1/public/venues' });

        expect(result).toMatchObject({ ok: true, degraded: true });
    });
});
