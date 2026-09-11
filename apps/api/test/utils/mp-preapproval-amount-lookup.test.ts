/**
 * Unit tests: MercadoPago Preapproval → live transaction_amount lookup (HOS-991).
 *
 * Coverage:
 * - 200 with auto_recurring.transaction_amount → ok + the amount
 * - 200 with no auto_recurring block → ok + null
 * - 200 with auto_recurring but no transaction_amount number → ok + null
 * - 404 → not-found
 * - 401/403 → unauthorized
 * - 5xx → error
 * - Network failure → error
 * - Timeout (AbortError) → error with timeout message
 * - Request shape: URL, method, headers, encoding
 *
 * @module test/utils/mp-preapproval-amount-lookup
 */

import { describe, expect, it, vi } from 'vitest';
import { fetchLivePreapprovalAmountMajor } from '../../src/utils/mp-preapproval-amount-lookup';

function mockFetchOk(body: unknown, status = 200): ReturnType<typeof vi.fn> {
    return vi.fn(
        async () =>
            new Response(JSON.stringify(body), {
                status,
                headers: { 'content-type': 'application/json' }
            })
    );
}

describe('fetchLivePreapprovalAmountMajor', () => {
    it('returns ok + the live amount when auto_recurring.transaction_amount is present', async () => {
        const fetchImpl = mockFetchOk({
            id: 'pa-1',
            status: 'authorized',
            auto_recurring: { transaction_amount: 6000, currency_id: 'ARS' }
        });
        const result = await fetchLivePreapprovalAmountMajor({
            preapprovalId: 'pa-1',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'ok', transactionAmountMajor: 6000 });
    });

    it('returns ok + null when auto_recurring is entirely absent', async () => {
        const fetchImpl = mockFetchOk({ id: 'pa-1', status: 'authorized' });
        const result = await fetchLivePreapprovalAmountMajor({
            preapprovalId: 'pa-1',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'ok', transactionAmountMajor: null });
    });

    it('returns ok + null when auto_recurring is present but transaction_amount is not a number', async () => {
        const fetchImpl = mockFetchOk({
            id: 'pa-1',
            status: 'authorized',
            auto_recurring: { currency_id: 'ARS' }
        });
        const result = await fetchLivePreapprovalAmountMajor({
            preapprovalId: 'pa-1',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'ok', transactionAmountMajor: null });
    });

    it('uses the configured URL, method, and headers (Bearer auth, URL-encoded id)', async () => {
        const fetchImpl = mockFetchOk({ id: 'pa-1', status: 'authorized' });
        await fetchLivePreapprovalAmountMajor({
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
        const result = await fetchLivePreapprovalAmountMajor({
            preapprovalId: 'gone',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'not-found' });
    });

    it('returns unauthorized on HTTP 401', async () => {
        const fetchImpl = mockFetchOk({ message: 'unauthorized' }, 401);
        const result = await fetchLivePreapprovalAmountMajor({
            preapprovalId: 'pa-1',
            accessToken: 'bad-token',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'unauthorized' });
    });

    it('returns unauthorized on HTTP 403', async () => {
        const fetchImpl = mockFetchOk({ message: 'forbidden' }, 403);
        const result = await fetchLivePreapprovalAmountMajor({
            preapprovalId: 'pa-1',
            accessToken: 'bad-token',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'unauthorized' });
    });

    it('returns error on HTTP 500', async () => {
        const fetchImpl = mockFetchOk({ message: 'server error' }, 500);
        const result = await fetchLivePreapprovalAmountMajor({
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
        const result = await fetchLivePreapprovalAmountMajor({
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
        const result = await fetchLivePreapprovalAmountMajor({
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
