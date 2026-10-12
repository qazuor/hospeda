/** TEST:B3:35 (soporte) and TEST:B3:36 (soporte): real adapter cancellation and webhook decoding. */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';
import { PaymentProviderError } from '../src/provider/errors';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const input = {
    reference: 'cancel-test',
    amount: { amountMinor: 1500, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    reason: 'Plan mensual',
    returnUrl: 'https://example.test/return'
} as const;

describe('Mercado Pago cancel and notice decoder', () => {
    it('cancels through the fake HTTP server and re-reads the result', async () => {
        const server = await startFakeProviderServer({
            provider: new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() }),
            clock
        });
        try {
            const adapter = new MercadoPagoPaymentProvider({
                clock,
                baseUrl: server.url,
                accessToken: 'test-token'
            });
            const created = await adapter.authorize(input);
            const ack = await adapter.cancel({ authorizationId: created.authorizationId });
            expect(ack).toEqual({ accepted: true, resourceId: created.authorizationId });
            expect(server.requests()[1]).toMatchObject({
                method: 'PUT',
                path: `/preapproval/${created.authorizationId}`,
                body: { status: 'cancelled' }
            });
            const read = await adapter.readAuthorization({
                authorizationId: created.authorizationId
            });
            expect(read.snapshot.status).toBe('cancelled');
        } finally {
            await server.close();
        }
    });

    it('maps missing ids and missing tokens to provider errors', async () => {
        const server = await startFakeProviderServer({
            provider: new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() }),
            clock
        });
        try {
            const adapter = new MercadoPagoPaymentProvider({
                clock,
                baseUrl: server.url,
                accessToken: 'test-token'
            });
            await expect(adapter.cancel({ authorizationId: 'absent' })).rejects.toMatchObject({
                code: 'NOT_FOUND',
                capability: 'cancel'
            });
            await expect(
                new MercadoPagoPaymentProvider({ clock }).cancel({ authorizationId: 'a' })
            ).rejects.toMatchObject({ code: 'UNAVAILABLE', capability: 'cancel' });
        } finally {
            await server.close();
        }
    });

    it('decodes the measured preapproval body using data.id, not notification id', async () => {
        const adapter = new MercadoPagoPaymentProvider({ clock });
        const notice = await adapter.decodeNotice({
            headers: {},
            body: '{"action":"updated","application_id":2671930029336144,"data":{"id":"bfce61b75482412a99bc8b6c16a2dc60"},"date":"2026-09-29T07:27:36Z","entity":"preapproval","id":39327903334304776,"type":"subscription_preapproval","version":9}'
        });
        expect(notice.resourceKind).toBe('authorization');
        expect(notice.resourceId).toBe('bfce61b75482412a99bc8b6c16a2dc60');
        expect(notice.version).toBe('9');
    });

    it('defaults payment version to zero and rejects unsupported or malformed deliveries', async () => {
        const adapter = new MercadoPagoPaymentProvider({ clock });
        const notice = await adapter.decodeNotice({
            headers: {},
            body: '{"type":"payment","data":{"id":123}}'
        });
        expect(notice).toEqual({ resourceKind: 'charge', resourceId: '123', version: '0' });
        for (const body of [
            '{"type":"subscription_authorized_payment","data":{"id":"x"}}',
            '{"resource":"1","topic":"payment"}',
            'not json',
            '{"type":"payment","data":{}}'
        ]) {
            await expect(adapter.decodeNotice({ headers: {}, body })).rejects.toBeInstanceOf(
                PaymentProviderError
            );
            await expect(adapter.decodeNotice({ headers: {}, body })).rejects.toMatchObject({
                code: 'INVALID_NOTICE',
                capability: 'notify'
            });
        }
    });
});
