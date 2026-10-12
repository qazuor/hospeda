/** TEST:B3:35 (soporte) and TEST:B3:36 (soporte): fake deliveries use measured MP formats. */
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';

const start = new Date('2026-10-01T03:00:00.000Z');
const input = {
    reference: 'delivery-test',
    amount: { amountMinor: 1500, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    reason: 'Plan mensual',
    returnUrl: 'https://example.test/return'
} as const;
const servers: Array<{ close(): Promise<void> }> = [];
async function setup(honest = false, withoutRp12 = false) {
    const clock = createAdjustableClock({ start });
    const provider =
        honest && withoutRp12
            ? new FakePaymentProvider({
                  clock,
                  idNamespace: crypto.randomUUID(),
                  withoutBehaviour: [
                      { behaviour: 'RP12', why: 'assert delivery count without approval notice' }
                  ],
                  honestAbout: [
                      { lie: 'M6', why: 'The test needs due notices in both measured channels.' }
                  ]
              })
            : honest
              ? new FakePaymentProvider({
                    clock,
                    idNamespace: crypto.randomUUID(),
                    honestAbout: [
                        { lie: 'M6', why: 'The test needs due notices in both measured channels.' }
                    ]
                })
              : new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const server = await startFakeProviderServer({ provider, clock });
    servers.push(server);
    return { provider, server, clock };
}
afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('Mercado Pago-shaped fake deliveries', () => {
    it('translates approved authorizations to signed Webhooks and decodes the same notice', async () => {
        const { provider, server, clock } = await setup(true, true);
        const created = await provider.authorize(input);
        server.mercadoPagoDeliveries();
        await provider.approve({ authorizationId: created.authorizationId });
        const result = server.mercadoPagoDeliveries({ webhookSecret: 'secret' });
        expect(result.skipped).toBe(0);
        expect(result.deliveries).toHaveLength(1);
        const delivery = result.deliveries[0]!;
        expect(delivery.channel).toBe('WEBHOOKS');
        expect(delivery.query).toContain('source_news=webhooks');
        expect(delivery.query).toContain(`data.id=${created.authorizationId}`);
        expect(delivery.query).toContain('type=subscription_preapproval');
        const body = JSON.parse(delivery.body) as {
            data: { id: string };
            version: number | string;
        };
        const decoded = await new MercadoPagoPaymentProvider({ clock }).decodeNotice({
            headers: delivery.headers,
            body: delivery.body
        });
        expect(decoded.resourceId).toBe(created.authorizationId);
        expect(decoded.version).toBe(String(body.version));
        const ts = delivery.headers['x-signature']!.match(/ts=([^,]+)/)![1]!;
        const requestId = delivery.headers['x-request-id']!;
        const manifest = `id:${body.data.id.toLowerCase()};request-id:${requestId};ts:${ts};`;
        const v1 = delivery.headers['x-signature']!.match(/v1=([a-f0-9]+)/)![1]!;
        expect(createHmac('sha256', 'secret').update(manifest).digest('hex')).toBe(v1);
        expect(createHmac('sha256', 'secret').update(manifest.slice(0, -1)).digest('hex')).not.toBe(
            v1
        );
        const unsignedProvider = await setup(true);
        const unsignedCreated = await unsignedProvider.provider.authorize({
            ...input,
            reference: 'no-secret'
        });
        unsignedProvider.server.mercadoPagoDeliveries();
        await unsignedProvider.provider.approve({
            authorizationId: unsignedCreated.authorizationId
        });
        expect(
            unsignedProvider.server.mercadoPagoDeliveries().deliveries[0]?.headers
        ).not.toHaveProperty('x-signature');
    });

    it('sends charge secondary notices as IPN and counts refunds as skipped', async () => {
        const { provider, server, clock } = await setup();
        const created = await provider.authorize(input);
        server.mercadoPagoDeliveries();
        await provider.approve({ authorizationId: created.authorizationId });
        server.mercadoPagoDeliveries();
        const charge = await provider.charge({
            authorizationId: created.authorizationId,
            amount: input.amount,
            reference: 'cycle-1'
        });
        clock.set({ at: new Date(start.getTime() + 62 * 60_000) });
        const result = server.mercadoPagoDeliveries();
        const ipn = result.deliveries.find(({ channel }) => channel === 'IPN');
        expect(ipn?.query).toContain('topic=payment');
        expect(ipn?.query).toContain(`id=${charge.chargeId}`);
        expect(JSON.parse(ipn!.body)).toEqual({ resource: charge.chargeId, topic: 'payment' });
        expect(ipn!.query).not.toContain('source_news');
        expect(ipn!.headers).not.toHaveProperty('x-signature');

        const refundProvider = await setup();
        const auth = await refundProvider.provider.authorize({
            ...input,
            reference: 'refund-test'
        });
        await refundProvider.provider.approve({ authorizationId: auth.authorizationId });
        refundProvider.server.mercadoPagoDeliveries();
        const paid = await refundProvider.provider.charge({
            authorizationId: auth.authorizationId,
            amount: input.amount,
            reference: 'refund-cycle'
        });
        refundProvider.clock.set({ at: new Date(start.getTime() + 62 * 60_000) });
        await refundProvider.provider.readCharge({ chargeId: paid.chargeId });
        await refundProvider.provider.refund({
            chargeId: paid.chargeId,
            amount: input.amount,
            reference: 'refund'
        });
        expect(refundProvider.server.mercadoPagoDeliveries().skipped).toBeGreaterThan(0);
    });

    it('POSTs translated requests and reports non-2xx responses with the channel', async () => {
        const { provider, server } = await setup(true, true);
        const created = await provider.authorize(input);
        server.mercadoPagoDeliveries();
        await provider.approve({ authorizationId: created.authorizationId });
        const received: Array<{
            method?: string;
            url?: string;
            headers: typeof import('node:http').IncomingMessage.prototype.headers;
            body: string;
        }> = [];
        const receiver = createServer(async (request, response) => {
            const chunks: Buffer[] = [];
            for await (const chunk of request) chunks.push(Buffer.from(chunk));
            received.push({
                method: request.method,
                url: request.url,
                headers: request.headers,
                body: Buffer.concat(chunks).toString()
            });
            response.writeHead(204).end();
        });
        await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
        const address = receiver.address();
        if (!address || typeof address === 'string')
            throw new Error('listener address unavailable');
        try {
            const result = await server.deliverDueAsMercadoPago({
                to: `http://127.0.0.1:${address.port}/hook`,
                webhookSecret: 'secret'
            });
            expect(result).toEqual({ delivered: 1, skipped: 0 });
            expect(received[0]).toMatchObject({
                method: 'POST',
                url: expect.stringContaining('source_news=webhooks'),
                headers: { 'x-request-id': expect.any(String), 'x-signature': expect.any(String) }
            });
            expect(JSON.parse(received[0]!.body)).toHaveProperty(
                'data.id',
                created.authorizationId
            );
        } finally {
            receiver.closeAllConnections();
            await new Promise<void>((resolve, reject) =>
                receiver.close((error) => (error ? reject(error) : resolve()))
            );
        }

        const { provider: failingProvider, server: failingServer } = await setup(true);
        const other = await failingProvider.authorize({ ...input, reference: 'failed-delivery' });
        failingServer.mercadoPagoDeliveries();
        await failingProvider.approve({ authorizationId: other.authorizationId });
        const failingReceiver = createServer((_request, response) => response.writeHead(500).end());
        await new Promise<void>((resolve) => failingReceiver.listen(0, '127.0.0.1', resolve));
        const failedAddress = failingReceiver.address();
        if (!failedAddress || typeof failedAddress === 'string')
            throw new Error('listener address unavailable');
        try {
            await expect(
                failingServer.deliverDueAsMercadoPago({
                    to: `http://127.0.0.1:${failedAddress.port}`
                })
            ).rejects.toThrow(/WEBHOOKS.*HTTP 500/);
        } finally {
            failingReceiver.closeAllConnections();
            await new Promise<void>((resolve) => failingReceiver.close(() => resolve()));
        }
    });

    it('leaves the original fake delivery format available', async () => {
        const { provider, server } = await setup(true, true);
        const created = await provider.authorize(input);
        server.mercadoPagoDeliveries();
        await provider.approve({ authorizationId: created.authorizationId });
        const received: string[] = [];
        const receiver = createServer(async (request, response) => {
            received.push(request.headers['x-notice-channel'] as string);
            response.writeHead(204).end();
        });
        await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
        const address = receiver.address();
        if (!address || typeof address === 'string')
            throw new Error('listener address unavailable');
        try {
            expect(await server.deliverDue({ to: `http://127.0.0.1:${address.port}` })).toEqual({
                delivered: 1
            });
            expect(received).toEqual(['primary']);
        } finally {
            receiver.closeAllConnections();
            await new Promise<void>((resolve) => receiver.close(() => resolve()));
        }
    });
});
