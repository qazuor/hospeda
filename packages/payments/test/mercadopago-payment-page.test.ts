/**
 * HOS-2179 §5.1, §7.2 (T-1): the Mercado Pago adapter's one-time payment page.
 * The exact preference body, the persisted key, the fail-closed creation, the read
 * without an expired flag (RP19), the close by expiry, and the charge search bounded
 * on our side.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { NON_INSTANT_PAYMENT_TYPES } from '../src/adapters/mercadopago/mercadopago-payment-page';
import {
    CAPABILITY_METHODS,
    MercadoPagoPaymentProvider,
    type OneTimePaymentInput,
    type OneTimePaymentResult
} from '../src/index';

const NOW = new Date('2026-11-19T12:00:00.000Z');
const clock = createAdjustableClock({ start: NOW });

const input: OneTimePaymentInput = {
    reference: 'purchase-1',
    idempotencyKey: 'page:purchase-1',
    amount: { amountMinor: 1_250_050, currency: 'ARS' },
    reason: 'Destacado 7 días',
    returnUrl: 'https://hospeda.example/mi-cuenta/complementos/?compra=purchase-1',
    expiresAt: '2026-11-19T13:00:00.000Z'
};

function setup(responses: readonly { readonly status: number; readonly body: unknown }[]) {
    const fetch = vi.fn<typeof globalThis.fetch>();
    for (const { status, body } of responses)
        fetch.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
    return {
        fetch,
        adapter: new MercadoPagoPaymentProvider({ clock, accessToken: 'test-token', fetch })
    };
}

function sent(fetch: ReturnType<typeof setup>['fetch'], call = 0) {
    const [url, init] = fetch.mock.calls[call] ?? [];
    return {
        url: String(url),
        method: init?.method,
        key: new Headers(init?.headers).get('X-Idempotency-Key'),
        body: init?.body === undefined ? undefined : JSON.parse(String(init.body))
    };
}

describe('the interface shape (§7.2, P-7)', () => {
    it('has no card field and stays inside the eight capabilities', () => {
        expectTypeOf<keyof OneTimePaymentInput>().toEqualTypeOf<
            'reference' | 'idempotencyKey' | 'amount' | 'reason' | 'returnUrl' | 'expiresAt'
        >();
        expectTypeOf<keyof OneTimePaymentResult>().toEqualTypeOf<
            'paymentPageId' | 'approvalUrl' | 'expiresAt'
        >();
        expect(CAPABILITY_METHODS.charge).toContain('requestOneTimePayment');
        expect(CAPABILITY_METHODS.cancel).toContain('closeOneTimePayment');
        expect(CAPABILITY_METHODS.read).toEqual(
            expect.arrayContaining(['readOneTimePayment', 'searchCharges'])
        );
    });
});

describe('requestOneTimePayment', () => {
    it('sends the exact §5.1 body with the persisted key and returns the page', async () => {
        // Arrange
        const { adapter, fetch } = setup([
            {
                status: 201,
                body: {
                    id: 'PREF-1',
                    init_point:
                        'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=PREF-1',
                    expiration_date_to: '2026-11-19T10:00:00.000-03:00'
                }
            }
        ]);

        // Act
        const result = await adapter.requestOneTimePayment(input);

        // Assert
        expect(result).toEqual({
            paymentPageId: 'PREF-1',
            approvalUrl: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=PREF-1',
            expiresAt: '2026-11-19T13:00:00.000Z'
        });
        const request = sent(fetch);
        expect(request.url).toBe('https://api.mercadopago.com/checkout/preferences');
        expect(request.method).toBe('POST');
        expect(request.key).toBe('page:purchase-1');
        expect(request.body).toEqual({
            external_reference: 'purchase-1',
            items: [
                {
                    id: 'purchase-1',
                    title: 'Destacado 7 días',
                    quantity: 1,
                    unit_price: 12_500.5,
                    currency_id: 'ARS'
                }
            ],
            back_urls: {
                success: input.returnUrl,
                pending: input.returnUrl,
                failure: input.returnUrl
            },
            auto_return: 'approved',
            binary_mode: true,
            payment_methods: {
                installments: 1,
                excluded_payment_types: [
                    { id: 'ticket' },
                    { id: 'atm' },
                    { id: 'bank_transfer' },
                    { id: 'digital_currency' }
                ]
            },
            expires: true,
            expiration_date_from: NOW.toISOString(),
            expiration_date_to: input.expiresAt
        });
    });

    it('never asks for a delayed method, a payer or a notification url (D-3, P-5, P-8)', async () => {
        const { adapter, fetch } = setup([
            {
                status: 201,
                body: {
                    id: 'P',
                    init_point: 'https://mp.example/p',
                    expiration_date_to: input.expiresAt
                }
            }
        ]);
        await adapter.requestOneTimePayment(input);
        const { body } = sent(fetch);
        expect(NON_INSTANT_PAYMENT_TYPES).not.toContain('credit_card');
        expect(NON_INSTANT_PAYMENT_TYPES).not.toContain('debit_card');
        expect(NON_INSTANT_PAYMENT_TYPES).not.toContain('account_money');
        expect(body).not.toHaveProperty('payer');
        expect(body).not.toHaveProperty('notification_url');
    });

    it('fails closed when the provider reads back no expiry: such a page is payable forever', async () => {
        const { adapter } = setup([
            {
                status: 201,
                body: { id: 'P', init_point: 'https://mp.example/p', expiration_date_to: null }
            }
        ]);
        await expect(adapter.requestOneTimePayment(input)).rejects.toMatchObject({
            code: 'UNAVAILABLE',
            capability: 'charge'
        });
    });

    it('refuses any card field before calling the provider (AC-2, §6.2)', async () => {
        const { adapter, fetch } = setup([]);
        await expect(
            adapter.requestOneTimePayment({ ...input, paymentToken: 'tok' } as OneTimePaymentInput)
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('maps a provider refusal to REJECTED', async () => {
        const { adapter } = setup([{ status: 400, body: { message: 'invalid items' } }]);
        await expect(adapter.requestOneTimePayment(input)).rejects.toMatchObject({
            code: 'REJECTED'
        });
    });
});

describe('readOneTimePayment', () => {
    it('reads the page by id, stamped with the injected clock, with no expired flag (RP19)', async () => {
        const { adapter, fetch } = setup([
            {
                status: 200,
                body: {
                    id: 'PREF-1',
                    external_reference: 'purchase-1',
                    expires: true,
                    expiration_date_to: '2026-11-19T10:00:00.000-03:00',
                    date_created: '2026-11-19T09:00:00.000-03:00'
                }
            }
        ]);
        const read = await adapter.readOneTimePayment({ paymentPageId: 'PREF-1' });
        expect(sent(fetch).url).toBe('https://api.mercadopago.com/checkout/preferences/PREF-1');
        expect(read.readAt).toEqual(NOW);
        expect(read.snapshot).toEqual({
            paymentPageId: 'PREF-1',
            reference: 'purchase-1',
            expiresAt: '2026-11-19T13:00:00.000Z',
            createdAt: '2026-11-19T12:00:00.000Z'
        });
    });

    it('reads a page that does not expire as a null expiry', async () => {
        const { adapter } = setup([
            {
                status: 200,
                body: {
                    id: 'P',
                    external_reference: 'r',
                    expires: false,
                    expiration_date_to: '2026-11-19T13:00:00.000Z',
                    date_created: '2026-11-19T12:00:00.000Z'
                }
            }
        ]);
        expect((await adapter.readOneTimePayment({ paymentPageId: 'P' })).snapshot.expiresAt).toBe(
            null
        );
    });

    it('classifies a page without our reference as foreign (UNSUPPORTED)', async () => {
        const { adapter } = setup([
            {
                status: 200,
                body: { id: 'P', external_reference: ' ', date_created: NOW.toISOString() }
            }
        ]);
        await expect(adapter.readOneTimePayment({ paymentPageId: 'P' })).rejects.toMatchObject({
            code: 'UNSUPPORTED'
        });
    });

    it('fails closed on a page without a creation date', async () => {
        const { adapter } = setup([{ status: 200, body: { id: 'P', external_reference: 'r' } }]);
        await expect(adapter.readOneTimePayment({ paymentPageId: 'P' })).rejects.toMatchObject({
            code: 'UNAVAILABLE'
        });
    });
});

describe('closeOneTimePayment', () => {
    it('moves the expiry to now with a PUT and only acknowledges it', async () => {
        const { adapter, fetch } = setup([{ status: 200, body: { id: 'PREF-1' } }]);
        expect(await adapter.closeOneTimePayment({ paymentPageId: 'PREF-1' })).toEqual({
            accepted: true,
            resourceId: 'PREF-1'
        });
        expect(sent(fetch)).toMatchObject({
            url: 'https://api.mercadopago.com/checkout/preferences/PREF-1',
            method: 'PUT',
            body: { expires: true, expiration_date_to: NOW.toISOString() }
        });
    });

    it('surfaces a refused close as an error', async () => {
        const { adapter } = setup([{ status: 404, body: { message: 'not found' } }]);
        await expect(adapter.closeOneTimePayment({ paymentPageId: 'X' })).rejects.toMatchObject({
            code: 'NOT_FOUND',
            capability: 'cancel'
        });
    });
});

describe('searchCharges', () => {
    const payment = (id: string, at: string, reference?: string | null) => ({
        id,
        date_created: at,
        ...(reference === undefined ? {} : { external_reference: reference })
    });
    const range = {
        reference: 'purchase-1',
        createdFrom: '2026-11-19T12:00:00.000Z',
        createdTo: '2026-11-19T14:00:00.000Z'
    };

    it('keeps ids inside the inclusive range, drops other references and keeps unnamed ones', async () => {
        // Arrange
        const { adapter, fetch } = setup([
            {
                status: 200,
                body: {
                    paging: { total: 6 },
                    results: [
                        payment('before', '2026-11-19T11:59:59.999Z', 'purchase-1'),
                        payment('from-edge', '2026-11-19T09:00:00.000-03:00', 'purchase-1'),
                        payment('other', '2026-11-19T13:00:00.000Z', 'purchase-2'),
                        payment('unnamed', '2026-11-19T13:00:00.000Z'),
                        payment('to-edge', '2026-11-19T14:00:00.000Z', 'purchase-1'),
                        payment('after', '2026-11-19T14:00:00.001Z', 'purchase-1')
                    ]
                }
            }
        ]);

        // Act
        const result = await adapter.searchCharges(range);

        // Assert
        expect(result).toEqual({ chargeIds: ['from-edge', 'unnamed', 'to-edge'] });
        expect(sent(fetch).url).toBe(
            'https://api.mercadopago.com/v1/payments/search?external_reference=purchase-1'
        );
    });

    it('refuses a range that ends before it starts, before any request', async () => {
        const { adapter, fetch } = setup([]);
        await expect(
            adapter.searchCharges({ ...range, createdTo: '2026-11-19T11:00:00.000Z' })
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('refuses a truncated result page instead of answering a part', async () => {
        const { adapter } = setup([
            {
                status: 200,
                body: { paging: { total: 2 }, results: [payment('a', '2026-11-19T13:00:00.000Z')] }
            }
        ]);
        await expect(adapter.searchCharges(range)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    });
});
