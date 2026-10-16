import {
    addonInstances,
    coverageLosses,
    type DrizzleClient,
    domainEventModel,
    eq,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSubscriptionSources } from '../../../src/services/billing/coverage/subscription-sources.js';
import {
    type CancelDirectSubscriptionPorts,
    cancelDirectSubscription
} from '../../../src/services/billing/subscription/cancel-direct-subscription.service.js';
import { noCreditedPayments } from '../../../src/services/billing/subscription/subscription-billing-ports.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    orphanPorts as makeOrphanPorts,
    seedVerticalAddon
} from './support/addon-orphan-fixtures.js';
import { cancelActiveNow } from './support/cancel-active-fixtures.js';
import {
    retireCancelDirectRows,
    seedDirectCancellation
} from './support/cancel-direct-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const owner = (id: string) => ({ id, roles: [], permissions: [] });
const clock = { now: () => cancelActiveNow };
const orphanhood = {
    addonPolicy: async () => {
        throw new Error('unexpected addon policy read');
    },
    listing: async () => {
        throw new Error('unexpected listing read');
    }
};
const orphanedInstances: string[] = [];
const orphanedComplements: string[] = [];
const ports = (fake: FakePaymentProvider, coverage = vi.fn(async () => undefined)) => ({
    provider: fake,
    clock,
    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
    coverageNotices: { emitCoverageChanged: coverage },
    orphanhood
});
afterEach(async () => {
    if (orphanedInstances.length)
        await getServiceTestDb()
            .update(addonInstances)
            .set({ status: 'CANCELLED' })
            .where(eq(addonInstances.id, orphanedInstances.pop()!));
    if (orphanedComplements.length)
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED', serviceEndsAt: cancelActiveNow })
            .where(eq(subscriptions.id, orphanedComplements.pop()!));
    await retireCancelDirectRows();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8a:9 S24 from GRACE_PERIOD', () => {
    it('TEST:B8a:9 (a,b,f): cancels directly, removes its source and records coverage loss', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const graceStartedAt = new Date('2026-10-10T12:00:00.000Z');
        const graceEndsAt = new Date('2026-10-17T12:00:00.000Z');
        const seeded = await seedDirectCancellation({
            fake,
            status: 'GRACE_PERIOD',
            preapproval: 'LIVE',
            graceStartedAt,
            graceEndsAt
        });
        const before = await resolveSubscriptionSources({
            userId: seeded.userId,
            vertical: VerticalEnum.ACCOMMODATION,
            ports: { clock, payments: noCreditedPayments }
        });
        expect(before.sources).toHaveLength(1);
        const coverage = vi.fn(async () => undefined);
        const result = await cancelDirectSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake, coverage)
        );
        expect(result).toMatchObject({
            outcome: 'CANCELLED',
            origin: 'GRACE_PERIOD',
            transition: 'S24',
            serviceEndedAt: cancelActiveNow,
            cancelCall: 'SENT'
        });
        expect(
            (
                await resolveSubscriptionSources({
                    userId: seeded.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports: { clock, payments: noCreditedPayments }
                })
            ).sources
        ).toHaveLength(0);
        const [sub] = await getServiceTestDb()
            .select({
                status: subscriptions.status,
                serviceEndsAt: subscriptions.serviceEndsAt,
                graceStartedAt: subscriptions.graceStartedAt,
                graceEndsAt: subscriptions.graceEndsAt
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscriptionId));
        expect(sub).toMatchObject({
            status: 'CANCELLED',
            serviceEndsAt: cancelActiveNow,
            graceStartedAt,
            graceEndsAt
        });
        const [loss] = await getServiceTestDb()
            .select({ lostAt: coverageLosses.lostAt })
            .from(coverageLosses)
            .where(eq(coverageLosses.userId, seeded.userId));
        expect(loss?.lostAt).toEqual(cancelActiveNow);
        expect(coverage).toHaveBeenCalledWith({
            userId: seeded.userId,
            vertical: 'accommodation',
            sourceType: 'SUBSCRIPTION',
            change: 'REMOVED'
        });
        const decision = (
            await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: seeded.subscriptionId
            })
        ).find((event) => event.eventType === 'subscription.provider_cancellation_decided');
        expect(decision?.reason).toBe('S24');
        expect(decision?.changes).toContainEqual({
            field: 'status',
            old: 'GRACE_PERIOD',
            new: 'CANCELLED'
        });
        const lateGraceTick = await suspendForArrears(
            {
                subscriptionId: seeded.subscriptionId,
                event: 'GRACE_EXPIRED',
                occurrenceId: crypto.randomUUID()
            },
            {
                provider: fake,
                clock,
                beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
            }
        );
        expect(lateGraceTick).toMatchObject({ outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_GRACE' });
        expect(
            await getServiceTestDb()
                .select({ id: reconciliationMarks.id })
                .from(reconciliationMarks)
                .where(eq(reconciliationMarks.subscriptionId, seeded.subscriptionId))
        ).toHaveLength(0);
    });

    it('TEST:B8a:9 (d): manual payer is not sent to the provider', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedDirectCancellation({
            fake,
            status: 'GRACE_PERIOD',
            paymentMethod: 'MANUAL'
        });
        const cancel = vi.spyOn(fake, 'cancel');
        const result = await cancelDirectSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            ports(fake)
        );
        expect(result).toMatchObject({ outcome: 'CANCELLED', cancelCall: 'NOT_APPLICABLE' });
        expect(cancel).not.toHaveBeenCalled();
        expect(
            (
                await domainEventModel.findByEntity({
                    entityType: 'subscription',
                    entityId: seeded.subscriptionId
                })
            ).filter((event) => event.eventType === 'subscription.provider_cancellation_decided')
        ).toHaveLength(0);
    });

    it('TEST:B8a:9 (e): S24 closes a live succession through the injected S18 port', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedDirectCancellation({
            fake,
            status: 'GRACE_PERIOD',
            paymentMethod: 'MANUAL',
            liveSuccessor: true
        });
        const closeSuccession = vi.fn(
            async (_input: { predecessorSubscriptionId: string; tx: DrizzleClient }) => undefined
        );
        const result = await cancelDirectSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            { ...ports(fake), successionCloser: { closeSuccession } }
        );
        expect(result).toMatchObject({ outcome: 'CANCELLED', successionClosed: true });
        expect(closeSuccession).toHaveBeenCalledTimes(1);
        expect(closeSuccession.mock.calls[0]?.[0].predecessorSubscriptionId).toBe(
            seeded.subscriptionId
        );
    });

    it('TEST:1570:2: A5 orphans a vertical subscription addon with the direct cancellation', async () => {
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedDirectCancellation({
            fake,
            status: 'GRACE_PERIOD',
            paymentMethod: 'MANUAL'
        });
        const addon = await seedVerticalAddon(getServiceTestDb(), {
            userId: seeded.userId,
            targetId: seeded.subscriptionId
        });
        orphanedInstances.push(addon.instanceId);
        orphanedComplements.push(addon.complementId);
        const result = await cancelDirectSubscription(
            { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
            { ...ports(fake), orphanhood: makeOrphanPorts(getServiceTestDb()).ports }
        );
        expect(result.outcome).toBe('CANCELLED');
        expect(result.outcome === 'CANCELLED' ? result.orphanedAddonIds : []).toContain(
            addon.instanceId
        );
        expect(
            (
                await getServiceTestDb()
                    .select({ status: addonInstances.status })
                    .from(addonInstances)
                    .where(eq(addonInstances.id, addon.instanceId))
            )[0]?.status
        ).toBe('CANCELLED');
    });

    it('TEST:1570:2 requires orphanhood at the type boundary', () => {
        function requireOrphanhoodPort(
            value: Omit<CancelDirectSubscriptionPorts, 'orphanhood'>
        ): CancelDirectSubscriptionPorts {
            // @ts-expect-error orphanhood must be required so the local A5 transition cannot disappear.
            return value;
        }
        expect(requireOrphanhoodPort).toBeTypeOf('function');
    });
});
