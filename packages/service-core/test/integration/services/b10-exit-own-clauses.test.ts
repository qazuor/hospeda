import { addonInstances, and, domainEventModel, eq, payments, subscriptions } from '@repo/db';
import { encodeFakeNotice } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { applyA2Recurring } from '../../../src/services/billing/addon/addon-instance-a2';
import { runOrphanhood } from '../../../src/services/billing/addon/addon-instance-a5';
import { subscribeListingPurgedAddons } from '../../../src/services/billing/addon/listing-purged-addons.service';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service';
import { expireAuthorizationWindows } from '../../../src/services/billing/subscription/expire-authorization-windows.service';
import { revokeSubscription } from '../../../src/services/billing/subscription/revoke-subscription.service';
import { startSuccession } from '../../../src/services/billing/subscription/start-succession.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import {
    listingExitFixture,
    pendingRecurringExitFixture,
    retireExitFixtures,
    upgradeOptionFrom
} from './support/b10-exit-fixtures';
import { retireRevocationRows, seedRevocationActor } from './support/revocation-fixtures';
import {
    seededSubscriptionIds,
    withSeededSubscriptionSweep
} from './support/subscription-window-sweep';
import { noTouristVip } from './support/tourist-vip';

afterEach(async () => {
    await retireExitFixtures();
    await retireRevocationRows();
    seededSubscriptionIds.clear();
    vi.restoreAllMocks();
});
afterAll(closeServiceTestPool);

