// HOS-1603, AC:B11:6 (H1 option A): who records our decision to cancel a preapproval.
import { domainEventModel, eq, inArray, providerLinks, subscriptions } from '@repo/db';
import { type PaymentProvider, parseProbeManifest } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleUnknownAuthorization } from '../../../src/services/billing/reconciliation/handle-unknown-authorization.service.js';
import { cancelInheritedTouristVips } from '../../../src/services/billing/subscription/cancel-inherited-tourist-vip.service.js';
import { declineFirstCharge } from '../../../src/services/billing/subscription/decline-first-charge.service.js';
import { expireAuthorizationWindows } from '../../../src/services/billing/subscription/expire-authorization-windows.service.js';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    resetSeededReconciliationInventory,
    seedSubscription
} from './reconciliation-sweep-fixtures.js';
import { handleCharge, unknownCharge } from './reconciliation-tombstone-fixtures.js';
import {
    seededSubscriptionIds,
    withSeededSubscriptionSweep
} from './support/subscription-window-sweep.js';
import { noTouristVip } from './support/tourist-vip.js';

const start = new Date('2027-01-02T00:00:00.000Z');
let current = start;
const clock = { now: () => current };
const vipIds: string[] = [];

afterAll(closeServiceTestPool);
beforeEach(() => {
    current = start;
    vi.restoreAllMocks();
    resetSeededReconciliationInventory();
});
afterEach(async () => {
    seededSubscriptionIds.clear();
    // A surviving ACTIVE VIP would be taken by another suite's sweepInheritedTouristVips.
    if (vipIds.length > 0)
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(inArray(subscriptions.id, vipIds.splice(0)));
});

function newFake(honestM8 = false) {
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        ...(honestM8
            ? { honestAbout: [{ lie: 'M8' as const, why: 'the tombstone charge lands approved' }] }
            : {})
    });
    return { fake, provider: fake as unknown as PaymentProvider };
}

async function decisions(subscriptionId: string) {
    return (
        await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: subscriptionId
        })
    ).filter((event) => event.eventType === 'subscription.provider_cancellation_decided');
}

function notice(answer: Awaited<ReturnType<BeforeCancelNotice['beforeCancel']>>) {
    return { beforeCancel: vi.fn<BeforeCancelNotice['beforeCancel']>(async () => answer) };
}

/** A card PENDING_AUTHORIZATION row whose window ended, linked to a pending authorization. */
async function seedExpiredCardWindow(fake: FakePaymentProvider) {
    const seeded = await seedSubscription({ status: 'PENDING_AUTHORIZATION' });
    const { authorizationId } = await fake.authorize({
        reference: seeded.subscription.id,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'S3 decision fixture',
        returnUrl: 'https://example.test/return',
        payerEmail: `payer-${crypto.randomUUID()}@example.test`
    });
    await getServiceTestDb().insert(providerLinks).values({
        subscriptionId: seeded.subscription.id,
        provider: 'MERCADO_PAGO',
        providerId: authorizationId
    });
    seededSubscriptionIds.add(seeded.subscription.id);
    return seeded.subscription.id;
}

