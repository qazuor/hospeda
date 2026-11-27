/**
 * HOS-2668 part 2 (owner decision): a rejected charge of a recurring add-on purchase that is still
 * `PENDING_AUTHORIZATION` mirrors S16's pending-signup branch (HOS-1731). The pair (COMPLEMENTO +
 * addon instance) is released ONLY when the fresh re-read already sees the preapproval
 * `cancelled`, and then no cancel call is made. A `pending` or `active` preapproval, or a credited
 * payment, leaves both rows exactly as they are (§1.2). `addon_charge_declined` is always emitted,
 * even when the release cannot read the provider, and no before-cancel notice is asked for.
 */
import {
    addonInstances,
    and,
    domainEvent,
    eq,
    payments,
    providerLinks,
    subscriptions
} from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { releaseDeclinedPendingComplement } from '../../../src/services/billing/addon/declined-pending-complement';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { addonFactSpy, addonFactSubjectOf } from './support/addon-fact-subject';
import {
    principalFixture,
    purchaseFixture,
    purchaseFixtureInstances,
    purchaseNow,
    retirePurchaseFixtures
} from './support/addon-purchase-fixtures';

const skip = !isServiceTestDbAvailable();
afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

type Fixture = Awaited<ReturnType<typeof purchaseFixture>>;

async function pendingPurchase(f: Fixture) {
    await principalFixture({ ownerId: f.ownerId, credited: true });
    const created = await purchaseAddon(f.input(), f.ports);
    if (created.outcome !== 'CREATED') throw new Error('Expected a created purchase');
    const [instance] = await purchaseFixtureInstances(f.ownerId);
    const complementId = instance?.complementSubscriptionId;
    if (!instance || !complementId) throw new Error('Complement missing');
    const [link] = await getServiceTestDb()
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, complementId));
    if (!link) throw new Error('Preapproval missing');
    return { instanceId: instance.id, complementId, authorizationId: link.providerId };
}

function chargePorts(f: Fixture, sink: ReturnType<typeof addonFactSpy>['sink']) {
    const beforeCancel = vi.fn(async () => 'SENT' as const);
    return {
        beforeCancel,
        ports: {
            provider: f.fake,
            clock: f.ports.clock,
            beforeCancelNotice: { beforeCancel },
            coverageNotices: { emitCoverageChanged: async () => {} },
            complements: f.ports,
            billingFacts: sink
        }
    };
}

/** The full instance and complement rows, to prove a path wrote nothing to either. */
async function pairRows(input: { readonly instanceId: string; readonly complementId: string }) {
    const db = getServiceTestDb();
    const [instance] = await db
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, input.instanceId));
    const [complement] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.complementId));
    return { instance, complement };
}

async function pairStatus(input: { readonly instanceId: string; readonly complementId: string }) {
    const { instance, complement } = await pairRows(input);
    return { instance: instance?.status, complement: complement?.status };
}

async function eventsOf(
    entityId: string,
    eventType: 'subscription.provider_cancellation_decided' | 'addon_instance.status_changed'
) {
    return getServiceTestDb()
        .select({
            reason: domainEvent.reason,
            actorType: domainEvent.actorType,
            changes: domainEvent.changes
        })
        .from(domainEvent)
        .where(and(eq(domainEvent.entityId, entityId), eq(domainEvent.eventType, eventType)));
}

async function declined(f: Fixture, authorizationId: string) {
    return f.fake.declineCharge({
        authorizationId,
        declineReason: 'cc_rejected_insufficient_amount'
    });
}

