import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type {
    ChargeInput,
    ChargeResult,
    OneTimeChargeInput,
    OneTimeChargeResult
} from '../src/index';
import { CAPABILITY_METHODS, MercadoPagoPaymentProvider } from '../src/index';

const clock = createAdjustableClock({ start: new Date('2026-10-01T00:00:00Z') });

describe('HOS-1554 TEST:B6:9 AC:B6:11 charge interface', () => {
    it('keeps the exact domain fields and capability methods', () => {
        expectTypeOf<keyof OneTimeChargeInput>().toEqualTypeOf<
            | 'reference'
            | 'idempotencyKey'
            | 'amount'
            | 'payerEmail'
            | 'paymentToken'
            | 'paymentBrand'
            | 'paymentKind'
        >();
        expectTypeOf<keyof OneTimeChargeResult>().toEqualTypeOf<'orderId' | 'declined'>();
        expectTypeOf<keyof ChargeInput>().toEqualTypeOf<
            'authorizationId' | 'amount' | 'reference'
        >();
        expectTypeOf<keyof ChargeResult>().toEqualTypeOf<'chargeId'>();
        expect(CAPABILITY_METHODS.charge).toEqual(['charge', 'chargeOnce']);
    });

    it('rejects recurring charge and sends one-time charge to one order URL', async () => {
        const fetch = vi
            .fn<typeof globalThis.fetch>()
            .mockResolvedValue(
                new Response(JSON.stringify({ id: 'O1', status: 'processed' }), { status: 201 })
            );
        const adapter = new MercadoPagoPaymentProvider({ clock, accessToken: 'test-token', fetch });
        await expect(
            adapter.charge({
                authorizationId: 'A',
                amount: { amountMinor: 1500, currency: 'ARS' },
                reference: 'R'
            })
        ).rejects.toMatchObject({ code: 'REJECTED' });
        expect(
            await adapter.chargeOnce({
                reference: 'R',
                idempotencyKey: 'K',
                amount: { amountMinor: 1500, currency: 'ARS' },
                payerEmail: 'buyer@example.test',
                paymentToken: 'T',
                paymentBrand: 'master',
                paymentKind: 'credit'
            })
        ).toEqual({ orderId: 'O1', declined: false });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0]?.[0]).toBe('https://api.mercadopago.com/v1/orders');
    });
});
