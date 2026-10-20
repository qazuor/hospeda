import { describe, expect, it } from 'vitest';
import { createProviderApi } from '../../cutover/provider-api.ts';

const TOKEN = 'test-token-value-1234';
const BASE = 'https://provider.invalid';

describe('provider create calls for step 4b', () => {
    it('creates a pending probe with the exact safe preapproval body', async () => {
        // Arrange
        const seen: {
            method: string;
            url: string;
            headers: Record<string, string>;
            body: string;
        }[] = [];
        const api = createProviderApi({
            accessToken: TOKEN,
            baseUrl: BASE,
            sleep: async () => {},
            fetchImpl: (async (url, init) => {
                seen.push({
                    method: init?.method ?? '',
                    url: String(url),
                    headers: { ...(init?.headers as Record<string, string>) },
                    body: String(init?.body)
                });
                return new Response(
                    JSON.stringify({ id: 'probe-1', payer: { email: 'owner@example.com' } }),
                    { status: 201 }
                );
            }) as typeof fetch
        });
        // Act
        const result = await api.createProbe({
            payerEmail: 'owner@example.com',
            idempotencyKey: 'probe-key'
        });
        // Assert
        expect(seen[0]).toMatchObject({
            method: 'POST',
            url: `${BASE}/preapproval`,
            headers: { 'X-Idempotency-Key': 'probe-key' }
        });
        expect(JSON.parse(seen[0]?.body ?? 'null')).toEqual({
            reason: 'Hospeda cutover probe (step 4b)',
            payer_email: 'owner@example.com',
            back_url: 'https://hospeda.com.ar',
            status: 'pending',
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: 15,
                currency_id: 'ARS'
            }
        });
        expect(seen[0]?.body).not.toMatch(/card_token_id|notification_url/);
        expect(result).toEqual({ accepted: true, httpStatus: 201, id: 'probe-1' });
    });

    it('creates a payment directly with its idempotency key and returns only its id', async () => {
        // Arrange
        const seen: {
            method: string;
            url: string;
            headers: Record<string, string>;
            body: string;
        }[] = [];
        const api = createProviderApi({
            accessToken: TOKEN,
            baseUrl: BASE,
            sleep: async () => {},
            fetchImpl: (async (url, init) => {
                seen.push({
                    method: init?.method ?? '',
                    url: String(url),
                    headers: { ...(init?.headers as Record<string, string>) },
                    body: String(init?.body)
                });
                return new Response(
                    JSON.stringify({ id: 'pay-1', payer: { email: 'owner@example.com' } }),
                    { status: 201 }
                );
            }) as typeof fetch
        });
        // Act
        const result = await api.createPayment({
            amountArs: 20,
            cardToken: 'secret-card-token',
            paymentMethodId: 'visa',
            payerEmail: 'owner@example.com',
            idempotencyKey: 'pay-key'
        });
        // Assert
        expect(seen[0]).toMatchObject({
            method: 'POST',
            url: `${BASE}/v1/payments`,
            headers: { 'X-Idempotency-Key': 'pay-key' }
        });
        expect(JSON.parse(seen[0]?.body ?? 'null')).toEqual({
            transaction_amount: 20,
            token: 'secret-card-token',
            description: 'Hospeda cutover step 4b',
            installments: 1,
            payment_method_id: 'visa',
            payer: { email: 'owner@example.com' }
        });
        expect(seen[0]?.body).not.toContain('notification_url');
        expect(JSON.stringify(result)).not.toContain('@');
        expect(result).toEqual({ accepted: true, httpStatus: 201, id: 'pay-1' });
    });

    it('retries a 503 with the same idempotency key', async () => {
        // Arrange
        const keys: string[] = [];
        let attempt = 0;
        const api = createProviderApi({
            accessToken: TOKEN,
            baseUrl: BASE,
            sleep: async () => {},
            fetchImpl: (async (_url, init) => {
                keys.push((init?.headers as Record<string, string>)['X-Idempotency-Key'] ?? '');
                attempt += 1;
                return new Response(JSON.stringify({ id: 'probe-2' }), {
                    status: attempt === 1 ? 503 : 201
                });
            }) as typeof fetch
        });
        // Act
        const result = await api.createProbe({
            payerEmail: 'owner@example.com',
            idempotencyKey: 'stable-key'
        });
        // Assert
        expect(result.id).toBe('probe-2');
        expect(keys).toEqual(['stable-key', 'stable-key']);
    });

    it('does not expose mail or token when creation is refused', async () => {
        // Arrange
        const api = createProviderApi({
            accessToken: TOKEN,
            baseUrl: BASE,
            sleep: async () => {},
            fetchImpl: (async () =>
                new Response(JSON.stringify({ message: 'owner@example.com secret-card-token' }), {
                    status: 400
                })) as typeof fetch
        });
        // Act
        const result = await api.createPayment({
            amountArs: 20,
            cardToken: 'secret-card-token',
            paymentMethodId: 'visa',
            payerEmail: 'owner@example.com',
            idempotencyKey: 'refused-key'
        });
        // Assert
        expect(result).toEqual({ accepted: false, httpStatus: 400, id: null });
        expect(JSON.stringify(result)).not.toMatch(/owner@|secret-card-token/);
    });
});
