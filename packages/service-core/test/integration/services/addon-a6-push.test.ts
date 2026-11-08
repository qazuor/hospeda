import {
    addonInstances,
    domainEventModel,
    eq,
    reconciliationInventoryModel,
    reconciliationZeroCallModel
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { CancelPurgedListingAddonPorts } from '../../../src/services/billing/addon/addon-instance-a6';
import { createListingPurgedAddonCanceller } from '../../../src/services/billing/addon/listing-purged-addon-canceller';
import {
    cancelAddonsOfPurgedListing,
    subscribeListingPurgedAddons
} from '../../../src/services/billing/addon/listing-purged-addons.service';
import { runZeroCallChecks } from '../../../src/services/billing/reconciliation/sweep/zero-call-checks.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { createA6Fixture, retireA6Fixtures } from './support/addon-a6-fixtures';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';

function isolateSweep(instanceId: string): void {
    vi.spyOn(
        reconciliationZeroCallModel,
        'listOpenSuccessionsOnDeadPredecessorsPage'
    ).mockResolvedValue([]);
    vi.spyOn(
        reconciliationZeroCallModel,
        'listDeferredCourtesiesWithActiveSuccessorPage'
    ).mockResolvedValue([]);
    vi.spyOn(reconciliationInventoryModel, 'listLiveAddonInstanceIdsPage').mockImplementation(
        async ({ afterInstanceId }) => (afterInstanceId ? [] : [{ id: instanceId }])
    );
}

async function sweep(
    h: Awaited<ReturnType<typeof createA6Fixture>>,
    ports: CancelPurgedListingAddonPorts = h.ports
): ReturnType<typeof runZeroCallChecks> {
    isolateSweep(h.instanceId);
    return runZeroCallChecks(
        { correlationId: crypto.randomUUID() },
        {
            addonOrphanhood: {
                ...h.f.ports,
                listingPurged: ports.listingPurged,
                listingPurgedAddons: createListingPurgedAddonCanceller(ports)
            }
        }
    );
}

async function statusEvents(instanceId: string): Promise<number> {
    const events = await domainEventModel.findByEntity({
        entityType: 'addon_instance',
        entityId: instanceId
    });
    return events.filter(
        (event) =>
            event.eventType === 'addon_instance.status_changed' &&
            event.changes?.some((change) => change.new === 'CANCELLED')
    ).length;
}

afterEach(async () => {
    await retireA6Fixtures();
    await retirePurchaseFixtures();
    vi.restoreAllMocks();
});
afterAll(closeServiceTestPool);

describe('TEST:B10:7 AC:B10:6 A6 committed push and daily safety net', () => {
    it('push consumes the active addon, closes S21 and sends the email before cancellation', async () => {
        const h = await createA6Fixture({ status: 'ACTIVE' });
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const stop = subscribeListingPurgedAddons(
            { onListingPurged: h.verticals.onListingPurged.bind(h.verticals) },
            h.ports
        );
        try {
            await h.verticals.purgeListing({ listingId: h.listingId });
            expect((await h.readInstance())?.status).toBe('CANCELLED');
            expect((await h.readComplement())?.status).toBe('CANCELLED');
            expect(cancel).toHaveBeenCalledTimes(1);
            expect(h.beforeCancel.mock.invocationCallOrder[0]).toBeLessThan(
                cancel.mock.invocationCallOrder[0] ?? Infinity
            );
            expect(await statusEvents(h.instanceId)).toBe(1);
        } finally {
            stop();
        }
    });

    it('selects both live states on this listing and leaves another listing live', async () => {
        const active = await createA6Fixture({ status: 'ACTIVE' });
        const pending = await createA6Fixture({ status: 'PENDING_AUTHORIZATION' });
        const other = await createA6Fixture({ status: 'ACTIVE' });
        // Seed only the target id to place a separately purchased pending addon on this listing.
        await getServiceTestDb()
            .update(addonInstances)
            .set({ targetId: active.listingId })
            .where(eq(addonInstances.id, pending.instanceId));
        const stop = subscribeListingPurgedAddons(
            { onListingPurged: active.verticals.onListingPurged.bind(active.verticals) },
            active.ports
        );
        try {
            await active.verticals.purgeListing({ listingId: active.listingId });
            expect((await active.readInstance())?.status).toBe('CANCELLED');
            expect((await pending.readInstance())?.status).toBe('CANCELLED');
            expect((await other.readInstance())?.status).toBe('ACTIVE');
        } finally {
            stop();
        }
    });

    it('discards a push while fichaPurgada still answers no', async () => {
        const h = await createA6Fixture({ status: 'ACTIVE' });
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const stop = subscribeListingPurgedAddons(
            { onListingPurged: h.verticals.onListingPurged.bind(h.verticals) },
            h.ports
        );
        try {
            await h.verticals.emitListingPurged({ event: { listingId: h.listingId } });
            expect(await cancelAddonsOfPurgedListing({ listingId: h.listingId }, h.ports)).toEqual({
                outcome: 'DISCARDED'
            });
            expect((await h.readInstance())?.status).toBe('ACTIVE');
            expect(cancel).toHaveBeenCalledTimes(0);
        } finally {
            stop();
        }
    });

    it('isolates one failed instance and continues with the next live instance', async () => {
        const first = await createA6Fixture({ status: 'PENDING_AUTHORIZATION' });
        const second = await createA6Fixture({ status: 'PENDING_AUTHORIZATION' });
        // Seed only the target id to put two separately purchased addons on one listing.
        await getServiceTestDb()
            .update(addonInstances)
            .set({ targetId: first.listingId })
            .where(eq(addonInstances.id, second.instanceId));
        await first.verticals.purgeListing({ listingId: first.listingId });
        let reads = 0;
        const result = await cancelAddonsOfPurgedListing(
            { listingId: first.listingId },
            {
                ...first.ports,
                listingPurged: async (input) => {
                    reads++;
                    if (reads === 2) throw new Error('injected one-row failure');
                    return first.ports.listingPurged(input);
                }
            }
        );
        expect(result).toEqual({ examined: 2, cancelled: 1, discarded: 0, failed: 1 });
        const states = [
            (await first.readInstance())?.status,
            (await second.readInstance())?.status
        ].sort();
        expect(states).toEqual(['CANCELLED', 'PENDING_AUTHORIZATION']);
    });

    it('examines only instances whose target id is the purged listing', async () => {
        const target = await createA6Fixture({ status: 'PENDING_AUTHORIZATION' });
        const other = await createA6Fixture({ status: 'PENDING_AUTHORIZATION' });
        await target.verticals.purgeListing({ listingId: target.listingId });
        expect(
            await cancelAddonsOfPurgedListing({ listingId: target.listingId }, target.ports)
        ).toEqual({ examined: 1, cancelled: 1, discarded: 0, failed: 0 });
        expect((await target.readInstance())?.status).toBe('CANCELLED');
        expect((await other.readInstance())?.status).toBe('PENDING_AUTHORIZATION');
    });

    it('recovers a lost push through the B5 safety net', async () => {
        const h = await createA6Fixture({ status: 'ACTIVE' });
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        await h.verticals.purgeListing({ listingId: h.listingId });
        await sweep(h);
        expect((await h.readInstance())?.status).toBe('CANCELLED');
        expect((await h.readComplement())?.status).toBe('CANCELLED');
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it.each([
        'push first',
        'sweep first'
    ] as const)('%s leaves one provider cancellation and one A6 event', async (order) => {
        const h = await createA6Fixture({ status: 'ACTIVE' });
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        let stop = subscribeListingPurgedAddons(
            { onListingPurged: h.verticals.onListingPurged.bind(h.verticals) },
            h.ports
        );
        try {
            if (order === 'push first') {
                await h.verticals.purgeListing({ listingId: h.listingId });
                await sweep(h);
            } else {
                stop();
                await h.verticals.purgeListing({ listingId: h.listingId });
                await sweep(h);
                stop = subscribeListingPurgedAddons(
                    { onListingPurged: h.verticals.onListingPurged.bind(h.verticals) },
                    h.ports
                );
                await h.verticals.emitListingPurged({ event: { listingId: h.listingId } });
            }
            expect((await h.readInstance())?.status).toBe('CANCELLED');
            expect(cancel).toHaveBeenCalledTimes(1);
            expect(await statusEvents(h.instanceId)).toBe(1);
        } finally {
            stop();
        }
    });

    it('parallel push and sweep still cancel the preapproval once', async () => {
        const h = await createA6Fixture({ status: 'ACTIVE' });
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        await h.verticals.purgeListing({ listingId: h.listingId });
        const slowPorts: CancelPurgedListingAddonPorts = {
            ...h.ports,
            listing: async (input) => {
                await new Promise((resolve) => setTimeout(resolve, 200));
                return h.ports.listing(input);
            }
        };
        const [pushed, checked] = await Promise.all([
            cancelAddonsOfPurgedListing({ listingId: h.listingId }, slowPorts),
            sweep(h, slowPorts)
        ]);
        expect(pushed).toMatchObject({ failed: 0 });
        expect(
            checked.results.find(({ check }) => check === 'ADDON_LIVE_ON_DEAD_TARGET')
        ).toMatchObject({ resolved: 1 });
        expect((await h.readInstance())?.status).toBe('CANCELLED');
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(await statusEvents(h.instanceId)).toBe(1);
    });

    it('a failing listener resolves the push and leaves the addon for the sweep', async () => {
        const h = await createA6Fixture({ status: 'ACTIVE' });
        const stop = subscribeListingPurgedAddons(
            { onListingPurged: h.verticals.onListingPurged.bind(h.verticals) },
            {
                ...h.ports,
                listingPurged: async () => {
                    throw new Error('injected reader failure');
                }
            }
        );
        try {
            await expect(
                h.verticals.purgeListing({ listingId: h.listingId })
            ).resolves.toBeUndefined();
            expect((await h.readInstance())?.status).toBe('ACTIVE');
            await sweep(h);
            expect((await h.readInstance())?.status).toBe('CANCELLED');
        } finally {
            stop();
        }
    });
});
