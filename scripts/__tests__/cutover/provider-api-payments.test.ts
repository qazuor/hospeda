import { describe, expect, it } from 'vitest';
import { createProviderApi, ProviderError } from '../../cutover/provider-api.ts';

/**
 * The payment methods the abort inverses use (HOS-1427): read a payment, refund it, read the
 * refund. U3.3 reuses them for the real step 4b.
 */
const TOKEN = 'test-token-value-1234';
const BASE = 'https://provider.invalid';

interface Seen {
    readonly method: string;
    readonly url: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string | undefined;
}

function client({
    answer
}: {
    readonly answer: (seen: Seen, attempt: number) => { status: number; json: unknown };
}) {
    const seen: Seen[] = [];
    const fetchImpl = (async (input: unknown, init?: RequestInit) => {
        const entry: Seen = {
            method: init?.method ?? 'GET',
            url: String(input),
            headers: { ...(init?.headers as Record<string, string>) },
            body: typeof init?.body === 'string' ? init.body : undefined
        };
        seen.push(entry);
        const { status, json } = answer(entry, seen.length);
        return new Response(JSON.stringify(json), { status });
    }) as typeof fetch;
    const api = createProviderApi({
        accessToken: TOKEN,
        baseUrl: BASE,
        fetchImpl,
        sleep: async () => {}
    });
    return { api, seen };
}

describe('payment methods of the provider client', () => {
    it('reads a payment by id, keeping its status and refund ids and nothing about the payer', async () => {
        // Arrange
        const { api, seen } = client({
            answer: () => ({
                status: 200,
                json: {
                    id: 123,
                    status: 'refunded',
                    payer: { email: 'person@example.com', first_name: 'Ana' },
                    refunds: [{ id: 77, amount: 10 }, { id: '78' }]
                }
            })
        });
        // Act
        const payment = await api.getPayment({ paymentId: '123' });
        // Assert
        expect(seen[0]).toMatchObject({ method: 'GET', url: `${BASE}/v1/payments/123` });
        expect(payment).toEqual({ id: '123', status: 'refunded', refundIds: ['77', '78'] });
        expect(JSON.stringify(payment)).not.toMatch(/@|Ana|email/);
    });

    it('reads a payment without refunds as an empty list', async () => {
        // Arrange
        const { api } = client({
            answer: () => ({ status: 200, json: { id: '5', status: 'approved', refunds: null } })
        });
        // Act
        const payment = await api.getPayment({ paymentId: '5' });
        // Assert
        expect(payment.refundIds).toEqual([]);
    });

    it('refunds in full by POST with a deterministic idempotency key, retried safely on 5xx', async () => {
        // Arrange
        const { api, seen } = client({
            answer: (_s, attempt) =>
                attempt === 1
                    ? { status: 503, json: {} }
                    : { status: 201, json: { id: 991, status: 'approved' } }
        });
        // Act
        const result = await api.refundPayment({ paymentId: '123' });
        // Assert
        expect(result).toEqual({ accepted: true, httpStatus: 201, refundId: '991' });
        expect(seen).toHaveLength(2);
        for (const s of seen) {
            expect(s).toMatchObject({ method: 'POST', url: `${BASE}/v1/payments/123/refunds` });
            expect(s.headers['X-Idempotency-Key']).toBe('cutover-refund-123');
            expect(JSON.parse(s.body ?? 'null')).toEqual({});
        }
    });

    it('reports a refused refund without an id', async () => {
        // Arrange
        const { api } = client({ answer: () => ({ status: 400, json: { id: 'nope' } }) });
        // Act
        const result = await api.refundPayment({ paymentId: '123' });
        // Assert
        expect(result).toEqual({ accepted: false, httpStatus: 400, refundId: null });
    });

    it('reads a refund by id under its payment', async () => {
        // Arrange
        const { api, seen } = client({
            answer: () => ({ status: 200, json: { id: 991, status: 'approved', amount: 10 } })
        });
        // Act
        const refund = await api.getRefund({ paymentId: '123', refundId: '991' });
        // Assert
        expect(seen[0]).toMatchObject({
            method: 'GET',
            url: `${BASE}/v1/payments/123/refunds/991`
        });
        expect(refund).toEqual({ id: '991', status: 'approved' });
    });

    it('refuses malformed ids and unusable answers without leaking the body', async () => {
        // Arrange
        const { api, seen } = client({
            answer: () => ({ status: 404, json: { message: 'person@example.com' } })
        });
        // Act
        const malformed = await api.getPayment({ paymentId: '1/../2' }).catch((e: unknown) => e);
        const badRefundId = await api
            .getRefund({ paymentId: '1', refundId: '?x=1' })
            .catch((e: unknown) => e);
        const notFound = await api
            .getRefund({ paymentId: '1', refundId: '2' })
            .catch((e: unknown) => e);
        // Assert
        expect(malformed).toBeInstanceOf(ProviderError);
        expect(badRefundId).toBeInstanceOf(ProviderError);
        expect(notFound).toBeInstanceOf(ProviderError);
        expect(String((notFound as Error).message)).not.toContain('person@');
        expect(seen).toHaveLength(1);
    });
});