describe('HOS-1603 AC:B11:6 our transitions record their decision to cancel', () => {
    it.each([
        ['SENT', 1],
        ['NOT_YET_SENT', 0]
    ] as const)('AC:B11:6 S3 on a linked card row records S3 at the clock instant (notice %s)', async (answer, calls) => {
        const { fake, provider } = newFake();
        const subscriptionId = await seedExpiredCardWindow(fake);
        const cancel = vi.spyOn(fake, 'cancel');
        const summary = await withSeededSubscriptionSweep(20, () =>
            expireAuthorizationWindows(20, {
                provider,
                clock,
                beforeCancelNotice: notice(answer),
                touristVipInheritance: noTouristVip
            })
        );
        expect(summary.abandoned).toBe(1);
        expect(cancel).toHaveBeenCalledTimes(calls);
        const recorded = await decisions(subscriptionId);
        expect(recorded).toHaveLength(1);
        expect(recorded[0]).toMatchObject({
            reason: 'S3',
            actorType: 'job',
            occurredAt: start,
            changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }]
        });
    });

    it('AC:B11:6 S3 on a manual payer records nothing: there was no call', async () => {
        const { provider } = newFake();
        const seeded = await seedSubscription({
            status: 'PENDING_AUTHORIZATION',
            paymentMethod: 'MANUAL'
        });
        seededSubscriptionIds.add(seeded.subscription.id);
        const summary = await withSeededSubscriptionSweep(20, () =>
            expireAuthorizationWindows(20, {
                provider,
                clock,
                beforeCancelNotice: notice('SENT'),
                touristVipInheritance: noTouristVip
            })
        );
        expect(summary.abandoned).toBe(1);
        expect(await decisions(seeded.subscription.id)).toEqual([]);
    });

    it('AC:B11:6 S16 records S16 when it called, and nothing when the re-read already saw cancelled', async () => {
        const { fake, provider } = newFake();
        const called = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const declined = await fake.declineCharge({
            authorizationId: called.providerId!,
            declineReason: 'issuer_declined'
        });
        expect(
            await declineFirstCharge(
                { chargeId: declined.chargeId },
                { provider, clock, beforeCancelNotice: notice('SENT') }
            )
        ).toMatchObject({ outcome: 'DECLINED', cancelCall: 'SENT' });
        expect(await decisions(called.subscription.id)).toEqual([
            expect.objectContaining({
                reason: 'S16',
                actorType: 'provider',
                occurredAt: start,
                changes: [{ field: 'status', old: 'ACTIVE', new: 'CHARGE_DECLINED' }]
            })
        ]);

        const seen = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const seenCharge = await fake.declineCharge({
            authorizationId: seen.providerId!,
            declineReason: 'issuer_declined'
        });
        await fake.cancel({ authorizationId: seen.providerId! });
        expect(
            await declineFirstCharge(
                { chargeId: seenCharge.chargeId },
                { provider, clock, beforeCancelNotice: notice('SENT') }
            )
        ).toMatchObject({ outcome: 'DECLINED', cancelCall: 'NOT_NEEDED' });
        expect(await decisions(seen.subscription.id)).toEqual([]);
    });

    it('AC:B11:6 the receipt tombstone of an unknown charge records RECEPTION_TOMBSTONE; a probe records nothing', async () => {
        const { fake, provider } = newFake(true);
        const unknown = await unknownCharge(fake);
        const { result, correlationId } = await handleCharge(unknown, { provider, clock });
        if (result.outcome !== 'MARKED') throw new Error('Expected a tombstone');
        expect(await decisions(result.subscriptionId)).toEqual([
            expect.objectContaining({
                reason: 'RECEPTION_TOMBSTONE',
                actorType: 'provider',
                correlationId,
                occurredAt: start,
                changes: [{ field: 'status', new: 'CANCELLED' }]
            })
        ]);

        const probe = await unknownCharge(fake);
        const { manifest } = parseProbeManifest({ input: { ids: [probe.authorizationId] } });
        const probed = await handleCharge(probe, { provider, clock, probeManifest: manifest });
        if (probed.result.outcome !== 'MARKED') throw new Error('Expected a probe tombstone');
        expect(probed.result.cancellation).toBe('PROBE_SKIPPED');
        expect(await decisions(probed.result.subscriptionId)).toEqual([]);
    });

    it('AC:B11:6 the receipt tombstone of an AUTHORIZATION arrival records RECEPTION_TOMBSTONE too', async () => {
        const { fake, provider } = newFake();
        const { authorizationId } = await fake.authorize({
            reference: `legacy-${crypto.randomUUID()}`,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'legacy authorization after the cutover',
            returnUrl: 'https://example.test/return',
            payerEmail: `legacy-${crypto.randomUUID()}@example.test`
        });
        await fake.approve({ authorizationId });
        const result = await handleUnknownAuthorization(
            {
                authorizationId,
                arrival: { kind: 'AUTHORIZATION' },
                correlationId: crypto.randomUUID()
            },
            { provider, clock }
        );
        if (result.outcome !== 'MARKED') throw new Error('Expected a tombstone');
        expect((await decisions(result.subscriptionId)).map((event) => event.reason)).toEqual([
            'RECEPTION_TOMBSTONE'
        ]);
    });

    it('AC:B11:6 the inherited Tourist VIP records TOURIST_VIP_INHERITED only when it called', async () => {
        const { fake, provider } = newFake();
        const ports = {
            provider,
            clock,
            beforeCancelNotice: notice('SENT'),
            touristVipInheritance: { inherits: async () => true }
        };

        const live = await seedSubscription({
            vertical: 'tourist',
            status: 'ACTIVE',
            withLink: true,
            fake
        });
        vipIds.push(live.subscription.id);
        expect(
            await cancelInheritedTouristVips({ userId: live.subscription.userId! }, ports)
        ).toMatchObject({
            cancelled: 1
        });
        const [closed] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, live.subscription.id));
        expect(closed?.status).toBe('CANCELLED');
        expect(await decisions(live.subscription.id)).toEqual([
            expect.objectContaining({
                reason: 'TOURIST_VIP_INHERITED',
                actorType: 'job',
                occurredAt: closed?.serviceEndsAt,
                changes: [{ field: 'status', new: 'CANCELLED' }]
            })
        ]);

        const unlinked = await seedSubscription({ vertical: 'tourist', status: 'ACTIVE' });
        vipIds.push(unlinked.subscription.id);
        expect(
            await cancelInheritedTouristVips({ userId: unlinked.subscription.userId! }, ports)
        ).toMatchObject({
            cancelled: 1
        });
        expect(await decisions(unlinked.subscription.id)).toEqual([]);

        const alreadyCancelled = await seedSubscription({
            vertical: 'tourist',
            status: 'ACTIVE',
            withLink: true,
            fake
        });
        vipIds.push(alreadyCancelled.subscription.id);
        await fake.cancel({ authorizationId: alreadyCancelled.providerId! });
        expect(
            await cancelInheritedTouristVips(
                { userId: alreadyCancelled.subscription.userId! },
                ports
            )
        ).toMatchObject({ cancelled: 1 });
        expect(await decisions(alreadyCancelled.subscription.id)).toEqual([]);
    });
});
