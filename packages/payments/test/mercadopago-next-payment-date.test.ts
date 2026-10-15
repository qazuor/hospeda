import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const base = {
    id: 'preapproval-1',
    external_reference: 'sub-1',
    status: 'authorized',
    auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 18,
        currency_id: 'ARS'
    }
};

describe('TEST:1685:1 the adapter maps next_payment_date', () => {
    it.each([
        ['offset date', '2026-09-17T11:28:03.000-04:00', '2026-09-17T15:28:03.000Z'],
        ['null', null, null],
        ['absent', undefined, null],
        ['invalid text', 'not-a-date', null]
    ])('maps %s without failing', async (_label, value, expected) => {
        const body = { ...base, ...(value === undefined ? {} : { next_payment_date: value }) };
        const provider = new MercadoPagoPaymentProvider({
            clock,
            accessToken: 't',
            fetch: async () => new Response(JSON.stringify(body))
        });
        const read = await provider.readAuthorization({ authorizationId: 'preapproval-1' });
        expect(read.snapshot.nextChargeAt).toBe(expected);
        expect(read.readAt).toEqual(clock.now());
    });
});
