import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { domainEventModel } from '../../src/models/domain-event/domain-event.model.ts';
import { reconciliationInventoryModel as model } from '../../src/models/reconciliation-inventory/reconciliation-inventory.model.ts';
import { providerLinks } from '../../src/schemas/vertical/provider-link.dbschema.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

/** TEST:1955:6 — the age filter applies to the most recent decision and composes with unconfirmedOnly. */
describe('cancellation retry decision window', () => {
    it('selects recent terminal decisions and excludes cancellation-seen links', async () => {
        await withTestTransaction(async (tx) => {
            const now = new Date('2029-04-10T12:00:00.000Z');
            const day = 24 * 60 * 60 * 1000;
            const ids: string[] = [];
            for (const decidedAt of [
                new Date(now.getTime() - 4 * day),
                new Date(now.getTime() - 60 * 60 * 1000)
            ]) {
                const row = await model.insertReceiptTombstone({ tx });
                ids.push(row.id);
                await model.insertProviderLink({
                    subscriptionId: row.id,
                    provider: 'MERCADO_PAGO',
                    providerId: `retry-${crypto.randomUUID()}`,
                    tx
                });
                await domainEventModel.insert({
                    eventType: 'subscription.provider_cancellation_decided',
                    entityType: 'subscription',
                    entityId: row.id,
                    actorType: 'job',
                    correlationId: crypto.randomUUID(),
                    reason: 'RECEPTION_TOMBSTONE',
                    occurredAt: decidedAt,
                    tx
                });
            }
            const owned = async (input: { decidedSince?: Date; unconfirmedOnly?: boolean }) =>
                (await model.listCancellationRetryPage({ ...input, limit: 10_000, tx }))
                    .filter((row) => ids.includes(row.subscription.id))
                    .map((row) => row.subscription.id);
            const since = new Date(now.getTime() - 3 * day);
            expect(await owned({ decidedSince: since })).toEqual([ids[1]]);
            expect(new Set(await owned({}))).toEqual(new Set(ids));
            await tx
                .update(providerLinks)
                .set({ cancelledSeenAt: now })
                .where(eq(providerLinks.subscriptionId, ids[1]!));
            expect(await owned({ decidedSince: since, unconfirmedOnly: true })).toEqual([]);
        });
    });
});
