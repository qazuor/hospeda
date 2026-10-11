import { eq, providerNotificationModel, providerNotifications } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { purgeProviderNotifications } from '../../../src/services/billing/notice/purge-provider-notifications.service.js';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';

afterAll(closeServiceTestPool);
const now = new Date('2026-10-01T03:00:00.000Z');
const clock = { now: () => new Date(now) };
const provider = new FakePaymentProvider({
    clock,
    idNamespace: crypto.randomUUID(),
    honestAbout: [{ lie: 'M1', why: 'storage fixture' }]
});
const decodeSpy = vi.spyOn(provider, 'decodeNotice').mockResolvedValue({
    resourceKind: 'authorization',
    resourceId: crypto.randomUUID(),
    version: '1'
});
const ports = {
    clock,
    provider,
    beforeCancelNotice: { beforeCancel: async () => 'SENT' as const }
};
const url = (suffix: string) => `https://api.example.test/api/v1/webhooks/mercadopago?t=${suffix}`;

describe('TEST:B3:22 provider delivery storage and retention', () => {
    it('stores each delivery with URL-derived channel, exact body, and arrival time; IPN has no provider activity', async () => {
        getServiceTestDb();
        const insertSpy = vi.spyOn(providerNotificationModel, 'insertDelivery');
        const token = crypto.randomUUID();
        const entries = [
            { url: `${url(token)}&topic=payment`, body: 'webhooks body' },
            { url: `${url(token)}&source_news=webhooks&attempt=1`, body: 'ipn body' },
            { url: `${url(token)}&source_news=webhooks&attempt=2`, body: 'ipn retry body' }
        ];
        for (const entry of entries)
            await receiveProviderDelivery(
                { url: entry.url, delivery: { headers: {}, body: entry.body } },
                ports
            );
        const rows = await getServiceTestDb()
            .select()
            .from(providerNotifications)
            .where(eq(providerNotifications.url, entries[0]!.url));
        expect(rows).toHaveLength(1);
        const all = await getServiceTestPool().query(
            'SELECT channel, url, body, received_at, xmin::text AS xmin FROM provider_notification WHERE url LIKE $1 ORDER BY id',
            [`%t=${token}%`]
        );
        const xminBeforeRetention = new Map(all.rows.map((row) => [row.url, row.xmin]));
        await purgeProviderNotifications({}, { clock });
        const retained = await getServiceTestPool().query(
            'SELECT url, xmin::text AS xmin FROM provider_notification WHERE url LIKE $1',
            [`%t=${token}%`]
        );
        expect(retained.rows.every((row) => xminBeforeRetention.get(row.url) === row.xmin)).toBe(
            true
        );
        const byUrl = new Map(all.rows.map((row) => [row.url, row]));
        expect(all.rows).toHaveLength(3);
        expect(entries.map((entry) => byUrl.get(entry.url)?.channel)).toEqual([
            'IPN',
            'WEBHOOKS',
            'WEBHOOKS'
        ]);
        expect(entries.map((entry) => byUrl.get(entry.url)?.body)).toEqual(
            entries.map((entry) => entry.body)
        );
        expect(
            all.rows.every((row) => new Date(row.received_at as string).getTime() === now.getTime())
        ).toBe(true);
        expect(provider.decodeNotice).toHaveBeenCalledTimes(2);
        expect(vi.spyOn(provider, 'readAuthorization')).not.toHaveBeenCalled();
        // The write-only model exposes no read method; each call inserts once.
        expect(insertSpy).toHaveBeenCalledTimes(3);
    });

    it('purges only rows strictly older than 180 days and does not update survivors', async () => {
        getServiceTestDb();
        const token = crypto.randomUUID();
        const urls = ['181', '180', '179'].map((age) => `${url(token)}&age=${age}`);
        const pool = getServiceTestPool();
        for (const [index, age] of [181, 180, 179].entries()) {
            const receivedAt = new Date(now.getTime() - age * 24 * 60 * 60 * 1000);
            await pool.query(
                'INSERT INTO provider_notification (channel, url, body, received_at) VALUES ($1, $2, $3, $4)',
                ['IPN', urls[index], 'raw', receivedAt]
            );
        }
        const before = await pool.query(
            'SELECT url, xmin::text AS xmin FROM provider_notification WHERE url LIKE $1',
            [`%t=${token}%`]
        );
        const result = await purgeProviderNotifications({}, { clock });
        expect(result.cutoff.getTime()).toBe(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        const after = await pool.query(
            'SELECT url, xmin::text AS xmin FROM provider_notification WHERE url LIKE $1',
            [`%t=${token}%`]
        );
        expect(after.rows.map((row) => row.url)).toEqual(urls.slice(1));
        expect(result.deleted).toBeGreaterThanOrEqual(1);
        expect(
            after.rows.every(
                (row) => before.rows.find((prior) => prior.url === row.url)?.xmin === row.xmin
            )
        ).toBe(true);
    });

    it('does not save invalid input and returns a save error for a rejected body', async () => {
        getServiceTestDb();
        const failedUrl = `${url(crypto.randomUUID())}&source_news=webhooks`;
        const decodeCalls = decodeSpy.mock.calls.length;
        const invalid = await receiveProviderDelivery(
            { url: '', delivery: { headers: {}, body: 'x' } },
            ports
        );
        expect(invalid.outcome).toBe('INVALID_DELIVERY');
        const failed = await receiveProviderDelivery(
            {
                url: failedUrl,
                delivery: { headers: {}, body: 'bad\u0000body' }
            },
            ports
        );
        expect(failed).toEqual({ ack: 'ERROR', outcome: 'DELIVERY_NOT_SAVED' });
        expect(decodeSpy).toHaveBeenCalledTimes(decodeCalls);
        const stored = await getServiceTestPool().query(
            'SELECT id FROM provider_notification WHERE url = $1',
            [failedUrl]
        );
        expect(stored.rows).toHaveLength(0);
    });
});