describe('TEST:B10:10 AC:B10:9 LISTA:B10 own clauses over rows created by A1', () => {
    /** Revokes the paying principal while its A1 complement is awaiting authorization. */
    async function revokeOpenCheckout() {
        const h = await pendingRecurringExitFixture();
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const result = await revokeSubscription(
            {
                actor: await seedRevocationActor(),
                subscriptionId: h.principalId,
                expectedPaymentId: h.principalPaymentId
            },
            {
                provider: h.f.fake,
                clock: h.f.ports.clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                coverageNotices: { emitCoverageChanged: async () => {} },
                orphanhood: h.f.ports
            }
        );
        expect(result.orphanedAddonIds).toEqual([h.instanceId]);
        expect(
            cancel.mock.calls.filter(([input]) => input.authorizationId === h.authorizationId)
        ).toHaveLength(1);
        return h;
    }

    it('LISTA:B10 clause 8 un addon cuyo título muere mientras su checkout está abierto no llega a cobrar nunca —se le cancela el preapproval esperando autorización, y si igual autoriza, el barrido lo encuentra vivo con el objetivo muerto (`03` §8, `16` §4.2 y §4.3, `09` §3 cuarta comprobación)— (checkout open)', async () => {
        const h = await revokeOpenCheckout();
        const [instance] = await getServiceTestDb()
            .select({ status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, h.instanceId));
        expect(instance?.status).toBe('CANCELLED');
        expect(
            await getServiceTestDb()
                .select({ id: payments.id })
                .from(payments)
                .where(eq(payments.addonInstanceId, h.instanceId))
        ).toHaveLength(0);
        const events = await domainEventModel.findByEntity({
            entityType: 'addon_instance',
            entityId: h.instanceId
        });
        expect(
            events
                .filter(
                    ({ eventType, changes }) =>
                        eventType === 'addon_instance.status_changed' &&
                        changes?.some(({ new: next }) => next === 'CANCELLED')
                )
                .map(({ changes }) => changes)
        ).toEqual([[{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'CANCELLED' }]]);
    });

    /**
     * El marcado ADDON_SIN_APAGAR de una fila viva con objetivo muerto ya lo cubre
     * reconciliation-addon-without-shutdown.test.ts:153; esta rama prueba que esa
     * fila no nace por el camino real.
     */
    it('LISTA:B10 clause 8 un addon cuyo título muere mientras su checkout está abierto no llega a cobrar nunca —se le cancela el preapproval esperando autorización, y si igual autoriza, el barrido lo encuentra vivo con el objetivo muerto (`03` §8, `16` §4.2 y §4.3, `09` §3 cuarta comprobación)— (late authorization)', async () => {
        const h = await revokeOpenCheckout();
        const emit = vi.fn(async () => {});
        const before = await domainEventModel.findByEntity({
            entityType: 'addon_instance',
            entityId: h.instanceId
        });
        const notice = encodeFakeNotice({
            notice: { resourceKind: 'authorization', resourceId: h.authorizationId, version: '1' },
            format: 'json'
        });
        const delivered = await processProviderNotice(
            {
                channel: 'WEBHOOKS',
                delivery: { headers: { 'content-type': 'application/json' }, body: notice.body }
            },
            {
                provider: h.f.fake,
                clock: h.f.ports.clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                complements: h.f.ports,
                coverageNotices: { emitCoverageChanged: emit }
            }
        );
        expect(delivered.ack).toBe('OK');
        const [instance] = await getServiceTestDb()
            .select({ status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, h.instanceId));
        expect(instance?.status).toBe('CANCELLED');
        const after = await domainEventModel.findByEntity({
            entityType: 'addon_instance',
            entityId: h.instanceId
        });
        expect(
            after.filter(({ eventType }) => eventType === 'addon_instance.status_changed')
        ).toHaveLength(
            before.filter(({ eventType }) => eventType === 'addon_instance.status_changed').length
        );
        expect(emit).not.toHaveBeenCalled();
        expect(
            await getServiceTestDb()
                .select({ id: payments.id })
                .from(payments)
                .where(eq(payments.addonInstanceId, h.instanceId))
        ).toHaveLength(0);

        // A stale authorization reader can race with S21. Re-open only the complement
        // state to reach A2's instance guard; the cancelled instance must stay terminal.
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'PENDING_AUTHORIZATION' })
            .where(eq(subscriptions.id, h.complementId));
        const late = await getServiceTestDb().transaction((tx) =>
            applyA2Recurring(
                { tx, complementSubscriptionId: h.complementId, now: h.f.ports.clock.now() },
                h.f.ports
            )
        );
        expect(late.outcome).toBe('NOT_APPLICABLE');
        const [stillCancelled] = await getServiceTestDb()
            .select({ status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, h.instanceId));
        expect(stillCancelled?.status).toBe('CANCELLED');
        const finalEvents = await domainEventModel.findByEntity({
            entityType: 'addon_instance',
            entityId: h.instanceId
        });
        expect(
            finalEvents.filter(({ eventType }) => eventType === 'addon_instance.status_changed')
        ).toHaveLength(
            before.filter(({ eventType }) => eventType === 'addon_instance.status_changed').length
        );
        expect(emit).not.toHaveBeenCalled();
        expect(
            await getServiceTestDb()
                .select({ id: payments.id })
                .from(payments)
                .where(eq(payments.addonInstanceId, h.instanceId))
        ).toHaveLength(0);
    });

    it('LISTA:B10 clause 11 4c an abandoned upgrade does not orphan the LISTING of a paying owner', async () => {
        const h = await listingExitFixture('ACTIVE');
        const [principal] = await getServiceTestDb()
            .select({ id: subscriptions.id, billingOptionId: subscriptions.billingOptionId })
            .from(subscriptions)
            .where(
                and(
                    eq(subscriptions.userId, h.f.ownerId),
                    eq(subscriptions.class, 'PRINCIPAL'),
                    eq(subscriptions.status, 'ACTIVE')
                )
            );
        if (!principal?.billingOptionId) throw new Error('Paying principal missing');
        const upgradeOptionId = await upgradeOptionFrom(principal.billingOptionId);
        const successor = await startSuccession(
            {
                userId: h.f.ownerId,
                billingOptionId: upgradeOptionId,
                predecessorSubscriptionId: principal.id,
                payerEmail: 'payer@example.test',
                returnUrl: 'https://example.test/return'
            },
            {
                provider: h.f.fake,
                clock: h.f.ports.clock,
                planPolicy: async () => ({
                    graceDays: 10,
                    allowsPause: false,
                    current: true,
                    sellable: true
                }),
                touristVipInheritance: noTouristVip,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' }
            }
        );
        seededSubscriptionIds.add(successor.subscriptionId);
        const [pending] = await getServiceTestDb()
            .select({ windowEndsAt: subscriptions.authorizationWindowEndsAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, successor.subscriptionId));
        if (!pending?.windowEndsAt) throw new Error('Successor window missing');
        h.f.advanceTo(new Date(pending.windowEndsAt.getTime() + 60_000));
        const expiry = await withSeededSubscriptionSweep(20, () =>
            expireAuthorizationWindows(20, {
                provider: h.f.fake,
                clock: h.f.ports.clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                touristVipInheritance: noTouristVip
            })
        );
        expect(expiry.abandoned).toBe(1);
        const result = await getServiceTestDb().transaction((tx) =>
            runOrphanhood(
                { tx, subscriptionId: successor.subscriptionId, now: h.f.ports.clock.now() },
                h.f.ports
            )
        );
        expect(result.cancelled).toEqual([]);
        const [instance] = await getServiceTestDb()
            .select({
                id: addonInstances.id,
                status: addonInstances.status,
                complementSubscriptionId: addonInstances.complementSubscriptionId
            })
            .from(addonInstances)
            .where(eq(addonInstances.id, h.instanceId));
        expect(instance).toEqual({
            id: h.instanceId,
            status: 'ACTIVE',
            complementSubscriptionId: h.complementId
        });
        const [complement] = await getServiceTestDb()
            .select({ id: subscriptions.id, status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, h.complementId as string));
        expect(complement).toEqual({ id: h.complementId, status: 'ACTIVE' });
        const events = await domainEventModel.findByEntity({
            entityType: 'addon_instance',
            entityId: h.instanceId
        });
        expect(
            events.filter(
                ({ eventType, changes }) =>
                    eventType === 'addon_instance.status_changed' &&
                    changes?.some(({ new: next }) => next === 'CANCELLED')
            )
        ).toHaveLength(0);
    });

    it('LISTA:B10 clause 11 K-9 purging the listing is executed only by A6', async () => {
        const h = await listingExitFixture('ACTIVE');
        const stop = subscribeListingPurgedAddons(
            { onListingPurged: h.verticals.onListingPurged.bind(h.verticals) },
            h.ports
        );
        try {
            await h.verticals.purgeListing({ listingId: h.listingId });
        } finally {
            stop();
        }
        const [instance] = await getServiceTestDb()
            .select({
                id: addonInstances.id,
                status: addonInstances.status,
                complementSubscriptionId: addonInstances.complementSubscriptionId,
                updatedAt: addonInstances.updatedAt
            })
            .from(addonInstances)
            .where(eq(addonInstances.id, h.instanceId));
        expect(instance).toEqual({
            id: h.instanceId,
            status: 'CANCELLED',
            complementSubscriptionId: h.complementId,
            updatedAt: expect.any(Date)
        });
        const [complement] = await getServiceTestDb()
            .select({ id: subscriptions.id, status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, h.complementId as string));
        expect(complement).toEqual({ id: h.complementId, status: 'CANCELLED' });
        const instanceEvents = await domainEventModel.findByEntity({
            entityType: 'addon_instance',
            entityId: h.instanceId
        });
        expect(
            instanceEvents
                .filter(({ eventType }) => eventType === 'addon_instance.status_changed')
                .map(({ actorType, changes }) => ({ actorType, changes }))
        ).toEqual([
            {
                actorType: 'owner',
                changes: [{ field: 'status', old: null, new: 'PENDING_AUTHORIZATION' }]
            },
            {
                actorType: 'provider',
                changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ACTIVE' }]
            },
            { actorType: 'job', changes: [{ field: 'status', old: 'ACTIVE', new: 'CANCELLED' }] }
        ]);
        const complementEvents = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: h.complementId as string
        });
        expect(
            complementEvents
                .filter(
                    ({ eventType }) => eventType === 'subscription.provider_cancellation_decided'
                )
                .map(({ reason }) => reason)
        ).toEqual(['A6']);
        expect(
            complementEvents
                .filter(
                    ({ eventType }) => eventType === 'subscription.provider_cancellation_decided'
                )
                .filter(({ reason }) => reason === 'A4' || reason === 'A5')
        ).toHaveLength(0);
    });
});
