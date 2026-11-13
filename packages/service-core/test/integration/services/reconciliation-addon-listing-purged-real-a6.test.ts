import {
    and,
    domainEventModel,
    emailOutbox,
    eq,
    reconciliationInventoryModel,
    reconciliationMarks,
    reconciliationZeroCallModel
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createListingPurgedAddonCanceller } from '../../../src/services/billing/addon/listing-purged-addon-canceller';
import { runZeroCallChecks } from '../../../src/services/billing/reconciliation/sweep/zero-call-checks.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { createA6Fixture, retireA6Fixtures } from './support/addon-a6-fixtures';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';

function isolateUnrelatedChecks(instanceId: string): void {
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

afterEach(async () => {
    await retireA6Fixtures();
    await retirePurchaseFixtures();
    vi.restoreAllMocks();
});
afterAll(closeServiceTestPool);

describe('TEST:B10:12 AC:B10:10 B5 fourth check invokes real A6', () => {
    it('recovers a lost PURGED push once, closes both rows, and leaves no ADDON_SIN_APAGAR mark', async () => {
        const h = await createA6Fixture({ status: 'ACTIVE' });
        await h.verticals.purgeListing({ listingId: h.listingId });
        isolateUnrelatedChecks(h.instanceId);
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const addonOrphanhood = {
            ...h.f.ports,
            listingPurged: h.ports.listingPurged,
            listingPurgedAddons: createListingPurgedAddonCanceller(h.ports)
        };
        const first = await runZeroCallChecks(
            { correlationId: crypto.randomUUID() },
            { addonOrphanhood }
        );
        expect(
            first.results.find(({ check }) => check === 'ADDON_LIVE_ON_DEAD_TARGET')?.resolved
        ).toBeGreaterThanOrEqual(1);
        expect((await h.readInstance())?.status).toBe('CANCELLED');
        expect((await h.readComplement())?.status).toBe('CANCELLED');
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
                .filter(
                    ({ eventType }) => eventType === 'subscription.provider_cancellation_decided'
                )
                .map(({ reason }) => reason)
        ).toEqual(['A6']);
        expect(
            await getServiceTestDb()
                .select({ id: reconciliationMarks.id })
                .from(reconciliationMarks)
                .where(eq(reconciliationMarks.subscriptionId, h.complementId as string))
        ).toEqual([]);
        await runZeroCallChecks({ correlationId: crypto.randomUUID() }, { addonOrphanhood });
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('opens ADDON_SIN_APAGAR when A6 transaction fails', async () => {
        const h = await createA6Fixture({ status: 'ACTIVE' });
        await h.verticals.purgeListing({ listingId: h.listingId });
        isolateUnrelatedChecks(h.instanceId);
        const failed = createListingPurgedAddonCanceller({
            ...h.ports,
            listing: async () => {
                throw new Error('A6 transaction failed');
            }
        });
        const summary = await runZeroCallChecks(
            { correlationId: crypto.randomUUID() },
            {
                addonOrphanhood: {
                    ...h.f.ports,
                    listingPurged: h.ports.listingPurged,
                    listingPurgedAddons: failed
                }
            }
        );
        expect(
            summary.results.find(({ check }) => check === 'ADDON_LIVE_ON_DEAD_TARGET')?.marksOpened
        ).toBeGreaterThanOrEqual(1);
        expect((await h.readInstance())?.status).toBe('ACTIVE');
        expect(
            (
                await getServiceTestDb()
                    .select({ reason: reconciliationMarks.reason })
                    .from(reconciliationMarks)
                    .where(eq(reconciliationMarks.subscriptionId, h.complementId as string))
            ).map(({ reason }) => reason)
        ).toEqual(['ADDON_SIN_APAGAR']);
    });
});
