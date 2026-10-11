import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectReadOnly } from '../../cutover/known-ids.ts';
import { createDeliveryReader, readDeliverySeen } from '../../cutover/notification-reader.ts';
import { runStep4b } from '../../cutover/run-step-4b.ts';
import { createFakeProvider } from '../cutover/fake-provider.ts';
import type { PgClient } from './scratch-db.ts';
import {
    applyMigrations,
    connect,
    createScratch,
    dropScratch,
    fingerprint,
    requireAdminUrl,
    withDatabase
} from './scratch-db.ts';

const suffix = randomBytes(4).toString('hex');
const DB_NAME = `cutover_u3_4b_${suffix}`;
let admin: PgClient;
let databaseUrl: string;

beforeAll(async () => {
    const adminUrl = requireAdminUrl();
    admin = await connect({ url: adminUrl });
    await createScratch({ admin, name: DB_NAME });
    databaseUrl = withDatabase({ url: adminUrl, database: DB_NAME });
    const client = await connect({ url: databaseUrl });
    await applyMigrations({ client, source: { kind: 'working-tree' } });
    await client.query(
        'INSERT INTO provider_notification (channel, url, body) VALUES ($1, $2, $3)',
        [
            'WEBHOOKS',
            'https://api.example.invalid/api/v1/webhooks/mercadopago?data.id=probe-1&type=subscription_preapproval&source_news=webhooks',
            '{"type":"subscription_preapproval","action":"updated","data":{"id":"probe-1"}}'
        ]
    );
    await client.query(
        'INSERT INTO provider_notification (channel, url, body) VALUES ($1, $2, $3)',
        [
            'IPN',
            'https://api.example.invalid/api/v1/webhooks/mercadopago?id=pay-1&topic=payment',
            '{"resource":"pay-1","topic":"payment"}'
        ]
    );
    await client.query(
        'INSERT INTO provider_notification (channel, url, body) VALUES ($1, $2, $3)',
        [
            'IPN',
            'https://api.example.invalid/api/v1/webhooks/mercadopago?id=pay-70&topic=payment',
            '{"resource":"pay-70","topic":"payment"}'
        ]
    );
    await client.query(
        'INSERT INTO provider_notification (channel, url, body) VALUES ($1, $2, $3)',
        [
            'WEBHOOKS',
            'https://api.example.invalid/api/v1/webhooks/mercadopago?data.id=pay-3&type=payment&source_news=webhooks',
            '{"data":{"id":"pay-3"}}'
        ]
    );
    await client.end();
}, 180_000);

afterAll(async () => {
    if (admin) {
        await dropScratch({ admin, name: DB_NAME });
        await admin.end();
    }
});

describe('TEST:U3:9 delivery lookup in the new database (AC:U3:8)', () => {
    it('waits for the IPN delivery, refunds and re-reads; missing delivery fails but still refunds', async () => {
        // Arrange
        const reader = createDeliveryReader({ connectionString: databaseUrl });
        const client = await connect({ url: databaseUrl });
        const before = await fingerprint({ client });
        await client.end();
        const withDelivery = createFakeProvider({ objects: [], paymentIds: ['pay-1'] });
        const withoutDelivery = createFakeProvider({ objects: [], paymentIds: ['pay-2'] });

        // Act
        const success = await runStep4b({
            api: withDelivery.api,
            readDelivery: reader,
            payment: {
                amountArs: 20,
                cardToken: 'card-token',
                paymentMethodId: 'visa',
                payerEmail: 'owner@example.invalid'
            },
            sleep: async () => {},
            deliveryWaitsMs: [0, 0]
        });
        const failed = await runStep4b({
            api: withoutDelivery.api,
            readDelivery: reader,
            payment: {
                amountArs: 20,
                cardToken: 'card-token',
                paymentMethodId: 'visa',
                payerEmail: 'owner@example.invalid'
            },
            sleep: async () => {},
            deliveryWaitsMs: [0, 0]
        });
        const afterClient = await connect({ url: databaseUrl });
        const after = await fingerprint({ client: afterClient });
        await afterClient.end();

        // Assert
        expect(success.ok).toBe(true);
        expect(withDelivery.calls).toContain('REFUND payment pay-1');
        expect(withDelivery.calls).toContain('GET refund refund-1');
        expect(success.manifest).toMatchObject({ paymentId: 'pay-1', refundId: 'refund-1' });
        expect(failed.ok).toBe(false);
        expect(failed.manifest.failures).toContainEqual(
            expect.objectContaining({ code: 'DELIVERY_NOT_SEEN', id: 'pay-2' })
        );
        expect(withoutDelivery.calls).toContain('REFUND payment pay-2');
        expect(withoutDelivery.calls).toContain('GET refund refund-1');
        expect(after).toEqual(before);
    });

    it('matches whole ids with both boundaries and requires the requested channel', async () => {
        // Arrange
        const client = await connectReadOnly({ connectionString: databaseUrl });

        // Act
        const rightBoundary = await readDeliverySeen({
            client,
            channel: 'IPN',
            resourceId: 'pay-7'
        });
        const leftBoundary = await readDeliverySeen({
            client,
            channel: 'IPN',
            resourceId: 'ay-70'
        });
        const exact = await readDeliverySeen({ client, channel: 'IPN', resourceId: 'pay-70' });
        const wrongChannel = await readDeliverySeen({
            client,
            channel: 'IPN',
            resourceId: 'pay-3'
        });
        const correctChannel = await readDeliverySeen({
            client,
            channel: 'WEBHOOKS',
            resourceId: 'pay-3'
        });
        await client.end();

        // Assert
        expect(rightBoundary).toBe(false);
        expect(leftBoundary).toBe(false);
        expect(exact).toBe(true);
        expect(wrongChannel).toBe(false);
        expect(correctChannel).toBe(true);
        expect(typeof exact).toBe('boolean');
    });

    it('opens a read-only connection that cannot insert notifications', async () => {
        // Arrange
        const client = await connectReadOnly({ connectionString: databaseUrl });

        // Act
        const attempt = client.query(
            'INSERT INTO provider_notification (channel, url, body) VALUES ($1, $2, $3)',
            ['IPN', 'https://example.invalid/?id=never', '{"resource":"never"}']
        );

        // Assert
        await expect(attempt).rejects.toMatchObject({ code: '25006' });
        await client.end();
    });
});
