/**
 * @file client-visitor-ip.test.ts
 * @description HOS-1973: the SSR API client forwards the visitor IP taken from
 * the incoming request, and forwards nothing outside a request scope.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
    getApiUrl: vi.fn(() => 'http://api.test'),
    getInternalApiUrl: vi.fn(() => undefined),
    getInternalRequestSecret: vi.fn(() => undefined)
}));

import { apiClient } from '../../../src/lib/api/client';
import { extractVisitorIp, runWithVisitorIp } from '../../../src/lib/api/visitor-ip-context';

const okFetch = () =>
    vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: {} }) }) as Response);

const sentHeaders = (f: ReturnType<typeof okFetch>): Record<string, string> =>
    (f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;

describe('SSR client visitor IP forwarding', () => {
    let fetchMock: ReturnType<typeof okFetch>;
    beforeEach(() => {
        fetchMock = okFetch();
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('SSR', true);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('sets cf-connecting-ip and x-forwarded-for from the incoming request', async () => {
        const headers = new Headers({ 'cf-connecting-ip': '203.0.113.9' });
        await runWithVisitorIp({ headers, fn: () => apiClient.get({ path: '/x' }) });
        expect(sentHeaders(fetchMock)['cf-connecting-ip']).toBe('203.0.113.9');
        expect(sentHeaders(fetchMock)['x-forwarded-for']).toBe('203.0.113.9');
    });

    it('omits the headers without an incoming request context', async () => {
        await apiClient.get({ path: '/x' });
        expect(sentHeaders(fetchMock)['cf-connecting-ip']).toBeUndefined();
        expect(sentHeaders(fetchMock)['x-forwarded-for']).toBeUndefined();
    });

    it('omits the headers when the incoming request has no cf-connecting-ip', async () => {
        const headers = new Headers({ 'x-forwarded-for': '198.51.100.1' });
        await runWithVisitorIp({ headers, fn: () => apiClient.get({ path: '/x' }) });
        expect(sentHeaders(fetchMock)['x-forwarded-for']).toBeUndefined();
    });

    it('does not fragment SSR cache keys per visitor', async () => {
        const call = (ip: string) =>
            runWithVisitorIp({
                headers: new Headers({ 'cf-connecting-ip': ip }),
                fn: () => apiClient.get({ path: '/cached-hos1973', cacheTtlMs: 60_000 })
            });
        await call('203.0.113.1');
        await call('203.0.113.2');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe('extractVisitorIp', () => {
    it('rejects malformed values', () => {
        expect(extractVisitorIp({ headers: new Headers({ 'cf-connecting-ip': 'nope' }) })).toBe(
            undefined
        );
    });
    it('accepts IPv6', () => {
        expect(
            extractVisitorIp({ headers: new Headers({ 'cf-connecting-ip': '2001:db8::1' }) })
        ).toBe('2001:db8::1');
    });
});
