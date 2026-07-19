/**
 * Unit tests: MercadoPago Preapproval → preapproval_plan_id lookup (HOS-191 F3).
 *
 * Coverage:
 * - 200 with preapproval_plan_id → ok + the id
 * - 200 with no preapproval_plan_id (ad-hoc preapproval) → ok + null
 * - 404 → not-found
 * - 401/403 → unauthorized
 * - 5xx → error
 * - Network failure → error
 * - Timeout (AbortError) → error with timeout message
 * - Request shape: URL, method, headers, encoding
 *
 * @module test/utils/mp-preapproval-plan-lookup
 */

import { describe, expect, it, vi } from 'vitest';
import { fetchPreapprovalPlanId } from '../../src/utils/mp-preapproval-plan-lookup';

function mockFetchOk(body: unknown, status = 200): ReturnType<typeof vi.fn> {
    return vi.fn(
        async () =>
            new Response(JSON.stringify(body), {
                status,
                headers: { 'content-type': 'application/json' }
            })
    );
}

describe('fetchPreapprovalPlanId', () => {
    it('returns ok + the plan id when present on the response', async () => {
        const fetchImpl = mockFetchOk({ id: 'pa-1', preapproval_plan_id: 'plan-abc' });
        const result = await fetchPreapprovalPlanId({
            preapprovalId: 'pa-1',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'ok', preapprovalPlanId: 'plan-abc' });
    });

    it('returns ok + null when preapproval_plan_id is absent (ad-hoc preapproval)', async () => {
        const fetchImpl = mockFetchOk({ id: 'pa-1' });
        const result = await fetchPreapprovalPlanId({
            preapprovalId: 'pa-1',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'ok', preapprovalPlanId: null });
    });

    it('returns ok + null when preapproval_plan_id is an empty string', async () => {
        const fetchImpl = mockFetchOk({ id: 'pa-1', preapproval_plan_id: '' });
        const result = await fetchPreapprovalPlanId({
            preapprovalId: 'pa-1',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'ok', preapprovalPlanId: null });
    });

    it('uses the configured URL, method, and headers (Bearer auth, URL-encoded id)', async () => {
        const fetchImpl = mockFetchOk({ id: 'pa-1' });
        await fetchPreapprovalPlanId({
            preapprovalId: 'pa 1',
            accessToken: 'APP_USR-xyz',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        const firstCall = fetchImpl.mock.calls[0];
        if (!firstCall) throw new Error('fetch was not called');
        const [url, init] = firstCall as [string, RequestInit];
        expect(url).toBe('https://api.mercadopago.com/preapproval/pa%201');
        expect(init.method).toBe('GET');
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer APP_USR-xyz');
        expect(headers.Accept).toBe('application/json');
    });

    it('returns not-found on HTTP 404', async () => {
        const fetchImpl = mockFetchOk({ message: 'not found' }, 404);
        const result = await fetchPreapprovalPlanId({
            preapprovalId: 'gone',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'not-found' });
    });

    it('returns unauthorized on HTTP 401', async () => {
        const fetchImpl = mockFetchOk({ message: 'unauthorized' }, 401);
        const result = await fetchPreapprovalPlanId({
            preapprovalId: 'pa-1',
            accessToken: 'bad-token',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'unauthorized' });
    });

    it('returns unauthorized on HTTP 403', async () => {
        const fetchImpl = mockFetchOk({ message: 'forbidden' }, 403);
        const result = await fetchPreapprovalPlanId({
            preapprovalId: 'pa-1',
            accessToken: 'bad-token',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'unauthorized' });
    });

    it('returns error on HTTP 500', async () => {
        const fetchImpl = mockFetchOk({ message: 'server error' }, 500);
        const result = await fetchPreapprovalPlanId({
            preapprovalId: 'pa-1',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result.kind).toBe('error');
        if (result.kind !== 'error') throw new Error('unreachable');
        expect(result.message).toContain('HTTP 500');
    });

    it('returns error on network failure', async () => {
        const fetchImpl = vi.fn(async () => {
            throw new Error('ECONNRESET');
        });
        const result = await fetchPreapprovalPlanId({
            preapprovalId: 'pa-1',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'error', message: 'ECONNRESET' });
    });

    it('returns a timeout-flavored error on AbortError', async () => {
        const fetchImpl = vi.fn(async () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            throw err;
        });
        const result = await fetchPreapprovalPlanId({
            preapprovalId: 'pa-1',
            accessToken: 'TEST-abc',
            timeoutMs: 5000,
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result.kind).toBe('error');
        if (result.kind !== 'error') throw new Error('unreachable');
        expect(result.message).toContain('timed out after 5000ms');
    });
});
