/**
 * HOS-1883 (owner decision on I1): a paid, active add-on whose COMPLEMENTO is cancelled at the
 * provider emits exactly one `addon_cancelled{path:'PROVIDER_CANCELLED'}` through the real
 * provider-notice mirror; a redelivery emits nothing more, and neither does a PRINCIPAL
 * cancellation nor a complement whose instance is no longer active.
 */
import { addonInstances, eq, providerLinks, subscriptions } from '@repo/db';
import { encodeFakeNotice } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import type { BillingFactSink } from '../../../src/services/billing/facts/billing-fact-sink';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import {
    addonFactSpy,
    addonFactSubjectOf,
    lifetimeDaysBetween
} from './support/addon-fact-subject';
import { seedComplementCharge } from './support/addon-orphan-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './support/addon-purchase-fixtures';

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

type Fixture = Awaited<ReturnType<typeof purchaseFixture>>;

async function statusOf(subscriptionId: string) {
    const [row] = await getServiceTestDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    return row?.status;
}

function noticePorts(f: Fixture, billingFacts: BillingFactSink) {
    return {
        provider: f.fake,
        clock: f.ports.clock,
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        complements: f.ports,
        coverageNotices: { emitCoverageChanged: async () => {} },
        payments: creditedPaymentsFromLedger,
        billingFacts
    };
}

async function deliver(input: {
    readonly f: Fixture;
    readonly authorizationId: string;
    readonly version: string;
    readonly billingFacts: BillingFactSink;
}) {
    const notice = encodeFakeNotice({
        notice: {
            resourceKind: 'authorization',
            resourceId: input.authorizationId,
            version: input.version
        },
        format: 'json'
    });
    return processProviderNotice(
        {
            channel: 'WEBHOOKS',
            delivery: { headers: { 'content-type': 'application/json' }, body: notice.body }
        },
        noticePorts(input.f, input.billingFacts)
    );
}

/**
 * A paying principal and a paid recurring add-on activated through the real notice path, with
 * one credited COMPLEMENTO charge (so the mirror does not wait for a first-charge reading).
 */
async function activeAddon() {
    const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
    const principal = await payingPrincipal(f);
    const bought = await purchaseAddon(f.input(), f.ports);
    if (bought.outcome !== 'CREATED') throw new Error('Purchase missing');
    const [instance] = await getServiceTestDb()
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, bought.instanceId));
    const complementId = instance?.complementSubscriptionId;
    if (!complementId) throw new Error('Complement missing');
    const [link] = await getServiceTestDb()
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, complementId));
    if (!link) throw new Error('Addon preapproval missing');
    await f.fake.approve({ authorizationId: link.providerId });
    await deliver({
        f,
        authorizationId: link.providerId,
        version: '1',
        billingFacts: { emit: () => undefined }
    });
    await getServiceTestDb().transaction((tx) =>
        seedComplementCharge(tx, {
            subscriptionId: complementId,
            factAt: new Date(f.ports.clock.now().getTime() - 86_400_000)
        })
    );
    return { f, principal, instanceId: bought.instanceId, authorizationId: link.providerId };
}

describe.skipIf(!isServiceTestDbAvailable())('HOS-1883 add-on facts: provider cancellation', () => {
    it('a complement cancelled at the provider emits one addon_cancelled PROVIDER_CANCELLED; a redelivery emits nothing more', async () => {
        // Arrange
        const { f, instanceId, authorizationId } = await activeAddon();
        const before = await addonFactSubjectOf({ instanceId });
        const startsAt = before.instance.startsAt;
        if (!startsAt) throw new Error('startsAt missing');
        await f.fake.cancel({ authorizationId });
        const spy = addonFactSpy();

        // Act
        const first = await deliver({ f, authorizationId, version: '2', billingFacts: spy.sink });
        const redelivery = await deliver({
            f,
            authorizationId,
            version: '2',
            billingFacts: spy.sink
        });

        // Assert: the mirror itself ran (the complement is CANCELLED), once.
        expect(await statusOf(before.subject.subscriptionId ?? '')).toBe('CANCELLED');
        expect(first).toMatchObject({ ack: 'OK' });
        expect(redelivery).toMatchObject({ ack: 'OK' });
        const now = f.ports.clock.now();
        expect(spy.addonFacts()).toEqual([
            {
                kind: 'ADDON_CANCELLED',
                ...before.subject,
                actorKind: 'SYSTEM',
                occurredAt: now,
                path: 'PROVIDER_CANCELLED',
                wasScheduled: false,
                lifetimeDays: lifetimeDaysBetween(startsAt, now)
            }
        ]);
    });

    it('a PRINCIPAL cancelled at the provider emits no add-on fact', async () => {
        // Arrange
        const { f, principal } = await activeAddon();
        await f.fake.cancel({ authorizationId: principal.authorizationId });
        const spy = addonFactSpy();

        // Act
        await deliver({
            f,
            authorizationId: principal.authorizationId,
            version: '2',
            billingFacts: spy.sink
        });

        // Assert: the mirror ran on the PRINCIPAL, and no add-on fact came out of it.
        expect(await statusOf(principal.subscriptionId)).toBe('CANCELLED');
        expect(spy.addonFacts()).toEqual([]);
    });

    it('a complement whose instance is no longer active emits nothing', async () => {
        // Arrange
        const { f, instanceId, authorizationId } = await activeAddon();
        await getServiceTestDb()
            .update(addonInstances)
            .set({ status: 'CANCELLED' })
            .where(eq(addonInstances.id, instanceId));
        await f.fake.cancel({ authorizationId });
        const spy = addonFactSpy();

        // Act
        await deliver({ f, authorizationId, version: '2', billingFacts: spy.sink });

        // Assert: the mirror cancelled the complement, and the inactive instance owes nothing.
        const complementId = (await addonFactSubjectOf({ instanceId })).subject.subscriptionId;
        expect(await statusOf(complementId ?? '')).toBe('CANCELLED');
        expect(spy.addonFacts()).toEqual([]);
    });
});
