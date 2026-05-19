/**
 * Unit tests: MercadoPago Authorized Payment fetch helper (SPEC-141 D4).
 *
 * Coverage:
 * - 200 with full payload → ok + correctly parsed fields
 * - 200 with payment block missing → ok + paymentId/paymentStatus null
 * - 200 with missing required field → error
 * - 404 → not-found
 * - 401/403 → unauthorized
 * - 5xx → error
 * - Network failure → error
 * - Timeout (AbortError) → error with timeout message
 * - Request shape: URL, method, headers, encoding
 * - Parser type coercion edge cases
 *
 * @module test/utils/mp-authorized-payment
 */

import { describe, expect, it, vi } from 'vitest';
import { _internals, fetchAuthorizedPaymentDetails } from '../../src/utils/mp-authorized-payment';

const VALID_RESPONSE = {
    id: 123456789,
    preapproval_id: 'pa-abc123',
    transaction_amount: 999.5,
    currency_id: 'ARS',
    status: 'processed',
    debit_date: '2026-06-15T10:00:00.000Z',
    payment: {
        id: 987654321,
        status: 'approved',
        status_detail: 'accredited'
    }
};

function mockFetchOk(body: unknown, status = 200): ReturnType<typeof vi.fn> {
    return vi.fn(
        async () =>
            new Response(JSON.stringify(body), {
                status,
                headers: { 'content-type': 'application/json' }
            })
    );
}

