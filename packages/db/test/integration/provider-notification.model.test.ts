import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
    ProviderNotificationModel,
    providerNotificationModel
} from '../../src/models/provider-notification/index.ts';
import { providerNotifications } from '../../src/schemas/vertical/provider-notification.dbschema.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

describe('provider notification write model', () => {
    it('insertDelivery returns the row with the supplied arrival instant', async () => {
        await withTestTransaction(async (tx) => {
            const receivedAt = new Date('2026-01-02T03:04:05.678Z');
            const url = `https://example.test/notice?insert=${crypto.randomUUID()}`;
            const row = await providerNotificationModel.insertDelivery({
                channel: 'WEBHOOKS',
                url,
                body: '{"raw":true}',
                receivedAt,
                tx
            });
            expect(row).toMatchObject({ channel: 'WEBHOOKS', url, body: '{"raw":true}' });
            expect(row.receivedAt.toISOString()).toBe(receivedAt.toISOString());
        });
    });

    it('deleteReceivedBefore deletes only this test’s rows strictly before the cutoff', async () => {
        await withTestTransaction(async (tx) => {
            const url = `https://example.test/notice?delete=${crypto.randomUUID()}`;
            const cutoff = new Date('2026-05-01T00:00:00.000Z');
            const dates = [
                new Date('2026-04-30T23:59:59.999Z'),
                cutoff,
                new Date('2026-05-01T00:00:00.001Z')
            ];
            for (const [index, receivedAt] of dates.entries()) {
                await providerNotificationModel.insertDelivery({
                    channel: 'IPN',
                    url: `${url}&row=${index}`,
                    body: '',
                    receivedAt,
                    tx
                });
            }
            const result = await providerNotificationModel.deleteReceivedBefore({ cutoff, tx });
            const remaining = await tx
                .select({ receivedAt: providerNotifications.receivedAt })
                .from(providerNotifications)
                .where(eq(providerNotifications.url, `${url}&row=0`));
            const ownRows = await tx
                .select({
                    url: providerNotifications.url,
                    receivedAt: providerNotifications.receivedAt
                })
                .from(providerNotifications)
                .where(eq(providerNotifications.url, `${url}&row=1`));
            const newest = await tx
                .select({
                    url: providerNotifications.url,
                    receivedAt: providerNotifications.receivedAt
                })
                .from(providerNotifications)
                .where(eq(providerNotifications.url, `${url}&row=2`));
            expect(result.deleted).toBe(1);
            expect(remaining).toHaveLength(0);
            expect(ownRows[0]?.receivedAt.toISOString()).toBe(cutoff.toISOString());
            expect(newest[0]?.receivedAt.toISOString()).toBe(dates[2]?.toISOString());
        });
    });

    it('exposes exactly the two write methods', () => {
        expect(
            Object.getOwnPropertyNames(ProviderNotificationModel.prototype).filter(
                (name) => name !== 'constructor'
            )
        ).toEqual(['insertDelivery', 'deleteReceivedBefore']);
    });
});