describe('HOS-2668 a rejected charge of a pending recurring add-on purchase', () => {
    it.skipIf(skip)(
        'leaves both rows exactly as they are when the preapproval still reads pending',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const pending = await pendingPurchase(f);
            const before = await pairRows(pending);
            const { chargeId } = await declined(f, pending.authorizationId);
            const spy = addonFactSpy();
            const { ports, beforeCancel } = chargePorts(f, spy.sink);
            const cancel = vi.spyOn(f.fake, 'cancel');

            // Act
            const result = await recordChargeFact({ chargeId }, ports);

            // Assert
            expect(result.outcome).toBe('DECLINED');
            expect(await pairRows(pending)).toEqual(before);
            expect(cancel).not.toHaveBeenCalled();
            expect(beforeCancel).not.toHaveBeenCalled();
            expect(spy.addonFacts().map(({ kind }) => kind)).toEqual(['ADDON_CHARGE_REJECTED']);
        }
    );

    it.skipIf(skip)('never releases when the preapproval reads authorized', async () => {
        // Arrange
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        const pending = await pendingPurchase(f);
        await f.fake.approve({ authorizationId: pending.authorizationId });
        const before = await pairRows(pending);
        const { chargeId } = await declined(f, pending.authorizationId);
        const { ports } = chargePorts(f, addonFactSpy().sink);
        const cancel = vi.spyOn(f.fake, 'cancel');

        // Act
        await recordChargeFact({ chargeId }, ports);

        // Assert
        expect(await pairRows(pending)).toEqual(before);
        expect(cancel).not.toHaveBeenCalled();
    });

    it.skipIf(skip)(
        'releases the pair without any cancel call when the preapproval already reads cancelled',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const pending = await pendingPurchase(f);
            await f.fake.cancel({ authorizationId: pending.authorizationId });
            const { chargeId } = await declined(f, pending.authorizationId);
            const spy = addonFactSpy();
            const { ports, beforeCancel } = chargePorts(f, spy.sink);
            const cancel = vi.spyOn(f.fake, 'cancel');
            const before = await addonFactSubjectOf({ instanceId: pending.instanceId });
            const releasedAt = new Date(before.instance.createdAt.getTime() + 120_000);
            f.advanceTo(releasedAt);

            // Act
            const result = await recordChargeFact({ chargeId }, ports);

            // Assert
            expect(result.outcome).toBe('DECLINED');
            expect(await pairStatus(pending)).toEqual({
                instance: 'ABANDONED',
                complement: 'ABANDONED'
            });
            expect(cancel).not.toHaveBeenCalled();
            expect(beforeCancel).not.toHaveBeenCalled();
            expect(
                await eventsOf(pending.complementId, 'subscription.provider_cancellation_decided')
            ).toEqual([]);
            const abandoned = (
                await eventsOf(pending.instanceId, 'addon_instance.status_changed')
            ).filter((event) => JSON.stringify(event.changes).includes('"new":"ABANDONED"'));
            expect(abandoned).toEqual([
                {
                    reason: null,
                    actorType: 'provider',
                    changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }]
                }
            ]);
            // A9 emits addon_checkout_abandoned once, by the system, after addon_charge_declined.
            const [rejected, ...rest] = spy.addonFacts();
            expect(rejected?.kind).toBe('ADDON_CHARGE_REJECTED');
            expect(rest).toEqual([
                {
                    kind: 'ADDON_CHECKOUT_ABANDONED',
                    ...before.subject,
                    actorKind: 'SYSTEM',
                    occurredAt: releasedAt,
                    reason: 'CLOSED_BY_SYSTEM',
                    secondsInPending: 120
                }
            ]);
        }
    );

    it.skipIf(skip)('does not release a complement that has a credited payment', async () => {
        // Arrange
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        const pending = await pendingPurchase(f);
        await f.fake.cancel({ authorizationId: pending.authorizationId });
        await getServiceTestDb()
            .insert(payments)
            .values({
                subscriptionId: pending.complementId,
                amount: 5000,
                currency: 'ARS',
                status: 'SUCCEEDED',
                provider: 'fake',
                providerFactId: `hos2668-${crypto.randomUUID()}`,
                factAt: purchaseNow
            });
        const [complement] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, pending.complementId));
        if (!complement) throw new Error('Complement missing');
        const before = await pairRows(pending);
        const read = vi.spyOn(f.fake, 'readAuthorization');

        // Act
        const result = await releaseDeclinedPendingComplement(
            { subscription: complement, authorizationId: pending.authorizationId },
            f.ports
        );

        // Assert
        expect(result).toEqual({ released: false });
        expect(read).not.toHaveBeenCalled();
        expect(await pairRows(pending)).toEqual(before);
    });

    it.skipIf(skip)('re-checks the credited payment inside the release transaction', async () => {
        // Arrange: the payment is credited after the first check and before the release.
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        const pending = await pendingPurchase(f);
        await f.fake.cancel({ authorizationId: pending.authorizationId });
        await getServiceTestDb()
            .insert(payments)
            .values({
                subscriptionId: pending.complementId,
                amount: 5000,
                currency: 'ARS',
                status: 'SUCCEEDED',
                provider: 'fake',
                providerFactId: `hos2668-${crypto.randomUUID()}`,
                factAt: purchaseNow
            });
        const [complement] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, pending.complementId));
        if (!complement) throw new Error('Complement missing');
        const before = await pairRows(pending);
        const credited = vi
            .spyOn(creditedPaymentsFromLedger, 'hasCreditedPayment')
            .mockResolvedValueOnce(false);

        // Act
        const result = await releaseDeclinedPendingComplement(
            { subscription: complement, authorizationId: pending.authorizationId },
            f.ports
        );

        // Assert
        expect(result).toEqual({ released: false });
        expect(credited).toHaveBeenCalledTimes(2);
        expect(await pairRows(pending)).toEqual(before);
    });

    it.skipIf(skip)('leaves a PRINCIPAL untouched and reads nothing', async () => {
        // Arrange
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        const principalId = await principalFixture({ ownerId: f.ownerId });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'PENDING_AUTHORIZATION' })
            .where(eq(subscriptions.id, principalId));
        const [principal] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, principalId));
        if (!principal) throw new Error('Principal missing');
        const read = vi.spyOn(f.fake, 'readAuthorization');

        // Act
        const result = await releaseDeclinedPendingComplement(
            { subscription: principal, authorizationId: 'any-authorization' },
            f.ports
        );

        // Assert
        expect(result).toEqual({ released: false });
        expect(read).not.toHaveBeenCalled();
        const [after] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, principalId));
        expect(after).toEqual(principal);
    });

    it.skipIf(skip)(
        'still emits addon_charge_declined when the release cannot read the preapproval',
        async () => {
            // Arrange
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            const pending = await pendingPurchase(f);
            const before = await pairRows(pending);
            const { chargeId } = await declined(f, pending.authorizationId);
            vi.spyOn(f.fake, 'readAuthorization').mockRejectedValue(
                new PaymentProviderError({
                    capability: 'read',
                    code: 'UNAVAILABLE',
                    message: 'Down in the fake provider',
                    transient: { kind: 'UNAVAILABLE' }
                })
            );
            const spy = addonFactSpy();
            const { ports } = chargePorts(f, spy.sink);

            // Act
            const result = await recordChargeFact({ chargeId }, ports);

            // Assert
            expect(result.outcome).toBe('DECLINED');
            expect(spy.addonFacts().map(({ kind }) => kind)).toEqual(['ADDON_CHARGE_REJECTED']);
            expect(await pairRows(pending)).toEqual(before);
        }
    );

    it.skipIf(skip)('lets the owner start a fresh checkout right after a release', async () => {
        // Arrange
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        const pending = await pendingPurchase(f);
        await f.fake.cancel({ authorizationId: pending.authorizationId });
        const { chargeId } = await declined(f, pending.authorizationId);
        const { ports } = chargePorts(f, addonFactSpy().sink);
        await recordChargeFact({ chargeId }, ports);

        // Act
        const retry = await purchaseAddon(f.input(), f.ports);

        // Assert
        expect(await pairStatus(pending)).toEqual({
            instance: 'ABANDONED',
            complement: 'ABANDONED'
        });
        expect(retry.outcome).toBe('CREATED');
        expect(retry.outcome === 'CREATED' && typeof retry.checkoutUrl).toBe('string');
    });

    it.skipIf(skip)('a redelivery releases nothing more and emits no second fact', async () => {
        // Arrange
        const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
        const pending = await pendingPurchase(f);
        await f.fake.cancel({ authorizationId: pending.authorizationId });
        const { chargeId } = await declined(f, pending.authorizationId);
        const spy = addonFactSpy();
        const { ports } = chargePorts(f, spy.sink);
        await recordChargeFact({ chargeId }, ports);
        const after = await pairRows(pending);

        // Act
        await recordChargeFact({ chargeId }, ports);

        // Assert
        expect(spy.addonFacts().map(({ kind }) => kind)).toEqual([
            'ADDON_CHARGE_REJECTED',
            'ADDON_CHECKOUT_ABANDONED'
        ]);
        expect(await pairRows(pending)).toEqual(after);
    });
});