describe('fetchAuthorizedPaymentDetails', () => {
    it('returns parsed details on 200 with full payload', async () => {
        const fetchImpl = mockFetchOk(VALID_RESPONSE);
        const result = await fetchAuthorizedPaymentDetails({
            authorizedPaymentId: '123456789',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result.kind).toBe('ok');
        if (result.kind !== 'ok') throw new Error('unreachable');
        expect(result.details).toEqual({
            authorizedPaymentId: '123456789',
            preapprovalId: 'pa-abc123',
            transactionAmount: 999.5,
            currencyId: 'ARS',
            paymentId: '987654321',
            status: 'processed',
            paymentStatus: 'approved',
            debitDate: '2026-06-15T10:00:00.000Z'
        });
    });

    it('uses the configured URL, method, and headers (Bearer auth, URL-encoded id)', async () => {
        const fetchImpl = mockFetchOk(VALID_RESPONSE);
        await fetchAuthorizedPaymentDetails({
            authorizedPaymentId: 'abc 123',
            accessToken: 'APP_USR-xyz',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        const firstCall = fetchImpl.mock.calls[0];
        if (!firstCall) throw new Error('fetch was not called');
        const [url, init] = firstCall as [string, RequestInit];
        expect(url).toBe('https://api.mercadopago.com/authorized_payments/abc%20123');
        expect(init.method).toBe('GET');
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer APP_USR-xyz');
        expect(headers.Accept).toBe('application/json');
    });

    it('returns not-found on HTTP 404', async () => {
        const fetchImpl = mockFetchOk({ message: 'not found' }, 404);
        const result = await fetchAuthorizedPaymentDetails({
            authorizedPaymentId: 'gone',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'not-found', authorizedPaymentId: 'gone' });
    });

    it('returns unauthorized on HTTP 401', async () => {
        const fetchImpl = mockFetchOk({ message: 'invalid token' }, 401);
        const result = await fetchAuthorizedPaymentDetails({
            authorizedPaymentId: 'x',
            accessToken: 'bad',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'unauthorized', authorizedPaymentId: 'x' });
    });

    it('returns unauthorized on HTTP 403', async () => {
        const fetchImpl = mockFetchOk({ message: 'forbidden' }, 403);
        const result = await fetchAuthorizedPaymentDetails({
            authorizedPaymentId: 'x',
            accessToken: 'bad',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result).toEqual({ kind: 'unauthorized', authorizedPaymentId: 'x' });
    });

    it('returns error on other 5xx', async () => {
        const fetchImpl = mockFetchOk({}, 500);
        const result = await fetchAuthorizedPaymentDetails({
            authorizedPaymentId: 'x',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result.kind).toBe('error');
        if (result.kind !== 'error') throw new Error('unreachable');
        expect(result.message).toContain('500');
    });

    it('returns error if payload is missing preapproval_id', async () => {
        const { preapproval_id: _ignored, ...rest } = VALID_RESPONSE;
        const fetchImpl = mockFetchOk(rest);
        const result = await fetchAuthorizedPaymentDetails({
            authorizedPaymentId: 'x',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result.kind).toBe('error');
        if (result.kind !== 'error') throw new Error('unreachable');
        expect(result.message).toContain('missing required fields');
    });

    it('returns ok with paymentId=null when payment block is absent', async () => {
        const { payment: _ignored, ...withoutPayment } = VALID_RESPONSE;
        const fetchImpl = mockFetchOk(withoutPayment);
        const result = await fetchAuthorizedPaymentDetails({
            authorizedPaymentId: 'x',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result.kind).toBe('ok');
        if (result.kind !== 'ok') throw new Error('unreachable');
        expect(result.details.paymentId).toBeNull();
        expect(result.details.paymentStatus).toBeNull();
    });

    it('returns error on network failure (thrown fetch)', async () => {
        const fetchImpl = vi.fn(async () => {
            throw new Error('ECONNREFUSED');
        });
        const result = await fetchAuthorizedPaymentDetails({
            authorizedPaymentId: 'x',
            accessToken: 'TEST-abc',
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result.kind).toBe('error');
        if (result.kind !== 'error') throw new Error('unreachable');
        expect(result.message).toContain('ECONNREFUSED');
    });

    it('returns error with timeout message when AbortError is raised', async () => {
        const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
            return new Promise<Response>((_, reject) => {
                init.signal?.addEventListener('abort', () => {
                    const err = new Error('aborted');
                    err.name = 'AbortError';
                    reject(err);
                });
            });
        });
        const result = await fetchAuthorizedPaymentDetails({
            authorizedPaymentId: 'x',
            accessToken: 'TEST-abc',
            timeoutMs: 10,
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        expect(result.kind).toBe('error');
        if (result.kind !== 'error') throw new Error('unreachable');
        expect(result.message).toContain('timed out');
        expect(result.message).toContain('10ms');
    });
});

describe('_internals.parseAuthorizedPaymentResponse', () => {
    it('coerces numeric payment.id to string', () => {
        const parsed = _internals.parseAuthorizedPaymentResponse(VALID_RESPONSE, '123');
        expect(parsed?.paymentId).toBe('987654321');
    });

    it('accepts string payment.id without coercion', () => {
        const parsed = _internals.parseAuthorizedPaymentResponse(
            { ...VALID_RESPONSE, payment: { id: 'string-id-99', status: 'approved' } },
            '123'
        );
        expect(parsed?.paymentId).toBe('string-id-99');
    });

    it('returns null when transaction_amount is not a number', () => {
        const parsed = _internals.parseAuthorizedPaymentResponse(
            { ...VALID_RESPONSE, transaction_amount: '999.5' as unknown as number },
            '123'
        );
        expect(parsed).toBeNull();
    });

    it('returns null when status is missing', () => {
        const { status: _ignored, ...rest } = VALID_RESPONSE;
        const parsed = _internals.parseAuthorizedPaymentResponse(rest, '123');
        expect(parsed).toBeNull();
    });

    it('returns null when currency_id is missing', () => {
        const { currency_id: _ignored, ...rest } = VALID_RESPONSE;
        const parsed = _internals.parseAuthorizedPaymentResponse(rest, '123');
        expect(parsed).toBeNull();
    });

    it('preserves the input authorizedPaymentId verbatim', () => {
        const parsed = _internals.parseAuthorizedPaymentResponse(VALID_RESPONSE, 'INPUT-ID');
        expect(parsed?.authorizedPaymentId).toBe('INPUT-ID');
    });
});
