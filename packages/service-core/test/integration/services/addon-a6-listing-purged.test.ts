import {
    and,
    domainEventModel,
    emailOutbox,
    eq,
    providerLinks,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    applyA6,
    cancelPurgedListingAddon
} from '../../../src/services/billing/addon/addon-instance-a6';
import { retryOurCancellation } from '../../../src/services/billing/reconciliation/sweep/our-cancellation-retry';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { createA6Fixture, retireA6Fixtures } from './support/addon-a6-fixtures';
import { seedComplementCharge } from './support/addon-orphan-fixtures';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';

afterEach(async () => {
    await retireA6Fixtures();
    await retirePurchaseFixtures();
    vi.restoreAllMocks();
});
afterAll(closeServiceTestPool);

describe('TEST:B10:7 AC:B10:6 A6 act and lost-push safety net', () => {
    it('discards a live listing without writing or cancelling', async () => {
        const h = await createA6Fixture({ status: 'ACTIVE' });
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const result = await cancelPurgedListingAddon(
            { instanceId: h.instanceId, correlationId: crypto.randomUUID() },
            h.ports
        );
        expect(result).toEqual({ outcome: 'DISCARDED' });
        expect((await h.readInstance())?.status).toBe('ACTIVE');
        expect(cancel).toHaveBeenCalledTimes(0);
    });

    it('consumes an ACTIVE recurring addon, closes S21 and sends its notice first', async () => {
        const h = await createA6Fixture({ status: 'ACTIVE' });
        await h.verticals.purgeListing({ listingId: h.listingId });
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const result = await cancelPurgedListingAddon(
            { instanceId: h.instanceId, correlationId: crypto.randomUUID() },
            h.ports
        );
        expect(result).toMatchObject({ outcome: 'CANCELLED', cancelCall: 'SENT' });
        expect((await h.readInstance())?.status).toBe('CANCELLED');
        expect((await h.readComplement())?.status).toBe('CANCELLED');
        expect(h.notices).toEqual(['REMOVED']);
        expect(h.beforeCancel).toHaveBeenCalledWith({
            subscriptionId: h.complementId,
            userId: h.f.ownerId,
            kind: 'ADDON_LISTING_PURGED'
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(h.beforeCancel.mock.invocationCallOrder[0]).toBeLessThan(
            cancel.mock.invocationCallOrder[0] ?? Infinity
        );
        expect(
            (
                await getServiceTestDb()
                    .select({ template: emailOutbox.template })
                    .from(emailOutbox)
                    .where(
                        and(
                            eq(emailOutbox.recipientUserId, h.f.ownerId),
                            eq(emailOutbox.template, 'billing.addon-listing-purged-cancel')
                        )
                    )
            ).map(({ template }) => template)
        ).toEqual(['billing.addon-listing-purged-cancel']);
        const decisions = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: h.complementId as string
        });
        expect(
            decisions
                .filter((event) => event.eventType === 'subscription.provider_cancellation_decided')
                .map((event) => event.reason)
        ).toEqual(['A6']);
    });

    it('cancels PENDING_AUTHORIZATION recurring without a REMOVED notice', async () => {
        const h = await createA6Fixture({ status: 'PENDING_AUTHORIZATION' });
        await h.verticals.purgeListing({ listingId: h.listingId });
        const result = await cancelPurgedListingAddon(
            { instanceId: h.instanceId, correlationId: crypto.randomUUID() },
            h.ports
        );
        expect(result.outcome).toBe('CANCELLED');
        expect((await h.readInstance())?.status).toBe('CANCELLED');
        expect((await h.readComplement())?.status).toBe('CANCELLED');
        expect(h.notices).toEqual([]);
    });

    it('uses S21 reason 14 for a paid complement period', async () => {
        const h = await createA6Fixture({ status: 'ACTIVE' });
        if (!h.complementId) throw new Error('Complement missing');
        // A credited complement charge is seeded to exercise S21's reason table.
        await getServiceTestDb().transaction((tx) =>
            seedComplementCharge(tx, {
                subscriptionId: h.complementId as string,
                coveredPeriodStart: h.f.ports.clock.now()
            })
        );
        await h.verticals.purgeListing({ listingId: h.listingId });
        await cancelPurgedListingAddon(
            { instanceId: h.instanceId, correlationId: crypto.randomUUID() },
            h.ports
        );
        expect((await h.readComplement())?.status).toBe('CANCELLED');
        expect(
            (
                await getServiceTestDb()
                    .select({ reason: reconciliationMarks.reason })
                    .from(reconciliationMarks)
                    .where(eq(reconciliationMarks.subscriptionId, h.complementId))
            ).map(({ reason }) => reason)
        ).toEqual(['COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA']);
    });

    it('cancels a pending one-time order locally without a provider cancellation', async () => {
        const h = await createA6Fixture({ status: 'PENDING_AUTHORIZATION', chargeKind: 'UNA_VEZ' });
        await h.verticals.purgeListing({ listingId: h.listingId });
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const result = await cancelPurgedListingAddon(
            { instanceId: h.instanceId, correlationId: crypto.randomUUID() },
            h.ports
        );
        expect(result.outcome).toBe('CANCELLED');
        expect((await h.readInstance())?.status).toBe('CANCELLED');
        expect(cancel).toHaveBeenCalledTimes(0);
    });

    it('keeps a deferred decision for retry with the same kind and one email', async () => {
        const h = await createA6Fixture({ status: 'ACTIVE' });
        await h.verticals.purgeListing({ listingId: h.listingId });
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const first = await cancelPurgedListingAddon(
            { instanceId: h.instanceId, correlationId: crypto.randomUUID() },
            {
                ...h.ports,
                beforeCancelNotice: {
                    beforeCancel: async (args) => {
                        await h.beforeCancel(args);
                        return 'NOT_YET_SENT';
                    }
                }
            }
        );
        expect(first).toMatchObject({ outcome: 'CANCELLED', cancelCall: 'NOTICE_PENDING' });
        expect((await h.readInstance())?.status).toBe('CANCELLED');
        expect((await h.readComplement())?.status).toBe('CANCELLED');
        expect(cancel).toHaveBeenCalledTimes(0);
        const [subscription] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, h.complementId as string));
        const [providerLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, h.complementId as string));
        if (!subscription || !providerLink) throw new Error('Retry row missing');
        await retryOurCancellation(
            {
                subscription,
                providerLink,
                decision: { transition: 'A6', decidedAt: h.f.ports.clock.now() },
                correlationId: crypto.randomUUID()
            },
            h.ports
        );
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(h.beforeCancel).toHaveBeenCalledTimes(2);
        expect(
            await getServiceTestDb()
                .select({ id: emailOutbox.id })
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, h.f.ownerId),
                        eq(emailOutbox.template, 'billing.addon-listing-purged-cancel')
                    )
                )
        ).toHaveLength(1);
    });

    it('writes one status event and returns NOT_LIVE on a second applyA6', async () => {
        const h = await createA6Fixture({ status: 'ACTIVE' });
        const first = await getServiceTestDb().transaction((tx) =>
            applyA6({ tx, instanceId: h.instanceId, now: h.f.ports.clock.now() }, h.ports)
        );
        const second = await getServiceTestDb().transaction((tx) =>
            applyA6({ tx, instanceId: h.instanceId, now: h.f.ports.clock.now() }, h.ports)
        );
        expect(first.outcome).toBe('CANCELLED');
        expect(second).toEqual({ outcome: 'NOT_LIVE' });
        const events = await domainEventModel.findByEntity({
            entityType: 'addon_instance',
            entityId: h.instanceId
        });
        expect(
            events
                .filter((event) => event.eventType === 'addon_instance.status_changed')
                .filter((event) => event.changes?.some((change) => change.new === 'CANCELLED'))
        ).toHaveLength(1);
        expect((await h.readInstance())?.status).toBe('CANCELLED');
    });
});
