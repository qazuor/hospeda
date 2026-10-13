import { eq, providerNotifications } from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';

afterAll(closeServiceTestPool);
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

describe('TEST:B3:36 (soporte) unsupported provider notice acknowledgment', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'acknowledges and stores an unsupported Webhooks notice',
        async () => {
            getServiceTestDb();
            const clock = { now: () => new Date('2026-10-12T12:00:00.000Z') };
            const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
            const url = `https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks&test=${crypto.randomUUID()}`;
            const result = await receiveProviderDelivery(
                {
                    url,
                    delivery: {
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            type: 'subscription_authorized_payment',
                            data: { id: 'fact-1' }
                        })
                    }
                },
                { provider, clock, beforeCancelNotice }
            );
            const [row] = await getServiceTestDb()
                .select()
                .from(providerNotifications)
                .where(eq(providerNotifications.url, url));

            expect(result).toEqual({ ack: 'OK', outcome: 'UNSUPPORTED_NOTICE' });
            expect(row).toMatchObject({ channel: 'WEBHOOKS', url });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'keeps unexpected decoder errors as ERROR/FAILED',
        async () => {
            getServiceTestDb();
            const clock = { now: () => new Date('2026-10-12T12:00:00.000Z') };
            const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
            vi.spyOn(provider, 'decodeNotice').mockRejectedValue(
                new PaymentProviderError({
                    code: 'UNAVAILABLE',
                    capability: 'notify',
                    message: 'provider unavailable'
                })
            );
            const url = `https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks&test=${crypto.randomUUID()}`;
            const result = await receiveProviderDelivery(
                { url, delivery: { headers: {}, body: '{"type":"payment"}' } },
                { provider, clock, beforeCancelNotice }
            );
            const [row] = await getServiceTestDb()
                .select()
                .from(providerNotifications)
                .where(eq(providerNotifications.url, url));

            expect(result).toEqual({ ack: 'ERROR', outcome: 'FAILED' });
            expect(row).toMatchObject({ channel: 'WEBHOOKS', url });
        }
    );
});
